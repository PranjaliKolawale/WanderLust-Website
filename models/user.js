const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose");

const userSchema = new Schema({
    email: {
        type: String,
        required: true
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);