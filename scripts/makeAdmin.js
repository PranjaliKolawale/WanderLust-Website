// Usage:  node scripts/makeAdmin.js <username>            -> make admin
//         node scripts/makeAdmin.js <username> --remove    -> remove admin
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/user.js");

(async () => {
    const [username, flag] = process.argv.slice(2);
    if (!username) {
        console.log("Usage: node scripts/makeAdmin.js <username> [--remove]");
        process.exit(1);
    }
    await mongoose.connect(process.env.ATLASDB_URL);
    const user = await User.findOne({ username });
    if (!user) {
        console.log(`No user found with username "${username}". Sign up first.`);
        process.exit(1);
    }
    user.isAdmin = flag !== "--remove";
    await user.save();
    console.log(`${user.username} is ${user.isAdmin ? "now an admin" : "no longer an admin"}.`);
    await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
