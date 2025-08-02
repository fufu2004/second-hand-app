// server.js
// --- VERSION 5.0 (Advanced Features: Sorting & Sold Status) ---
// This version adds sorting capabilities and allows users to mark items as 'sold'.

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
        methods: ["GET", "POST", "DELETE", "PATCH"]
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
    imageUrls: [String],
    deleteKey: { type: String, required: true },
    status: { type: String, default: 'available', enum: ['available', 'sold'] }, // NEW: Item status
    createdAt: { type: Date, default: Date.now }
});
const Item = mongoose.model('Item', itemSchema);

// --- Middlewares ---
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// --- הגדרת Multer לאחסון תמונות בזיכרון ---
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- API Endpoints ---

// קבלת כל היסטוריית הפריטים
app.get('/items', async (req, res) => {
    try {
        const sortQuery = {};
        switch (req.query.sort) {
            case 'price_asc':
                sortQuery.price = 1;
                break;
            case 'price_desc':
                sortQuery.price = -1;
                break;
            default:
                sortQuery.createdAt = -1; // Newest first
        }

        // Move sold items to the end
        const items = await Item.find()
            .select('-deleteKey')
            .sort({ status: 1 }) // 'available' comes before 'sold'
            .sort(sortQuery);
            
        res.json(items);
    } catch (error) {
        res.status(500).send('Error fetching items');
    }
});

// העלאת פריט חדש
app.post('/items', upload.array('images', 6), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).send('No images uploaded.');
        }

        const deleteKey = uuidv4();
        const imageUrls = req.files.map(file => `data:${file.mimetype};base64,${file.buffer.toString('base64')}`);

        const newItem = new Item({
            title: req.body.title,
            price: req.body.price,
            description: req.body.description,
            contact: req.body.contact,
            imageUrls: imageUrls,
            deleteKey: deleteKey,
            status: 'available' // Default status
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

// --- NEW: Mark an item as sold ---
app.patch('/items/:id/sold', async (req, res) => {
    try {
        const { id } = req.params;
        const { deleteKey } = req.body;

        if (!deleteKey) return res.status(400).send('Delete key is required.');

        const item = await Item.findById(id);
        if (!item) return res.status(404).send('Item not found.');
        if (item.deleteKey !== deleteKey) return res.status(403).send('Invalid delete key.');

        item.status = 'sold';
        await item.save();

        const publicItem = item.toObject();
        delete publicItem.deleteKey;
        io.emit('itemUpdated', publicItem); // Broadcast the update

        res.status(200).json(publicItem);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error updating item status');
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
