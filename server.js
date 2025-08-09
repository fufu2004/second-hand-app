// server.js - FINAL DIAGNOSTIC VERSION
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const mongoose = require('mongoose');
const cors = require('cors');
// ... (All other require statements remain the same)
const path = require('path');

// --- Schemas Definition ---
// (All schemas like UserSchema, ItemSchema are defined here first)
// IMPORTANT: Make sure all schemas are defined before they are used.
const ShopSchema = new mongoose.Schema({ /* ... schema definition ... */ });
const UserSchema = new mongoose.Schema({ /* ... schema definition ... */ });
const ItemSchema = new mongoose.Schema({ /* ... schema definition ... */ });
// ... (and all other schemas)

const Shop = mongoose.model('Shop', ShopSchema);
const User = mongoose.model('User', UserSchema);
const Item = mongoose.model('Item', ItemSchema);
// ... (and all other models)


const app = express();
const server = http.createServer(app);
const io = new Server(server, { /* ... cors config ... */ });
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// --- NEW DIAGNOSTIC ROUTE ---
app.get('/api/debug-status', async (req, res) => {
    try {
        const dbState = mongoose.connection.readyState;
        let dbStatus = 'Unknown';
        switch(dbState) {
            case 0: dbStatus = 'Disconnected'; break;
            case 1: dbStatus = 'Connected'; break;
            case 2: dbStatus = 'Connecting'; break;
            case 3: dbStatus = 'Disconnecting'; break;
        }

        let itemCount = -1;
        if (dbStatus === 'Connected') {
            itemCount = await Item.countDocuments({});
        }

        res.json({
            server_status: "Running",
            database_status: dbStatus,
            item_count_in_db: itemCount
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// --- All your other routes and logic from the original file go here ---
// e.g., app.get('/items', ...), app.post('/items', ...), passport config, etc.
// ...

// --- Database Connection and Server Start ---
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log('MongoDB Connected Successfully!');
        server.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('FATAL: MongoDB Connection Error:', err);
        // In this version, we don't process.exit(1) to allow the server to run for diagnostics
        server.listen(PORT, () => {
            console.log(`Server is running on port ${PORT} BUT FAILED TO CONNECT TO DB!`);
        });
    });
