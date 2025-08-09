// server.js

// ... (כל הקוד עד נתיבי ה-API נשאר זהה) ...

app.use(session({ secret: 'keyboard cat', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

// ======================= עדכון נתיב API =======================
// GET all non-sold items
app.get('/api/items', async (req, res) => {
    try {
        const items = await Item.find({ sold: false })
            // **IMPROVED:** Populate averageRating along with other owner details
            .populate('owner', 'displayName image isVerified averageRating')
            .sort({ createdAt: -1 });
        res.json(items);
    } catch (err) {
        console.error("Error fetching items:", err);
        res.status(500).json({ message: "Server error while fetching items" });
    }
});
// =============================================================

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

// ... (שאר הקוד נשאר ללא שינוי)
