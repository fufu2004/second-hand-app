// server.js
// השרת מנהל את מסד הנתונים, את העלאת הקבצים ואת התקשורת בזמן אמת

// --- התקנות נדרשות ---
// npm install express mongoose socket.io multer cors dotenv

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require("socket.io");
const multer = require('multer');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // בסביבת פרודקשן, יש לשנות לכתובת האתר שלך
        methods: ["GET", "POST"]
    }
});

// --- הגדרות ---
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI; // קורא את כתובת החיבור מקובץ .env

// --- חיבור למסד הנתונים (MongoDB) ---
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB...'))
    .catch(err => console.error('Could not connect to MongoDB...', err));

// --- הגדרת מודל (Schema) לפריט ---
const itemSchema = new mongoose.Schema({
    title: String,
    price: Number,
    imageUrl: String,
    createdAt: { type: Date, default: Date.now }
});
const Item = mongoose.model('Item', itemSchema);

// --- Middlewares ---
app.use(cors());
app.use(express.json());
// הגדרת תיקיית 'uploads' כסטטית כדי שהדפדפן יוכל לגשת לתמונות
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- הגדרת Multer לאחסון תמונות ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)) // שם קובץ ייחודי
    }
});
const upload = multer({ storage: storage });

// --- API Endpoints ---

// קבלת כל היסטוריית הפריטים
app.get('/items', async (req, res) => {
    try {
        const items = await Item.find().sort({ createdAt: -1 }); // מיון מהחדש לישן
        res.json(items);
    } catch (error) {
        res.status(500).send('Error fetching items');
    }
});

// העלאת פריט חדש
app.post('/items', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No image uploaded.');
        }

        const newItem = new Item({
            title: req.body.title,
            price: req.body.price,
            // הכתובת המלאה שבה התמונה תהיה זמינה באינטרנט
            imageUrl: `/uploads/${req.file.filename}`
        });

        await newItem.save();
        
        // --- שידור הפריט החדש לכל המשתמשים המחוברים ---
        io.emit('newItem', newItem);

        res.status(201).json(newItem);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error creating item');
    }
});

// --- Socket.IO Connection ---
io.on('connection', (socket) => {
    console.log('a user connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('user disconnected:', socket.id);
    });
});

// --- הפעלת השרת ---
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
