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
const sgMail = require('@sendgrid/mail'); // ייבוא הספרייה של SendGrid
const path = require('path'); // הוספת המודול 'path'

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
const SENDER_EMAIL_ADDRESS = process.env.SENDER_EMAIL_ADDRESS; // המייל שאומת ב-SendGrid

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
    console.warn("SendGrid is not configured. Missing SENDGRID_API_KEY or SENDER_EMAIL_ADDRESS environment variables. Email notifications will be disabled.");
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
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }] // NEW: Server-side favorites
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
    // NEW: Fields for advanced filtering
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


// --- הגדרות העלאת קבצים ---
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- הגדרת Middleware ---
app.use(cors());
app.use(express.json());

// --- הוספת הקוד להגשת קבצים סטטיים ---
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
        const user = await User.findById(req.params.id).select('displayName image averageRating'); 
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
                    select: 'displayName image' // Select fields from the rater
                }
            });
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json(user.ratings.sort((a, b) => b.createdAt - a.createdAt)); // Send sorted ratings
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

        // Find if the user has already rated and remove the old rating
        const existingRatingIndex = userToRate.ratings.findIndex(r => r.rater.toString() === raterId);
        if (existingRatingIndex > -1) {
            userToRate.ratings.splice(existingRatingIndex, 1);
        }

        // Add the new rating
        userToRate.ratings.push({ rater: raterId, rating, comment });

        // Recalculate average rating
        if (userToRate.ratings.length > 0) {
            const totalRating = userToRate.ratings.reduce((acc, r) => acc + r.rating, 0);
            userToRate.averageRating = totalRating / userToRate.ratings.length;
        } else {
            userToRate.averageRating = 0;
        }
        
        await userToRate.save();
        res.status(201).json({ message: "Rating submitted successfully", averageRating: userToRate.averageRating });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// --- NEW: Routes for Favorites ---
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
            // Item is already a favorite, so remove it
            user.favorites.splice(index, 1);
        } else {
            // Item is not a favorite, so add it
            user.favorites.push(itemId);
        }
        
        await user.save();
        res.json(user.favorites); // Return the updated list of favorites
    } catch (err) {
        res.status(500).json({ message: err.message });
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
            // NEW: Add new fields from form
            condition: req.body.condition,
            size: req.body.size
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
        });

        if (!conversation) {
            conversation = new Conversation({
                participants: [buyerId, sellerId],
                item: itemId
            });
            await conversation.save();
            
            // Populate after saving to get all details for the notification
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

// --- הגדרת Socket.io ---
// Middleware for authenticating socket connections
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

            // --- שליחת התראה במייל עם SendGrid ---
            if (SENDGRID_API_KEY && SENDER_EMAIL_ADDRESS) {
                try {
                    const receiver = await User.findById(receiverId);
                    const sender = await User.findById(senderId);
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
                        html: `
                            <div dir="rtl" style="font-family: Assistant, sans-serif; text-align: right; padding: 20px; border: 1px solid #ddd; border-radius: 8px; max-width: 600px; margin: auto;">
                                <h2 style="color: #14b8a6;">היי ${receiver.displayName},</h2>
                                <p>קיבלת הודעה חדשה מ<strong>${sender.displayName}</strong> בנוגע לפריט "<strong>${conversation.item.title}</strong>".</p>
                                <div style="background-color: #f7f7f7; padding: 15px; border-radius: 5px; margin: 15px 0;">
                                    <p style="margin: 0;"><strong>תוכן ההודעה:</strong> "${text}"</p>
                                </div>
                                <p>כדי להשיב, היכנס/י לאתר ולחצ/י על כפתור "הודעות":</p>
                                <a href="${CLIENT_URL}" style="display: inline-block; padding: 12px 24px; background-color: #14b8a6; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">לצ'אט באתר</a>
                                <hr style="margin-top: 20px; border: none; border-top: 1px solid #eee;">
                                <p style="font-size: 12px; color: #888;">זוהי הודעה אוטומטית. אין להשיב למייל זה.</p>
                            </div>
                        `,
                        text: `היי ${receiver.displayName},\n\nקיבלת הודעה חדשה מ${sender.displayName} בנוגע לפריט "${conversation.item.title}".\n\nתוכן ההודעה: "${text}"\n\nכדי להשיב, היכנס/י לאתר: ${CLIENT_URL}`
                    };

                    await sgMail.send(msg);
                    console.log(`Email sent successfully to ${receiver.email}`);

                } catch (emailError) {
                    console.error("Failed to send email notification via SendGrid:", emailError.response ? emailError.response.body : emailError);
                }
            }
            // --- סוף קוד שליחת התראה ---

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
