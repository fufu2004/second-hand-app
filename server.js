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

// --- הגדרות קבועות ---
// הערה: הטמעת מפתחות בקוד היא לצורכי בדיקה בלבד. בסביבת ייצור יש להשתמש במשתני סביבה.
const GOOGLE_CLIENT_ID = '384614022081-aoa15ct9nvp8unae07bmm70tv3csrajj.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = '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';
const MONGO_URI = 'mongodb+srv://myAppUser:LiatRiftal1976@second-hand-shop.1k54hdk.mongodb.net/?retryWrites=true&w=majority&appName=second-hand-shop';
const JWT_SECRET = 'MySuperSecretKeyForRollingStyleApp123';
const CLIENT_URL = "https://mellow-longma-d22b01.netlify.app";
const SERVER_URL = "https://second-hand-app-6ht2.onrender.com";


// --- חיבור למסד הנתונים (MongoDB) ---
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB Connected Successfully!'))
    .catch(err => console.error('MongoDB Connection Error:', err));

// --- הגדרת מודלים למסד הנתונים ---
const UserSchema = new mongoose.Schema({ googleId: { type: String, required: true }, displayName: String, email: String, image: String });
const User = mongoose.model('User', UserSchema);
const ItemSchema = new mongoose.Schema({ title: String, description: String, price: Number, category: String, contact: String, imageUrls: [String], owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, sold: { type: Boolean, default: false }, createdAt: { type: Date, default: Date.now } });
const Item = mongoose.model('Item', ItemSchema);

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

// --- נתיבים (Routes) ---
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: `${CLIENT_URL}?login_failed=true`, session: false }), (req, res) => {
    const payload = { id: req.user._id, name: req.user.displayName };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
    const userString = encodeURIComponent(JSON.stringify(payload));
    res.redirect(`${CLIENT_URL}?token=${token}&user=${userString}`);
});

app.get('/items', async (req, res) => { try { const items = await Item.find().populate('owner', 'displayName').sort({ createdAt: -1 }); res.json(items); } catch (err) { res.status(500).json({ message: err.message }); } });
app.get('/items/my-items', authMiddleware, async (req, res) => { try { const items = await Item.find({ owner: req.user.id }).populate('owner', 'displayName').sort({ createdAt: -1 }); res.json(items); } catch (err) { res.status(500).json({ message: err.message }); } });
app.post('/items', authMiddleware, upload.array('images', 6), async (req, res) => { const imageUrls = req.files.map(f => `https://placehold.co/600x400?text=Image`); const newItem = new Item({ title: req.body.title, description: req.body.description, price: req.body.price, category: req.body.category, contact: req.body.contact, imageUrls: imageUrls, owner: req.user.id }); try { const savedItem = await newItem.save(); const populatedItem = await Item.findById(savedItem._id).populate('owner', 'displayName'); io.emit('newItem', populatedItem); res.status(201).json(populatedItem); } catch (err) { res.status(400).json({ message: err.message }); } });
app.patch('/items/:id', authMiddleware, upload.array('images', 6), async (req, res) => { try { const item = await Item.findById(req.params.id); if (!item) return res.status(404).json({ message: 'Item not found' }); if (item.owner.toString() !== req.user.id) return res.status(403).json({ message: 'Not authorized' }); const updateData = { ...req.body }; if (req.files && req.files.length > 0) { updateData.imageUrls = req.files.map(f => `https://placehold.co/600x400?text=Updated+Image`); } const updatedItem = await Item.findByIdAndUpdate(req.params.id, updateData, { new: true }).populate('owner', 'displayName'); io.emit('itemUpdated', updatedItem); res.json(updatedItem); } catch (err) { res.status(400).json({ message: err.message }); } });
app.patch('/items/:id/sold', authMiddleware, async (req, res) => { try { const item = await Item.findById(req.params.id); if (!item) return res.status(404).json({ message: 'Item not found' }); if (item.owner.toString() !== req.user.id) return res.status(403).json({ message: 'Not authorized' }); item.sold = req.body.sold; await item.save(); const updatedItem = await Item.findById(item._id).populate('owner', 'displayName'); io.emit('itemUpdated', updatedItem); res.json(updatedItem); } catch (err) { res.status(400).json({ message: err.message }); } });
app.delete('/items/:id', authMiddleware, async (req, res) => { try { const item = await Item.findById(req.params.id); if (!item) return res.status(404).json({ message: 'Item not found' }); if (item.owner.toString() !== req.user.id) return res.status(403).json({ message: 'Not authorized' }); await item.remove(); io.emit('itemDeleted', req.params.id); res.json({ message: 'Item deleted' }); } catch (err) { res.status(500).json({ message: err.message }); } });

// --- הגדרת Socket.io ---
io.on('connection', (socket) => { console.log('a user connected'); socket.on('disconnect', () => { console.log('user disconnected'); }); });

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
