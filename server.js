// server.js

// 1. ייבוא ספריות נדרשות
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

// --- הגדרת Cloudinary ---
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

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
        rating: { type: Number, min: 1, max: 5 },
        comment: String,
        createdAt: { type: Date, default: Date.now }
    }],
    averageRating: { type: Number, default: 0 }
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
    createdAt: { type: Date, default: Date.now } 
});
const Item = mongoose.model('Item', ItemSchema);

const ConversationSchema = new mongoose.Schema({
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
    lastMessage: { type: String },
    updatedAt: { type: Date, default: Date.now }
});
const Conversation = mongoose.model('Conversation', ConversationSchema);

const MessageSchema = new mongoose.Schema({
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);


// --- הגדרות העלאת קבצים ---
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- הגדרת Middleware ---
app.use(cors());
app.use(express.json());
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
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
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
app.get('/users/:id/items', async (req, res) => { try { const items = await Item.find({ owner: req.params.id }).populate('owner', 'displayName email').sort({ createdAt: -1 }); res.json(items); } catch (err) { res.status(500).json({ message: err.message }); } });
app.get('/users/:id', async (req, res) => { try { const user = await User.findById(req.params.id).select('displayName image averageRating'); if (!user) return res.status(404).json({ message: 'User not found' }); res.json(user); } catch (err) { res.status(500).json({ message: err.message }); } });


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
            owner: req.user.id 
        };

        if (req.user.email === ADMIN_EMAIL) {
            if (req.body.affiliateLink) newItemData.affiliateLink = req.body.affiliateLink;
            if (req.body.isPromoted) newItemData.isPromoted = req.body.isPromoted === 'true';
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
             if (req.body.isPromoted) updateData.isPromoted = req.body.isPromoted === 'true';
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
        }).populate('participants', 'displayName email image').populate('item');

        if (!conversation) {
            conversation = new Conversation({
                participants: [buyerId, sellerId],
                item: itemId
            });
            await conversation.save();
            conversation = await Conversation.findById(conversation._id).populate('participants', 'displayName email image').populate('item');
        }
        res.status(200).json(conversation);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// NEW ROUTE to get a single conversation's details
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

// --- הגדרת Socket.io ---
io.on('connection', (socket) => { 
    console.log('a user connected:', socket.id);

    socket.on('joinUserRoom', (userId) => {
        socket.join(userId);
        console.log(`User ${userId} joined their room.`);
    });

    socket.on('sendMessage', async (data) => {
        try {
            const { conversationId, senderId, receiverId, text } = data;
            const message = new Message({
                conversation: conversationId,
                sender: senderId,
                receiver: receiverId,
                text: text
            });
            await message.save();
            
            const populatedMessage = await Message.findById(message._id).populate('sender', 'displayName image');
            
            io.to(senderId).to(receiverId).emit('newMessage', populatedMessage);
        } catch (error) {
            console.error('Error sending message:', error);
        }
    });

    socket.on('disconnect', () => { console.log('user disconnected'); }); 
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
