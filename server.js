// server.js

// 1. ייבוא ספריות נדרשות
require('dotenv').config(); // טוען משתני סביבה מקובץ .env
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
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
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
    condition: { type: String, enum: ['new-with-tags', 'new-without-tags', 'like-new', 'good', 'used'], default: 'good' },
    size: { type: String, trim: true },
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
    type: { type: String, required: true, enum: ['new-message', 'new-rating', 'new-follower', 'new-offer', 'offer-accepted', 'offer-rejected', 'counter-offer'] },
    message: { type: String, required: true },
    link: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
const Notification = mongoose.model('Notification', NotificationSchema);

const OfferSchema = new mongoose.Schema({
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    offerPrice: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'accepted', 'rejected', 'countered'], default: 'pending' },
    counterPrice: { type: Number },
}, { timestamps: true });
const Offer = mongoose.model('Offer', OfferSchema);


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

app.get('/items', async (req, res) => { try { const items = await Item.find().populate('owner', 'displayName email').sort({ createdAt: -1 }); res.json(items); } catch (err) { res.status(500).json({ message: err.message }); } });
app.get('/items/my-items', authMiddleware, async (req, res) => { try { const items = await Item.find({ owner: req.user.id }).populate('owner', 'displayName email').sort({ createdAt: -1 }); res.json(items); } catch (err) { res.status(500).json({ message: err.message }); } });

// --- נתיבים לפרופיל ציבורי ודירוגים ---
app.get('/users/:id/items', async (req, res) => { 
    try { 
        const items = await Item.find({ owner: req.params.id }).populate('owner', 'displayName email').sort({ createdAt: -1 }); 
        res.json(items); 
    } catch (err) { 
        res.status(500).json({ message: err.message }); 
    } 
});

app.get('/users/:id', async (req, res) => { 
    try { 
        const user = await User.findById(req.params.id).select('displayName image averageRating followers following'); 
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

// --- Routes for Favorites ---
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

// *** NEW: Follow/Unfollow Route ***
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
            // Unfollow
            await User.updateOne({ _id: currentUserId }, { $pull: { following: targetUserId } });
            await User.updateOne({ _id: targetUserId }, { $pull: { followers: currentUserId } });
        } else {
            // Follow
            await User.updateOne({ _id: currentUserId }, { $addToSet: { following: targetUserId } });
            await User.updateOne({ _id: targetUserId }, { $addToSet: { followers: currentUserId } });

            // Create notification
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
            size: req.body.size
        };

        if (req.user.email === ADMIN_EMAIL) {
            if (req.body.affiliateLink) newItemData.affiliateLink = req.body.affiliateLink;
            newItemData.isPromoted = req.body.isPromoted === 'on';
        }
        
        const newItem = new Item(newItemData);
        const savedItem = await newItem.save();
        const populatedItem = await Item.findById(savedItem._id).populate('owner', 'displayName email');
        io.emit('newItem', populatedItem);
        res.status(201).json(populatedItem);
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

        const updatedItem = await Item.findByIdAndUpdate(req.params.id, updateData, { new: true }).populate('owner', 'displayName email');
        io.emit('itemUpdated', updatedItem);
        res.json(updatedItem);
    } catch (err) {
        console.error("Error updating item:", err);
        res.status(400).json({ message: err.message });
    }
});

app.patch('/items/:id/sold', authMiddleware, async (req, res) => { try { const item = await Item.findById(req.params.id); if (!item) return res.status(404).json({ message: 'Item not found' }); const isOwner = item.owner && item.owner.toString() === req.user.id; const isAdmin = req.user.email === ADMIN_EMAIL; if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Not authorized' }); item.sold = req.body.sold; await item.save(); const updatedItem = await Item.findById(item._id).populate('owner', 'displayName email'); io.emit('itemUpdated', updatedItem); res.json(updatedItem); } catch (err) { res.status(400).json({ message: err.message }); } });
app.delete('/items/:id', authMiddleware, async (req, res) => { try { const item = await Item.findById(req.params.id); if (!item) return res.status(404).json({ message: 'Item not found' }); const isOwner = item.owner && item.owner.toString() === req.user.id; const isAdmin = req.user.email === ADMIN_EMAIL; if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Not authorized' }); await Item.findByIdAndDelete(req.params.id); io.emit('itemDeleted', req.params.id); res.json({ message: 'Item deleted' }); } catch (err) { res.status(500).json({ message: err.message }); } });

// *** Report Item Endpoint ***
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

// --- NEW: Offer Routes ---
app.post('/api/offers', authMiddleware, async (req, res) => {
    const { itemId, sellerId, offerPrice } = req.body;
    const buyerId = req.user.id;

    try {
        const item = await Item.findById(itemId);
        if (!item || item.sold) {
            return res.status(404).json({ message: 'Item not available or already sold.' });
        }
        if (item.owner.toString() !== sellerId) {
            return res.status(400).json({ message: 'Seller ID does not match item owner.' });
        }
        if (buyerId === sellerId) {
            return res.status(400).json({ message: 'You cannot make an offer on your own item.' });
        }

        const newOffer = new Offer({
            item: itemId,
            buyer: buyerId,
            seller: sellerId,
            offerPrice: offerPrice
        });

        await newOffer.save();
        
        const buyer = await User.findById(buyerId);
        const notification = new Notification({
            user: sellerId,
            type: 'new-offer',
            message: `${buyer.displayName} הציע/ה ₪${offerPrice} על הפריט "${item.title}".`,
            link: `/offers`,
            fromUser: buyerId
        });
        await notification.save();
        io.to(sellerId).emit('newNotification', notification);
        io.to(sellerId).to(buyerId).emit('offerUpdated');

        res.status(201).json(newOffer);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.get('/api/offers/received', authMiddleware, async (req, res) => {
    try {
        const offers = await Offer.find({ seller: req.user.id })
            .populate('item', 'title imageUrls price')
            .populate('buyer', 'displayName image')
            .sort({ createdAt: -1 });
        res.json(offers);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.get('/api/offers/sent', authMiddleware, async (req, res) => {
    try {
        const offers = await Offer.find({ buyer: req.user.id })
            .populate('item', 'title imageUrls price')
            .populate('seller', 'displayName image')
            .sort({ createdAt: -1 });
        res.json(offers);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.patch('/api/offers/:id', authMiddleware, async (req, res) => {
    const { status, counterPrice } = req.body;
    const offerId = req.params.id;
    const currentUserId = req.user.id;

    try {
        const offer = await Offer.findById(offerId).populate('item').populate('buyer').populate('seller');
        if (!offer) {
            return res.status(404).json({ message: 'Offer not found.' });
        }
        if (offer.seller._id.toString() !== currentUserId) {
            return res.status(403).json({ message: 'Only the seller can respond to an offer.' });
        }

        offer.status = status;
        let notification;

        if (status === 'accepted') {
            await Item.findByIdAndUpdate(offer.item._id, { sold: true });
            io.emit('itemUpdated', await Item.findById(offer.item._id).populate('owner', 'displayName email'));
            
            notification = new Notification({
                user: offer.buyer._id,
                type: 'offer-accepted',
                message: `ההצעה שלך על "${offer.item.title}" התקבלה!`,
                link: `/offers`,
                fromUser: currentUserId
            });

        } else if (status === 'rejected') {
             notification = new Notification({
                user: offer.buyer._id,
                type: 'offer-rejected',
                message: `ההצעה שלך על "${offer.item.title}" נדחתה.`,
                link: `/offers`,
                fromUser: currentUserId
            });
        } else if (status === 'countered' && counterPrice) {
            offer.counterPrice = counterPrice;
            notification = new Notification({
                user: offer.buyer._id,
                type: 'counter-offer',
                message: `${offer.seller.displayName} הגיש/ה הצעה נגדית על "${offer.item.title}".`,
                link: `/offers`,
                fromUser: currentUserId
            });
        } else {
            return res.status(400).json({ message: 'Invalid status or missing counter price.' });
        }

        await offer.save();
        await notification.save();
        io.to(offer.buyer._id.toString()).emit('newNotification', notification);
        io.to(offer.seller._id.toString()).to(offer.buyer._id.toString()).emit('offerUpdated');
        
        res.json(offer);
    } catch (err) {
        res.status(500).json({ message: err.message });
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
            console.log("Socket connection with invalid token.");
            return next();
        }
        socket.user = user;
        next();
    });
});

io.on('connection', (socket) => { 
    if (socket.user) {
        socket.join(socket.user.id);
        console.log(`Socket ${socket.id} for user ${socket.user.name} connected and joined room ${socket.user.id}.`);
    } else {
        console.log('An anonymous user connected:', socket.id);
    }

    socket.on('sendMessage', async (data) => {
        try {
            const { conversationId, senderId, receiverId, text } = data;
            
            if (!socket.user || socket.user.id !== senderId) {
                console.error("Socket user does not match senderId. Aborting message send.");
                socket.emit('auth_error', 'Authentication mismatch. Please log in again.');
                return;
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

            if (SENDGRID_API_KEY && SENDER_EMAIL_ADDRESS) {
                try {
                    const receiver = await User.findById(receiverId);
                    const conversation = await Conversation.findById(conversationId).populate('item', 'title');

                    if (!receiver || !sender || !conversation) {
                        throw new Error("Could not find all details for email notification.");
                    }

                    const msg = {
                        to: receiver.email,
                        from: {
                            email: SENDER_EMAIL_ADDRESS,
                            name: 'סטייל מתגלגל'
                        },
                        subject: `הודעה חדשה מ${sender.displayName} על "${conversation.item.title}"`,
                        html: `<div dir="rtl">...</div>`,
                        text: `הודעה חדשה מ${sender.displayName} על "${conversation.item.title}"`
                    };

                    await sgMail.send(msg);
                    console.log(`Email sent successfully to ${receiver.email}`);

                } catch (emailError) {
                    console.error("Failed to send email notification via SendGrid:", emailError.response ? emailError.response.body : emailError);
                }
            }

        } catch (error) {
            console.error('Error sending message:', error);
        }
    });

    socket.on('disconnect', () => { 
        if (socket.user) {
            console.log(`User ${socket.user.name} disconnected`);
        } else {
            console.log('An anonymous user disconnected');
        }
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
