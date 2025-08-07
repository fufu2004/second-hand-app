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

// --- START: New Shop Model ---
const ShopSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    logoUrl: { type: String },
    createdAt: { type: Date, default: Date.now }
});
const Shop = mongoose.model('Shop', ShopSchema);
// --- END: New Shop Model ---

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
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' } // Link to the shop
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
    type: { type: String, required: true, enum: ['new-message', 'new-rating', 'new-follower'] },
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
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid token.' });
        req.user = user;
        next();
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
    const payload = { id: req.user._id, name: req.user.displayName, email: req.user.email };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
    res.redirect(`${CLIENT_URL}?token=${token}`);
});

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
        console.error('Error exporting subscribers to CSV:', error);
        res.status(500).json({ message: 'Failed to export subscribers.' });
    }
});


app.get('/api/vapid-public-key', (req, res) => {
    res.send(VAPID_PUBLIC_KEY);
});

app.post('/api/log-sw', (req, res) => {
    const { message } = req.body;
    console.log(`[SW LOG FROM CLIENT]: ${message}`);
    res.status(200).send({ status: 'logged' });
});

app.get('/items', async (req, res) => {
    try {
        await Item.updateMany(
            { isPromoted: true, promotedUntil: { $lt: new Date() } },
            { $set: { isPromoted: false }, $unset: { promotedUntil: "" } }
        );

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const filters = {};
        if (req.query.category && req.query.category !== 'all') filters.category = req.query.category;
        if (req.query.condition && req.query.condition !== 'all') filters.condition = req.query.condition;
        if (req.query.size) filters.size = { $regex: req.query.size.trim(), $options: 'i' };
        if (req.query.minPrice) filters.price = { ...filters.price, $gte: parseInt(req.query.minPrice) };
        if (req.query.maxPrice) filters.price = { ...filters.price, $lte: parseInt(req.query.maxPrice) };
        if (req.query.searchTerm) filters.title = { $regex: req.query.searchTerm.trim(), $options: 'i' };
        if (req.query.brand) filters.brand = { $regex: req.query.brand.trim(), $options: 'i' };
        if (req.query.location) filters.location = { $regex: req.query.location.trim(), $options: 'i' };

        const sortOptions = {};
        sortOptions.isPromoted = -1; 
        switch (req.query.sort) {
            case 'price_asc':
                sortOptions.price = 1;
                break;
            case 'price_desc':
                sortOptions.price = -1;
                break;
            default:
                sortOptions.createdAt = -1;
        }
        
        const items = await Item.find(filters)
            .populate('owner', 'displayName email isVerified')
            .sort(sortOptions)
            .skip(skip)
            .limit(limit);
        
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

app.get('/items/my-items', authMiddleware, async (req, res) => { try { const items = await Item.find({ owner: req.user.id }).populate('owner', 'displayName email isVerified').sort({ createdAt: -1 }); res.json(items); } catch (err) { res.status(500).json({ message: err.message }); } });

app.get('/users/:id/items', async (req, res) => { 
    try { 
        const items = await Item.find({ owner: req.params.id }).populate('owner', 'displayName email isVerified').sort({ createdAt: -1 }); 
        res.json(items); 
    } catch (err) { 
        res.status(500).json({ message: err.message }); 
    } 
});

app.get('/users/:id', async (req, res) => { 
    try { 
        const user = await User.findById(req.params.id).select('displayName image averageRating followers following isVerified'); 
        if (!user) return res.status(404).json({ message: 'User not found' }); 
        res.json(user); 
    } catch (err) { 
        res.status(500).json({ message: err.message }); 
    } 
});

app.get('/users/:id/ratings', async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .populate({
                path: 'ratings',
                populate: {
                    path: 'rater',
                    select: 'displayName image'
                }
            });
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json(user.ratings.sort((a, b) => b.createdAt - a.createdAt));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.post('/users/:id/rate', authMiddleware, async (req, res) => {
    const { rating, comment } = req.body;
    const raterId = req.user.id;
    const ratedUserId = req.params.id;

    if (raterId === ratedUserId) {
        return res.status(400).json({ message: "You cannot rate yourself." });
    }

    try {
        const userToRate = await User.findById(ratedUserId);
        if (!userToRate) return res.status(404).json({ message: "User to be rated not found." });
        
        const rater = await User.findById(raterId);

        const existingRatingIndex = userToRate.ratings.findIndex(r => r.rater.toString() === raterId);
        if (existingRatingIndex > -1) {
            userToRate.ratings.splice(existingRatingIndex, 1);
        }

        userToRate.ratings.push({ rater: raterId, rating, comment });

        if (userToRate.ratings.length > 0) {
            const totalRating = userToRate.ratings.reduce((acc, r) => acc + r.rating, 0);
            userToRate.averageRating = totalRating / userToRate.ratings.length;
        } else {
            userToRate.averageRating = 0;
        }
        
        await userToRate.save();

        const notification = new Notification({
            user: ratedUserId,
            type: 'new-rating',
            message: `${rater.displayName} דירג אותך ${rating} כוכבים.`,
            link: `/profile/${ratedUserId}`,
            fromUser: raterId
        });
        await notification.save();
        io.to(ratedUserId).emit('newNotification', notification);

        res.status(201).json({ message: "Rating submitted successfully", averageRating: userToRate.averageRating });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.post('/api/users/start-verification', authMiddleware, (req, res) => {
    res.status(200).json({ message: 'Verification feature is coming soon! Stay tuned.' });
});

app.patch('/api/users/:id/set-verified', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { isVerified } = req.body;
        const user = await User.findByIdAndUpdate(req.params.id, { isVerified: isVerified }, { new: true });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json({ message: `User verification status set to ${isVerified}`, user });
    } catch (error) {
        console.error("Error setting verification status:", error);
        res.status(500).json({ message: 'Server error.' });
    }
});

app.get('/api/my-favorites', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('favorites');
        res.json(user.favorites);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.post('/api/favorites/:itemId', authMiddleware, async (req, res) => {
    try {
        const itemId = req.params.itemId;
        const user = await User.findById(req.user.id);
        
        const index = user.favorites.indexOf(itemId);
        if (index > -1) {
            user.favorites.splice(index, 1);
        } else {
            user.favorites.push(itemId);
        }
        
        await user.save();
        res.json(user.favorites);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.post('/api/users/:id/follow', authMiddleware, async (req, res) => {
    const currentUserId = req.user.id;
    const targetUserId = req.params.id;

    if (currentUserId === targetUserId) {
        return res.status(400).json({ message: "You cannot follow yourself." });
    }

    try {
        const currentUser = await User.findById(currentUserId);
        const targetUser = await User.findById(targetUserId);

        if (!targetUser) {
            return res.status(404).json({ message: "User not found." });
        }

        const isFollowing = currentUser.following.includes(targetUserId);

        if (isFollowing) {
            await User.updateOne({ _id: currentUserId }, { $pull: { following: targetUserId } });
            await User.updateOne({ _id: targetUserId }, { $pull: { followers: currentUserId } });
        } else {
            await User.updateOne({ _id: currentUserId }, { $addToSet: { following: targetUserId } });
            await User.updateOne({ _id: targetUserId }, { $addToSet: { followers: currentUserId } });

            const notification = new Notification({
                user: targetUserId,
                type: 'new-follower',
                message: `${currentUser.displayName} התחיל לעקוב אחריך.`,
                link: `/profile/${currentUserId}`,
                fromUser: currentUserId
            });
            await notification.save();
            io.to(targetUserId).emit('newNotification', notification);
        }

        res.status(200).json({ isFollowing: !isFollowing });

    } catch (error) {
        console.error("Error during follow/unfollow:", error);
        res.status(500).json({ message: "Server error during follow operation." });
    }
});


app.post('/items', authMiddleware, upload.array('images', 6), async (req, res) => {
    try {
        const uploadPromises = req.files.map(file => uploadToCloudinary(file.buffer));
        const uploadResults = await Promise.all(uploadPromises);
        const imageUrls = uploadResults.map(result => result.secure_url);

        const newItemData = { 
            title: req.body.title, 
            description: req.body.description, 
            price: req.body.price, 
            category: req.body.category, 
            contact: req.body.contact, 
            imageUrls: imageUrls,
            owner: req.user.id,
            condition: req.body.condition,
            size: req.body.size,
            brand: req.body.brand,
            location: req.body.location
        };

        if (req.user.email === ADMIN_EMAIL) {
            if (req.body.affiliateLink) newItemData.affiliateLink = req.body.affiliateLink;
            newItemData.isPromoted = req.body.isPromoted === 'on';
        }
        
        const newItem = new Item(newItemData);
        const savedItem = await newItem.save();
        const populatedItem = await Item.findById(savedItem._id).populate('owner', 'displayName email isVerified');
        io.emit('newItem', populatedItem);
        res.status(201).json(populatedItem);

        // --- הפעלת שליחת המייל ---
        newItemCounter++;
        console.log(`New item posted. Counter is now at: ${newItemCounter}`);
        if (newItemCounter >= 20) {
            sendNewsletterUpdate();
            newItemCounter = 0; // Reset the counter
            console.log('Newsletter triggered and counter reset.');
        }

    } catch (err) {
        console.error("Error uploading item:", err);
        res.status(400).json({ message: err.message });
    }
});

app.patch('/items/:id', authMiddleware, upload.array('images', 6), async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        if (!item) return res.status(404).json({ message: 'Item not found' });
        const isOwner = item.owner && item.owner.toString() === req.user.id;
        const isAdmin = req.user.email === ADMIN_EMAIL;
        if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Not authorized' });

        const updateData = { ...req.body };
        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map(file => uploadToCloudinary(file.buffer));
            const uploadResults = await Promise.all(uploadPromises);
            updateData.imageUrls = uploadResults.map(result => result.secure_url);
        }

        if (isAdmin) {
             if (req.body.affiliateLink) updateData.affiliateLink = req.body.affiliateLink;
             updateData.isPromoted = req.body.isPromoted === 'on';
        } else {
            delete updateData.affiliateLink;
            delete updateData.isPromoted;
        }

        const updatedItem = await Item.findByIdAndUpdate(req.params.id, updateData, { new: true }).populate('owner', 'displayName email isVerified');
        io.emit('itemUpdated', updatedItem);
        res.json(updatedItem);
    } catch (err) {
        console.error("Error updating item:", err);
        res.status(400).json({ message: err.message });
    }
});

app.patch('/items/:id/sold', authMiddleware, async (req, res) => { try { const item = await Item.findById(req.params.id); if (!item) return res.status(404).json({ message: 'Item not found' }); const isOwner = item.owner && item.owner.toString() === req.user.id; const isAdmin = req.user.email === ADMIN_EMAIL; if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Not authorized' }); item.sold = req.body.sold; await item.save(); const updatedItem = await Item.findById(item._id).populate('owner', 'displayName email isVerified'); io.emit('itemUpdated', updatedItem); res.json(updatedItem); } catch (err) { res.status(400).json({ message: err.message }); } });
app.delete('/items/:id', authMiddleware, async (req, res) => { try { const item = await Item.findById(req.params.id); if (!item) return res.status(404).json({ message: 'Item not found' }); const isOwner = item.owner && item.owner.toString() === req.user.id; const isAdmin = req.user.email === ADMIN_EMAIL; if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Not authorized' }); await Item.findByIdAndDelete(req.params.id); io.emit('itemDeleted', req.params.id); res.json({ message: 'Item deleted' }); } catch (err) { res.status(500).json({ message: err.message }); } });

app.post('/api/items/:id/report', authMiddleware, async (req, res) => {
    try {
        const { reason, details } = req.body;
        const reporterId = req.user.id;
        const reportedItemId = req.params.id;

        const item = await Item.findById(reportedItemId);
        if (!item) {
            return res.status(404).json({ message: 'Item not found.' });
        }

        if (item.owner.toString() === reporterId) {
            return res.status(400).json({ message: 'You cannot report your own item.' });
        }

        const newReport = new Report({
            reporter: reporterId,
            reportedItem: reportedItemId,
            reason: reason,
            details: details
        });

        await newReport.save();
        
        if (SENDGRID_API_KEY && SENDER_EMAIL_ADDRESS) {
            const reporter = await User.findById(reporterId);
            const msg = {
                to: ADMIN_EMAIL,
                from: SENDER_EMAIL_ADDRESS,
                subject: `New Item Report on "סטייל מתגלגל"`,
                html: `
                    <h2>New Item Report</h2>
                    <p><strong>Reporter:</strong> ${reporter.displayName} (${reporter.email})</p>
                    <p><strong>Reported Item:</strong> ${item.title} (ID: ${item._id})</p>
                    <p><strong>Reason:</strong> ${reason}</p>
                    <p><strong>Details:</strong> ${details || 'No details provided.'}</p>
                    <p><a href="${CLIENT_URL}">Go to the site</a></p>
                `
            };
            sgMail.send(msg).catch(error => console.error("Failed to send report email:", error));
        }

        res.status(201).json({ message: 'Report submitted successfully.' });

    } catch (error) {
        console.error("Error submitting report:", error);
        res.status(500).json({ message: 'Failed to submit report.' });
    }
});

app.post('/api/items/:id/promote', authMiddleware, async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'Item not found.' });
        }
        if (item.owner.toString() !== req.user.id) {
            return res.status(403).json({ message: 'You can only promote your own items.' });
        }

        const paymentSuccessful = true;

        if (paymentSuccessful) {
            item.isPromoted = true;
            item.promotedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); 
            await item.save();

            const updatedItem = await Item.findById(item._id).populate('owner', 'displayName email isVerified');
            io.emit('itemUpdated', updatedItem);
            
            res.status(200).json({ message: 'Item promoted successfully!', item: updatedItem });
        } else {
            res.status(400).json({ message: 'Payment failed.' });
        }

    } catch (error) {
        console.error("Error promoting item:", error);
        res.status(500).json({ message: 'Failed to promote item.' });
    }
});


// --- Chat Routes ---
app.post('/api/conversations', authMiddleware, async (req, res) => {
    const { sellerId, itemId } = req.body;
    const buyerId = req.user.id;

    if (sellerId === buyerId) {
        return res.status(400).json({ message: "You cannot start a conversation with yourself." });
    }

    try {
        let conversation = await Conversation.findOne({
            participants: { $all: [buyerId, sellerId] },
            item: itemId
        });

        if (!conversation) {
            conversation = new Conversation({
                participants: [buyerId, sellerId],
                item: itemId
            });
            await conversation.save();
            
            const newConversation = await Conversation.findById(conversation._id)
                .populate('participants', 'displayName email image')
                .populate('item', 'title');

            const seller = newConversation.participants.find(p => p._id.toString() === sellerId);
            const buyer = newConversation.participants.find(p => p._id.toString() === buyerId);

            if (seller && buyer) {
                 io.to(sellerId).emit('newConversation', {
                    conversationId: newConversation._id,
                    buyerName: buyer.displayName,
                    itemName: newConversation.item.title
                });
            }
            return res.status(201).json(newConversation);
        }
        
        const existingConversation = await Conversation.findById(conversation._id)
            .populate('participants', 'displayName email image')
            .populate('item');

        res.status(200).json(existingConversation);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.get('/api/my-conversations', authMiddleware, async (req, res) => {
    try {
        const conversations = await Conversation.find({ participants: req.user.id })
            .populate('participants', 'displayName email image')
            .populate('item', 'title imageUrls')
            .sort({ updatedAt: -1 });
        
        res.json(conversations);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.get('/api/conversations/:id', authMiddleware, async (req, res) => {
    try {
        const conversation = await Conversation.findById(req.params.id)
            .populate('participants', 'displayName email image')
            .populate('item', 'title');
        
        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        const isParticipant = conversation.participants.some(p => p._id.toString() === req.user.id);
        if (!isParticipant) {
            return res.status(403).json({ message: 'Not authorized to view this conversation' });
        }

        res.json(conversation);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


app.get('/api/conversations/:id/messages', authMiddleware, async (req, res) => {
    try {
        const messages = await Message.find({ conversation: req.params.id }).populate('sender', 'displayName image').sort('createdAt');
        res.json(messages);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// *** Notification Routes ***
app.get('/api/notifications', authMiddleware, async (req, res) => {
    try {
        const notifications = await Notification.find({ user: req.user.id })
            .populate('fromUser', 'displayName image')
            .sort({ createdAt: -1 })
            .limit(20);
        res.json(notifications);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.post('/api/notifications/mark-as-read', authMiddleware, async (req, res) => {
    try {
        await Notification.updateMany({ user: req.user.id, isRead: false }, { isRead: true });
        res.status(200).json({ message: 'Notifications marked as read.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// *** Push Notification Subscription Routes ***
app.post('/api/subscribe', authMiddleware, async (req, res) => {
    const subscription = req.body;
    try {
        const existingSubscription = await PushSubscription.findOne({ 'subscription.endpoint': subscription.endpoint });
        if (existingSubscription) {
            return res.status(200).json({ message: 'Subscription already exists.' });
        }

        const newSubscription = new PushSubscription({
            user: req.user.id,
            subscription: subscription
        });
        await newSubscription.save();
        res.status(201).json({ message: 'Subscription saved successfully.' });
    } catch (error) {
        console.error("Error saving subscription:", error);
        res.status(500).json({ message: 'Failed to save subscription.' });
    }
});

app.post('/api/unsubscribe', authMiddleware, async (req, res) => {
    const { endpoint } = req.body;
    try {
        await PushSubscription.deleteOne({ 'subscription.endpoint': endpoint, user: req.user.id });
        res.status(200).json({ message: 'Subscription removed successfully.' });
    } catch (error) {
        console.error("Error removing subscription:", error);
        res.status(500).json({ message: 'Failed to remove subscription.' });
    }
});


// --- הגדרת Socket.io ---
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next();
    }
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return next();
        }
        socket.user = user;
        next();
    });
});

io.on('connection', async (socket) => { 
    if (socket.user) {
        socket.join(socket.user.id);
        
        // --- START: Track User Connection ---
        const session = new UserSession({ user: socket.user.id });
        await session.save();
        socket.sessionId = session._id; // Store session ID on the socket
        
        connectedUsers.set(socket.id, {
            userId: socket.user.id,
            name: socket.user.name,
            sessionId: socket.sessionId
        });
        console.log(`User ${socket.user.name} connected. Total connected: ${connectedUsers.size}`);
        // --- END: Track User Connection ---

    } else {
        console.log('An anonymous user connected:', socket.id);
    }

    socket.on('sendMessage', async (data) => {
        try {
            const { conversationId, senderId, receiverId, text } = data;
            
            if (!socket.user || socket.user.id !== senderId) {
                return socket.emit('auth_error', 'Authentication mismatch. Please log in again.');
            }

            const message = new Message({
                conversation: conversationId,
                sender: senderId,
                receiver: receiverId,
                text: text
            });
            await message.save();

            await Conversation.findByIdAndUpdate(conversationId, { updatedAt: new Date() });
            
            const populatedMessage = await Message.findById(message._id).populate('sender', 'displayName image');
            
            io.to(senderId).emit('newMessage', populatedMessage);
            io.to(receiverId).emit('newMessage', populatedMessage);

            const sender = await User.findById(senderId);
            const notification = new Notification({
                user: receiverId,
                type: 'new-message',
                message: `הודעה חדשה מ-${sender.displayName}`,
                link: `/chat/${conversationId}`,
                fromUser: senderId
            });
            await notification.save();
            io.to(receiverId).emit('newNotification', notification);
            
            try {
                const receiver = await User.findById(receiverId);
                const conversation = await Conversation.findById(conversationId).populate('item', 'title');

                if (receiver && receiver.email && conversation && conversation.item && SENDGRID_API_KEY) {
                    const msg = {
                        to: receiver.email,
                        from: { name: 'סטייל מתגלגל', email: SENDER_EMAIL_ADDRESS },
                        subject: `קיבלת הודעה חדשה מ${sender.displayName} בנוגע לפריט "${conversation.item.title}"`,
                        html: `...` // (HTML content remains the same)
                    };
                    sgMail.send(msg).catch(error => console.error("Failed to send new message email:", error.toString()));
                }
            } catch (emailError) {
                console.error('Error preparing email notification:', emailError);
            }

            const pushPayload = JSON.stringify({
                title: `הודעה חדשה מ-${sender.displayName}`,
                body: text,
                icon: sender.image || 'https://raw.githubusercontent.com/fufu2004/second-hand-app/main/ChatGPT%20Image%20Jul%2023%2C%202025%2C%2010_44_20%20AM%20copy.png',
                data: { url: `${CLIENT_URL}?openChat=${conversationId}` }
            });
            
            const userSubscriptions = await PushSubscription.find({ user: receiverId });

            if (userSubscriptions.length > 0) {
                userSubscriptions.forEach(sub => {
                    webPush.sendNotification(sub.subscription, pushPayload)
                        .catch(async (err) => {
                            if (err.statusCode === 410) {
                                await PushSubscription.findByIdAndDelete(sub._id);
                            } else {
                                console.error('[PUSH DEBUG] Error sending push notification:', err.body);
                            }
                        });
                });
            }

        } catch (error) {
            console.error('Error sending message:', error);
        }
    });

    socket.on('disconnect', async () => { 
        // --- START: Track User Disconnection ---
        if (connectedUsers.has(socket.id)) {
            const { name, sessionId } = connectedUsers.get(socket.id);
            connectedUsers.delete(socket.id);
            console.log(`User ${name} disconnected. Total connected: ${connectedUsers.size}`);
            
            if (sessionId) {
                await UserSession.findByIdAndUpdate(sessionId, { logoutAt: new Date() });
            }
        } else {
            console.log('An anonymous user disconnected');
        }
        // --- END: Track User Disconnection ---
    }); 
});

// --- נתיב להגשת קובץ ה-HTML ---
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

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
