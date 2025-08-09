// server.js - Final Corrected Version

// 1. All require statements must be at the top
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

// 2. Initialize the app and server
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PATCH", "DELETE"]
    }
});
const PORT = process.env.PORT || 3000;

// --- Read Environment Variables ---
const {
    GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, MONGO_URI, JWT_SECRET,
    CLIENT_URL, SERVER_URL, ADMIN_EMAIL, SENDGRID_API_KEY,
    SENDER_EMAIL_ADDRESS, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
    CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
} = process.env;

// --- Configure external services ---
webPush.setVapidDetails('mailto:your-email@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET });
if (SENDGRID_API_KEY) sgMail.setApiKey(SENDGRID_API_KEY);

// 3. Define all Mongoose Schemas and Models
const UserSchema = new mongoose.Schema({ /* ... schema definition ... */ });
const ItemSchema = new mongoose.Schema({ /* ... schema definition ... */ });
// ... Add all other schemas here
const User = mongoose.model('User', UserSchema);
const Item = mongoose.model('Item', ItemSchema);
// ... Add all other models here

// 4. Setup all middleware (app.use)
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use(session({ secret: 'keyboard cat', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


// 5. Define all API routes (app.get, app.post, etc.)
app.get('/api/items', async (req, res) => {
    try {
        const items = await Item.find({ sold: false })
            .populate('owner', 'displayName image isVerified averageRating')
            .sort({ createdAt: -1 });
        res.json(items);
    } catch (err) {
        console.error("Error fetching items:", err);
        res.status(500).json({ message: "Server error while fetching items" });
    }
});

// ... Add all other API routes here

// 6. Connect to DB and start the server (this should be last)
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log('MongoDB Connected Successfully!');
        server.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('FATAL: MongoDB Connection Error:', err);
        process.exit(1);
    });
