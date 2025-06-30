const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const listingSchema = new Schema({
    title: {
        type: String,
        required: true,
    },
    description: String,
    image: {
        type: String,
        set: (v) => v === "" ? "https://unsplash.com/photos/brown-wooden-house-in-the-middle-of-forest-during-daytime-jo8pclRHmCI": v,
    },
    price: Number,
    location: String,
    country: String
});

const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;