// WanderLust Express application. Works locally and as a Vercel serverless function.
if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const MongoStore = require("connect-mongo");
const User = require("./models/user.js");
const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");
const adminRouter = require("./routes/admin.js");

const db_URL = process.env.ATLASDB_URL;
const sessionSecret = process.env.SESSION_SECRET;

if (!db_URL) {
    console.error("Missing ATLASDB_URL environment variable.");
}
if (!sessionSecret) {
    console.error("Missing SESSION_SECRET environment variable.");
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.engine("ejs", ejsMate);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

// Reuse a single MongoDB connection across requests/cold starts.
let databaseConnectionPromise;
async function connectDatabase() {
    if (!db_URL) throw new Error("ATLASDB_URL is not configured in Vercel Environment Variables.");
    if (mongoose.connection.readyState === 1) return;
    if (!databaseConnectionPromise) {
        databaseConnectionPromise = mongoose.connect(db_URL, { serverSelectionTimeoutMS: 10000 })
            .catch((err) => {
                databaseConnectionPromise = null;
                throw err;
            });
    }
    await databaseConnectionPromise;
}

// Creates the configured admin account automatically, so no CLI script is needed.
// Set ADMIN_USERNAME, ADMIN_PASSWORD and ADMIN_EMAIL in Vercel.
let adminSetupPromise;
async function ensureEnvironmentAdmin() {
    const { ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_EMAIL } = process.env;
    if (!ADMIN_USERNAME || !ADMIN_PASSWORD) return;
    if (ADMIN_PASSWORD.length < 12) {
        throw new Error("ADMIN_PASSWORD must be at least 12 characters long.");
    }
    if (!adminSetupPromise) {
        adminSetupPromise = (async () => {
            let admin = await User.findOne({ username: ADMIN_USERNAME });
            if (!admin) {
                admin = new User({
                    username: ADMIN_USERNAME,
                    email: ADMIN_EMAIL || `${ADMIN_USERNAME}@admin.local`,
                    isAdmin: true,
                });
                await User.register(admin, ADMIN_PASSWORD);
                console.log("Environment-configured admin account created.");
                return;
            }
            // Keep this account's credentials controlled by Vercel environment variables.
            admin.isAdmin = true;
            if (ADMIN_EMAIL) admin.email = ADMIN_EMAIL;
            await admin.setPassword(ADMIN_PASSWORD);
            await admin.save();
            console.log("Environment-configured admin account verified.");
        })().catch((err) => {
            adminSetupPromise = null;
            throw err;
        });
    }
    await adminSetupPromise;
}

const store = MongoStore.create({
    mongoUrl: db_URL,
    crypto: { secret: process.env.SESSION_ENCRYPTION_SECRET || sessionSecret || "" },
    touchAfter: 24 * 3600,
    collectionName: "sessions",
});
store.on("error", (err) => console.error("Mongo session store error:", err.message));

app.use(session({
    store,
    secret: sessionSecret || "missing-session-secret-configure-in-vercel",
    resave: false,
    saveUninitialized: false,
    proxy: process.env.NODE_ENV === "production",
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
    },
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Ensure MongoDB and the environment-configured admin exist before route handlers run.
app.use(async (req, res, next) => {
    try {
        if (!sessionSecret) throw new Error("SESSION_SECRET is missing. Add it in Vercel Environment Variables.");
        await connectDatabase();
        await ensureEnvironmentAdmin();
        next();
    } catch (err) {
        console.error("Request initialization failed:", err.message);
        next(err);
    }
});

app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
    next();
});

app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/admin", adminRouter);
app.use("/", userRouter);

app.use((req, res, next) => {
    const err = new Error("Page Not Found!");
    err.statusCode = 404;
    next(err);
});

app.use((err, req, res, next) => {
    console.error(err.stack || err);
    const statusCode = err.statusCode || err.status || 500;
    const message = statusCode === 500 && process.env.NODE_ENV === "production"
        ? "Something went wrong. Please check your Vercel logs and environment variables."
        : (err.message || "Something went wrong!");
    if (res.headersSent) return next(err);
    res.status(statusCode).render("error.ejs", { message });
});

// Vercel imports the app as a serverless handler; local development uses app.listen.
if (!process.env.VERCEL) {
    const port = process.env.PORT || 8080;
    app.listen(port, () => console.log(`WanderLust listening on port ${port}`));
}

module.exports = app;
