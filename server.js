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
const CLIENT_URL = process.env.CLIENT_URL;
const SERVER_URL = process.env.SERVER_URL;
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

// *** NEW: Offer Schema ***
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
    counterPrice: { type: Number }, // For when the seller makes a counter-offer
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
    name: { type: String, required: true }, // e.g., "שמלת זארה מידה M"
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
async function sendNewsletterUpdate() {
    console.log('Threshold reached. Preparing to send newsletter...');
    try {
        const allUsers = await User.find({ email: { $ne: null } });
        const recentItems = await Item.find({ sold: false })
            .sort({ createdAt: -1 })
            .limit(20)
            .populate('owner', 'displayName');

        if (allUsers.length === 0 || recentItems.length === 0) {
            console.log('No users or recent items to send in the newsletter.');
            return;
        }

        let itemsHtml = recentItems.map(item => `
            <div style="border: 1px solid #ddd; border-radius: 8px; margin-bottom: 15px; padding: 10px; text-align: right;">
                <img src="${item.imageUrls[0]}" alt="${item.title}" style="width: 100%; max-width: 200px; border-radius: 8px; display: block; margin: 0 auto 10px;">
                <h4 style="margin: 0 0 5px 0;">${item.title}</h4>
                <p style="margin: 0 0 10px 0;">מחיר: ₪${item.price}</p>
                <a href="${CLIENT_URL}" style="display: inline-block; padding: 8px 15px; background-color: #14b8a6; color: white; text-decoration: none; border-radius: 5px;">לצפייה בפריט</a>
            </div>
        `).join('');

        const emailHtml = `
            <div dir="rtl" style="font-family: Arial, sans-serif; text-align: right; background-color: #f4f4f4; padding: 20px;">
                <div style="max-width: 600px; margin: auto; background: white; padding: 20px; border-radius: 8px;">
                    <h2 style="text-align: center; color: #14b8a6;">עדכון מסטייל מתגלגל!</h2>
                    <p>היי, רצינו לעדכן אותך על 20 הפריטים האחרונים שעלו לאתר. אולי תמצאי משהו שתאהבי:</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    ${itemsHtml}
                    <div style="text-align: center; margin-top: 20px;">
                       <a href="${CLIENT_URL}" style="display: inline-block; padding: 12px 25px; background-color: #f59e0b; color: white; text-decoration: none; border-radius: 5px; font-size: 16px;">בואי לראות עוד פריטים באתר</a>
                    </div>
                </div>
            </div>
        `;

        const recipients = allUsers.map(user => user.email);

        const msg = {
            to: recipients,
            from: {
                name: 'סטייל מתגלגל',
                email: SENDER_EMAIL_ADDRESS
            },
            subject: '✨ 20 פריטים חדשים וחמים מחכים לך בסטייל מתגלגל!',
            html: emailHtml
        };

        await sgMail.sendMultiple(msg);
        console.log(`Newsletter sent successfully to ${recipients.length} users.`);

    } catch (error) {
        console.error('Failed to send newsletter update:', error.toString());
    }
}

// --- הגדרת Passport.js ---
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => { User.findById(id).then(user => done(null, user)); });

passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: `${SERVER_URL}/auth/google/callback`,
    proxy: true
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ googleId: profile.id });
        if (user) return done(null, user);

        const newUser = new User({
            googleId: profile.id,
            displayName: profile.displayName,
            email: profile.emails[0].value,
            image: profile.photos[0].value
        });
        await newUser.save();

        await Subscriber.findOneAndUpdate(
            { email: newUser.email },
            { displayName: newUser.displayName },
            { upsert: true, new: true }
        );
        console.log(`User ${newUser.email} was added/updated in the subscribers list.`);

        return done(null, newUser);
    } catch (err) {
        console.error("Error during Google Strategy user processing:", err);
        return done(err, null);
    }
  }
));

// Middleware לאימות טוקן
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.status(401).json({ message: 'No token provided.' });

    jwt.verify(token, JWT_SECRET, async (err, decodedUser) => {
        if (err) return res.status(403).json({ message: 'Invalid token.' });

        try {
            const user = await User.findById(decodedUser.id);
            if (!user) {
                return res.status(404).json({ message: 'User not found.' });
            }

            if (user.isBanned) {
                return res.status(403).json({ message: 'This account has been permanently banned.' });
            }

            if (user.isSuspended) {
                if (user.suspensionExpires && user.suspensionExpires > new Date()) {
                    return res.status(403).json({ message: `This account is suspended until ${user.suspensionExpires.toLocaleDateString('he-IL')}.` });
                } else {
                    user.isSuspended = false;
                    user.suspensionExpires = null;
                    await user.save();
                }
            }

            req.user = decodedUser;
            next();
        } catch (dbError) {
            res.status(500).json({ message: "Server error during authentication check." });
        }
    });
};

// Middleware לבדיקת הרשאות מנהל
const adminMiddleware = (req, res, next) => {
    if (req.user && req.user.email === ADMIN_EMAIL) {
        next();
    } else {
        res.status(403).json({ message: 'Admin access required.' });
    }
};

// --- פונקציית עזר להעלאת תמונות ל-Cloudinary ---
const uploadToCloudinary = (fileBuffer) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream({ folder: "second-hand-app" }, (error, result) => {
            if (error) reject(error);
            else resolve(result);
        });
        streamifier.createReadStream(fileBuffer).pipe(uploadStream);
    });
};

// --- נתיבים (Routes) ---
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: `${CLIENT_URL}?login_failed=true`, session: false }), (req, res) => {
    const payload = {
        id: req.user._id,
        name: req.user.displayName,
        email: req.user.email,
        isVerified: req.user.isVerified
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
    res.redirect(`${CLIENT_URL}?token=${token}`);
});

// --- START: Admin Routes ---
app.get('/api/admin/dashboard-data', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const recentSessions = await UserSession.find()
            .sort({ loginAt: -1 })
            .limit(50)
            .populate('user', 'displayName email image');

        res.json({
            connectedUsersCount: connectedUsers.size,
            recentSessions: recentSessions
        });
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ message: 'Failed to fetch dashboard data.' });
    }
});

app.get('/api/admin/subscribers', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const subscribers = await Subscriber.find().sort({ subscribedAt: -1 });
        res.json(subscribers);
    } catch (error) {
        console.error('Error fetching subscribers:', error);
        res.status(500).json({ message: 'Failed to fetch subscribers.' });
    }
});

app.get('/api/admin/subscribers/csv', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const subscribers = await Subscriber.find().sort({ subscribedAt: -1 });
        if (!subscribers || subscribers.length === 0) {
            return res.status(404).send('No subscribers found.');
        }

        const fields = ['displayName', 'email', 'subscribedAt'];
        const csvHeader = fields.join(',') + '\n';

        const csvRows = subscribers.map(sub => {
            return [
                `"${sub.displayName.replace(/"/g, '""')}"`, // Handle quotes in names
                `"${sub.email}"`,
                `"${sub.subscribedAt.toISOString()}"`
            ].join(',');
        }).join('\n');

        const csv = csvHeader + csvRows;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="subscribers.csv"');
        res.status(200).send(csv);

    } catch (error) {
        console.error('Error exporting subscribers to CSV:', error
