// server.js

// 1. ייבוא ספריות נדרשות
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

// --- הגדרות ראשוניות ---
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PATCH", "DELETE"]
    }
});
const PORT = process.env.PORT || 3000;

// --- מונה גלובלי לעדכון במייל ---
let newItemCounter = 0;
// --- מערך למעקב אחר משתמשים מחוברים ---
const connectedUsers = new Map();


// --- קריאת משתני סביבה ---
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const CLIENT_URL = process.env.CLIENT_URL || 'http://placeholder.com';
const SERVER_URL = process.env.SERVER_URL || 'http://placeholder.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDER_EMAIL_ADDRESS = process.env.SENDER_EMAIL_ADDRESS;

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error("FATAL ERROR: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are missing from .env file!");
} else {
    webPush.setVapidDetails(
        'mailto:your-email@example.com',
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY
    );
    console.log("Web Push configured successfully.");
}


// --- הגדרת Cloudinary ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// --- הגדרת שירות המייל (SendGrid) ---
if (SENDGRID_API_KEY && SENDER_EMAIL_ADDRESS) {
    sgMail.setApiKey(SENDGRID_API_KEY);
    console.log("SendGrid configured successfully.");
} else {
    console.warn("SendGrid is not configured. Email notifications will be disabled.");
}

// --- בדיקת משתני סביבה חיוניים ---
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !MONGO_URI || !JWT_SECRET || !CLIENT_URL || !SERVER_URL || !ADMIN_EMAIL || !process.env.CLOUDINARY_CLOUD_NAME) {
    console.error("FATAL ERROR: One or more required environment variables are missing!");
    process.exit(1);
}

// --- הגדרת מודלים למסד הנתונים ---

const ShopSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    logoUrl: { type: String },
    createdAt: { type: Date, default: Date.now }
});
const Shop = mongoose.model('Shop', ShopSchema);

const UserSchema = new mongoose.Schema({
    googleId: { type: String, required: true },
    displayName: String,
    email: String,
    image: String,
    ratings: [{
        rater: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        rating: { type: Number, min: 1, max: 5, required: true },
        comment: String,
        createdAt: { type: Date, default: Date.now }
    }],
    averageRating: { type: Number, default: 0 },
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }],
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isVerified: { type: Boolean, default: false },
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
    isBanned: { type: Boolean, default: false },
    isSuspended: { type: Boolean, default: false },
    suspensionExpires: { type: Date }
});
const User = mongoose.model('User', UserSchema);

const ItemSchema = new mongoose.Schema({
    title: String,
    description: String,
    price: Number,
    category: String,
    contact: String,
    imageUrls: [String],
    affiliateLink: { type: String, default: '' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sold: { type: Boolean, default: false },
    isPromoted: { type: Boolean, default: false },
    promotedUntil: { type: Date },
    condition: { type: String, enum: ['new-with-tags', 'new-without-tags', 'like-new', 'good', 'used'], default: 'good' },
    size: { type: String, trim: true },
    brand: { type: String, trim: true },
    location: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now }
});
const Item = mongoose.model('Item', ItemSchema);

const OfferSchema = new mongoose.Schema({
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    offerPrice: { type: Number, required: true },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'countered', 'cancelled'],
        default: 'pending'
    },
    counterPrice: { type: Number },
}, { timestamps: true });
const Offer = mongoose.model('Offer', OfferSchema);


const ConversationSchema = new mongoose.Schema({
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
    lastMessage: { type: String },
}, { timestamps: true });
const Conversation = mongoose.model('Conversation', ConversationSchema);

const MessageSchema = new mongoose.Schema({
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

const ReportSchema = new mongoose.Schema({
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reportedItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
    reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: {
        type: String,
        required: true,
        enum: ['inappropriate-content', 'spam', 'scam', 'wrong-category', 'harassment']
    },
    details: { type: String },
    status: { type: String, default: 'new', enum: ['new', 'in-progress', 'resolved'] }
}, { timestamps: true });
const Report = mongoose.model('Report', ReportSchema);

const NotificationSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true, enum: ['new-message', 'new-rating', 'new-follower', 'saved-search', 'new-offer', 'offer-update'] },
    message: { type: String, required: true },
    link: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
const Notification = mongoose.model('Notification', NotificationSchema);

const PushSubscriptionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subscription: {
        endpoint: { type: String, required: true, unique: true },
        keys: {
            p256dh: String,
            auth: String
        }
    }
});
const PushSubscription = mongoose.model('PushSubscription', PushSubscriptionSchema);

const UserSessionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    loginAt: { type: Date, default: Date.now },
    logoutAt: { type: Date }
});
const UserSession = mongoose.model('UserSession', UserSessionSchema);

const SubscriberSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    displayName: { type: String, required: true },
    subscribedAt: { type: Date, default: Date.now }
});
const Subscriber = mongoose.model('Subscriber', SubscriberSchema);

const SavedSearchSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    filters: {
        searchTerm: String,
        category: String,
        condition: String,
        size: String,
        brand: String,
        location: String,
        minPrice: Number,
        maxPrice: Number
    }
}, { timestamps: true });
const SavedSearch = mongoose.model('SavedSearch', SavedSearchSchema);


// --- הגדרות העלאת קבצים ---
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- הגדרת Middleware ---
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname)));

app.use(session({ secret: 'keyboard cat', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

// --- פונקציה לשליחת מייל עדכון ---
// ... (code for sendNewsletterUpdate remains the same)

// --- הגדרת Passport.js ---
// ... (code for passport remains the same)

// --- Middleware לאימות טוקן ---
// ... (code for authMiddleware remains the same)

// --- Middleware לבדיקת הרשאות מנהל ---
// ... (code for adminMiddleware remains the same)

// --- פונקציית עזר להעלאת תמונות ל-Cloudinary ---
// ... (code for uploadToCloudinary remains the same)

// --- נתיבים (Routes) ---
// ... (All routes remain the same)

// --- חיבור למסד הנתונים והרצת השרת ---
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
