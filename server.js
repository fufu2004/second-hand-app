// server.js
// --- VERSION 2.0 (Advanced Features) ---
// This version adds a description and contact field to items,
// and implements a secure way to delete items using a secret key.

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require("socket.io");
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid'); // For generating unique keys

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

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir);
    console.log("Created 'uploads' directory.");
}

// --- חיבור למסד הנתונים (MongoDB) ---
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB...'))
    .catch(err => console.error('Could not connect to MongoDB...', err));

// --- הגדרת מודל (Schema) לפריט ---
const itemSchema = new mongoose.Schema({
    title: String,
    price: Number,
    description: String, // NEW
    contact: String,     // NEW
    imageUrl: String,
    deleteKey: { type: String, required: true }, // NEW
    createdAt: { type: Date, default: Date.now }
});
const Item = mongoose.model('Item', itemSchema);

// --- Middlewares ---
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// --- הגדרת Multer לאחסון תמונות ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

// --- API Endpoints ---

// קבלת כל היסטוריית הפריטים
app.get('/items', async (req, res) => {
    try {
        // Exclude deleteKey from the public response
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

        const deleteKey = uuidv4(); // Generate a unique secret key for deletion

        const newItem = new Item({
            title: req.body.title,
            price: req.body.price,
            description: req.body.description,
            contact: req.body.contact,
            imageUrl: `/uploads/${req.file.filename}`,
            deleteKey: deleteKey
        });

        await newItem.save();
        
        // Broadcast the new item WITHOUT the delete key
        const publicItem = newItem.toObject();
        delete publicItem.deleteKey;
        io.emit('newItem', publicItem);

        // Return the new item WITH the delete key to the uploader
        res.status(201).json(newItem);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error creating item');
    }
});

// --- NEW: Delete an item ---
app.delete('/items/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { deleteKey } = req.body;

        if (!deleteKey) {
            return res.status(400).send('Delete key is required.');
        }

        const item = await Item.findById(id);
        if (!item) {
            return res.status(404).send('Item not found.');
        }

        if (item.deleteKey !== deleteKey) {
            return res.status(403).send('Invalid delete key.');
        }

        // Delete the image file from the server
        const imagePath = path.join(__dirname, item.imageUrl);
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }

        await Item.findByIdAndDelete(id);

        // Broadcast the ID of the deleted item to all clients
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
