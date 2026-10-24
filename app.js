if(process.env.NODE_ENV != "production"){
 require('dotenv').config();
}
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const Listing = require("./models/listing.js");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const wrapAsync = require("./utils/wrapAsync.js");
const ExpressError = require("./utils/ExpressError.js");
const { listingSchema, reviewSchema } = require("./schema.js");
const Review = require("./models/review.js");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");

const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");
const MongoStore = require('connect-mongo');

// const MONGO_URL = "mongodb://127.0.0.1:27017/wanderlust";
const db_URL = process.env.ATLASDB_URL;

main()
    .then(() => {
        console.log("connected to DB");
    }).catch((err) => {
        console.log(err);
    })


async function main(){
    await mongoose.connect(db_URL);
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({extended: true}));
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "/public")));

const store = MongoStore.create({ 
    mongoUrl: db_URL, 
    crypto: { 
        secret: "mysupersecretcode" 
    }, 
    touchAfter: 24*3600 
}); 


store.on("error", (err)=>{ 
    console.log("ERROR in MONGO SESSION STORE", err); 
});


const sessionOptions = {
    secret: "mysupersecretcode",
    resave: false,
    saveUninitialized: true,
    cookie: {
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true
    }
};

// app.get("/", (req, res) => {
//     console.log("Hi, I am root");
//     res.send("Hi i'm root");
// });

app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
    next();
})

// app.get("/demoUser", async(req, res)=>{
//     let fakeUser = new User({
//         email: "student@gmail.com",
//         username: "delta-student"
//     });

//     let newUser = await User.register(fakeUser, "helloworld");
//     res.send(newUser);
// })

app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", userRouter);



// app.get("/testListing", async(req, res) => {
//     let sampleListing = new Listing({
//         title: "My New Villa",
//         description: "In the forest",
//         price: 1200,
//         location: "Calangute, Goa",
//         country: "India"

//     });
//     await sampleListing.save();
//     console.log("Sample was saved");
//     res.send("successful testing");

// });

// app.all("*", (req, res, next) => {
//     next(new ExpressError(404, "Page Not Found!"));
// });

app.use((err, req, res, next) => {
    let {statusCode=500, message="Something went wrong!"} = err;
    res.status(statusCode).render("error.ejs", {message});
});

app.listen(8080, () => {
    console.log("server is listening to port 8080");
});

