// server.js (גרסה סופית ויציבה)

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

// ... (כל שאר הקוד נשאר זהה עד לנתיב /items)
// You can copy the full content from the previous steps, just make sure the /items route is the corrected one.
// For brevity, I'm only showing the corrected /items route. The rest of your file remains the same.
// The full, correct server.js is available in the previous chat turns if you need it.

const app = express();
// ... (All other app setup and model definitions go here)

// Make sure all your app.use, model definitions, and other routes are here

// ############# START: CORRECTED AND STABLE ITEMS ROUTE #############
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

        const itemsWithoutOwner = await Item.find(filters)
            .sort(sortOptions)
            .skip(skip)
            .limit(limit);

        const validItems = [];
        for (const item of itemsWithoutOwner) {
            try {
                const populatedItem = await item.populate('owner', 'displayName email isVerified shop averageRating');
                if (populatedItem.owner) {
                    validItems.push(populatedItem);
                } else {
                    console.warn(`Skipping item with ID: ${item._id} because its owner could not be found.`);
                }
            } catch (populateError) {
                console.error(`Error populating owner for item ID: ${item._id}`, populateError);
            }
        }

        const totalItems = await Item.countDocuments(filters);

        res.json({
            items: validItems,
            totalPages: Math.ceil(totalItems / limit),
            currentPage: page,
            totalItems: totalItems
        });

    } catch (err) {
        console.error("Critical error in /items route:", err);
        res.status(500).json({ message: err.message });
    }
});
// ############# END: CORRECTED AND STABLE ITEMS ROUTE #############

// ... (Rest of your server code, including the final app.get('*', ...))
