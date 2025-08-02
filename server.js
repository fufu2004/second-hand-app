// server.js
// --- VERSION 3.0 (Stable Version with Base64 Image Storage) ---
// This version stores images directly in the database as Base64 data URLs
// to solve the ephemeral filesystem issue on hosting platforms like Render.

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require("socket.io");
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "DELETE"]
    }
});

// --- הגדרות ---
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// --- חיבור למסד הנתונים (MongoDB) ---
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB...'))
    .catch(err => console.error('Could not connect to MongoDB...', err));

// --- הגדרת מודל (Schema) לפריט ---
const itemSchema = new mongoose.Schema({
    title: String,
    price: Number,
    description: String,
    contact: String,
    imageUrl: String, // Will now store a Base64 Data URL
    deleteKey: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const Item = mongoose.model('Item', itemSchema);

// --- Middlewares ---
app.use(cors());
// Increase payload size limit to allow for Base64 images
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));


// --- הגדרת Multer לאחסון תמונות בזיכרון ---
const storage = multer.memoryStorage(); // Use memory storage to get buffer
const upload = multer({ storage: storage });

// --- API Endpoints ---

// קבלת כל היסטוריית הפריטים
app.get('/items', async (req, res) => {
    try {
        const items = await Item.find().sort({ createdAt: -1 }).select('-deleteKey');
        res.json(items);
    } catch (error) {
        res.status(500).send('Error fetching items');
    }
});

// העלאת פריט חדש
app.post('/items', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send('No image uploaded.');

        const deleteKey = uuidv4();
        
        // Convert image buffer to Base64 Data URL
        const imageAsDataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

        const newItem = new Item({
            title: req.body.title,
            price: req.body.price,
            description: req.body.description,
            contact: req.body.contact,
            imageUrl: imageAsDataUrl, // Save the Data URL
            deleteKey: deleteKey
        });

        await newItem.save();
        
        const publicItem = newItem.toObject();
        delete publicItem.deleteKey;
        io.emit('newItem', publicItem);

        res.status(201).json(newItem);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error creating item');
    }
});

// מחיקת פריט
app.delete('/items/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { deleteKey } = req.body;

        if (!deleteKey) return res.status(400).send('Delete key is required.');

        const item = await Item.findById(id);
        if (!item) return res.status(404).send('Item not found.');

        if (item.deleteKey !== deleteKey) return res.status(403).send('Invalid delete key.');

        await Item.findByIdAndDelete(id);

        io.emit('itemDeleted', id);
        res.status(200).send('Item deleted successfully.');

    } catch (error) {
        console.error(error);
        res.status(500).send('Error deleting item');
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
