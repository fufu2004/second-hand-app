// minimal-server.js

const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');

// --- קריאת משתני סביבה ---
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const SERVER_URL = process.env.SERVER_URL || 'https://second-hand-server.onrender.com';
const CLIENT_URL = process.env.CLIENT_URL;

// --- בדיקת משתני סביבה ---
console.log("--- MINIMAL SERVER: Verifying Environment Variables ---");
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !CLIENT_URL) {
    console.error("FATAL ERROR: One or more required environment variables are missing!");
    console.log("GOOGLE_CLIENT_ID:", GOOGLE_CLIENT_ID ? "OK" : "MISSING!");
    console.log("GOOGLE_CLIENT_SECRET:", GOOGLE_CLIENT_SECRET ? "OK" : "MISSING!");
    console.log("CLIENT_URL:", CLIENT_URL ? "OK" : "MISSING!");
    process.exit(1);
}
console.log("All required environment variables are loaded.");
console.log("Using Client ID starting with:", GOOGLE_CLIENT_ID.substring(0, 15));
console.log("----------------------------------------------------");

const app = express();
const PORT = process.env.PORT || 3000;

// --- הגדרת Passport.js ---
app.use(session({ secret: 'keyboard cat test', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

// Passport זקוק לפונקציות האלה, גם אם הן ריקות לצורך הבדיקה
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: `${SERVER_URL}/auth/google/callback`,
    proxy: true
  },
  (accessToken, refreshToken, profile, done) => {
    // בבדיקה זו, אנחנו לא שומרים את המשתמש, רק מאמתים את התהליך
    return done(null, profile);
  }
));

// --- נתיבים (Routes) ---
app.get('/', (req, res) => {
    res.send('<a href="/auth/google">Login with Google</a>');
});

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login-failed' }),
  (req, res) => {
    // הצלחה! הפנייה חזרה לאתר הלקוח עם הודעת הצלחה
    res.redirect(`${CLIENT_URL}?login_success=true`);
  }
);

app.get('/login-failed', (req, res) => {
    res.status(401).send('Google authentication failed.');
});

// --- הרצת השרת ---
app.listen(PORT, () => {
    console.log(`Minimal server is running on port ${PORT}`);
});
