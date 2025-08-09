// server.js - DIAGNOSTIC VERSION

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const mongoose = require('mongoose');
const cors = require('cors');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const session = require('express-session');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const sgMail = require('@sendgrid/mail');
const path = require('path');
const webPush = require('web-push');

// --- START OF DIAGNOSTIC BLOCK ---
console.log("--- STARTING SERVER: ADVANCED DIAGNOSTIC MODE ---");
let isDbConnected = false;

async function connectToDB() {
    const MONGO_URI = process.env.MONGO_URI;
    if (!MONGO_URI) {
        console.error("FATAL: MONGO_URI environment variable is not set!");
        isDbConnected = false;
        return;
    }

    console.log("Attempting to connect to MongoDB Atlas...");
    try {
        await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        isDbConnected = true;
        console.log("SUCCESS: MongoDB Connected Successfully!");
    } catch (err) {
        console.error("--- !!! FATAL MONGODB CONNECTION ERROR !!! ---");
        console.error("This is the exact error message from the database:");
        console.error(err);
        console.error("--- !!! END OF ERROR MESSAGE !!! ---");
        isDbConnected = false;
    }
}
// --- END OF DIAGNOSTIC BLOCK ---


const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PATCH", "DELETE"]
    }
});
const PORT = process.env.PORT || 3000;

// ... (The rest of the file remains the same, only the items route and the final connection part will be changed)

// --- Define all schemas and models as before ---
// (All your schemas like UserSchema, ItemSchema, etc. go here)
// ...

// --- Define all middleware as before ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
// ... (rest of middleware)

// --- Define all routes EXCEPT the items route ---
// ... (all routes like /auth/google, /api/admin/*, etc.)

// --- MODIFIED items route for diagnostics ---
app.get('/items', async (req, res) => {
    if (!isDbConnected) {
        // If DB is not connected, return an empty array to prevent frontend crash
        return res.json({ items: [], totalPages: 0, currentPage: 1, totalItems: 0 });
    }
    try {
        // ... (The original logic of the items route goes here)
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const filters = {};
        if (req.query.category && req.query.category !== 'all') filters.category = req.query.category;
        // ... (rest of the filter logic)
        
        const items = await Item.find(filters).populate('owner', 'displayName email isVerified shop averageRating').sort({ createdAt: -1 }).skip(skip).limit(limit);
        const totalItems = await Item.countDocuments(filters);

        res.json({
            items,
            totalPages: Math.ceil(totalItems / limit),
            currentPage: page,
            totalItems: totalItems
        });

    } catch (err) {
        console.error("Error fetching items:", err);
        res.status(500).json({ message: err.message });
    }
});

// ... (All other routes remain the same)


// --- MODIFIED server start logic ---
async function startServer() {
    await connectToDB(); // Attempt to connect to DB

    server.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        if (!isDbConnected) {
            console.warn("WARNING: Server is running WITHOUT a database connection. API routes requiring DB will fail.");
        }
    });
}

startServer(); // Start the server
