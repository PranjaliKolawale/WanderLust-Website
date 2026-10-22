const User = require("../models/user");
const Listing = require("../models/listing");
const Review = require("../models/review");

module.exports.dashboard = async (req, res) => {
    const [userCount, listingCount, reviewCount, adminCount, recentListings, recentUsers] =
        await Promise.all([
            User.countDocuments(),
            Listing.countDocuments(),
            Review.countDocuments(),
            User.countDocuments({ isAdmin: true }),
            Listing.find({}).sort({ _id: -1 }).limit(5).populate("owner"),
            User.find({}).sort({ _id: -1 }).limit(5),
        ]);
    res.render("admin/dashboard.ejs", {
        userCount, listingCount, reviewCount, adminCount, recentListings, recentUsers,
    });
};

/* ---------- Listings ---------- */
module.exports.listings = async (req, res) => {
    const listings = await Listing.find({}).sort({ _id: -1 }).populate("owner");
    res.render("admin/listings.ejs", { listings });
};

module.exports.destroyListing = async (req, res) => {
    // model hook (findOneAndDelete) also removes the listing's reviews
    await Listing.findByIdAndDelete(req.params.id);
    req.flash("success", "Listing deleted.");
    res.redirect("/admin/listings");
};

/* ---------- Users ---------- */
module.exports.users = async (req, res) => {
    const [users, listingCounts, reviewCounts] = await Promise.all([
        User.find({}).sort({ _id: -1 }),
        Listing.aggregate([{ $group: { _id: "$owner", n: { $sum: 1 } } }]),
        Review.aggregate([{ $group: { _id: "$author", n: { $sum: 1 } } }]),
    ]);
    const listingsBy = {};
    const reviewsBy = {};
    listingCounts.forEach((c) => { if (c._id) listingsBy[c._id.toString()] = c.n; });
    reviewCounts.forEach((c) => { if (c._id) reviewsBy[c._id.toString()] = c.n; });
    res.render("admin/users.ejs", { users, listingsBy, reviewsBy });
};

module.exports.toggleAdmin = async (req, res) => {
    const { id } = req.params;
    if (id === req.user._id.toString()) {
        req.flash("error", "You can't change your own admin status.");
        return res.redirect("/admin/users");
    }
    const user = await User.findById(id);
    if (!user) {
        req.flash("error", "User not found.");
        return res.redirect("/admin/users");
    }
    user.isAdmin = !user.isAdmin;
    await user.save();
    req.flash("success", `${user.username} is ${user.isAdmin ? "now an admin" : "no longer an admin"}.`);
    res.redirect("/admin/users");
};

module.exports.destroyUser = async (req, res) => {
    const { id } = req.params;
    if (id === req.user._id.toString()) {
        req.flash("error", "You can't delete your own account from the admin panel.");
        return res.redirect("/admin/users");
    }
    const user = await User.findById(id);
    if (!user) {
        req.flash("error", "User not found.");
        return res.redirect("/admin/users");
    }

    // 1. delete the user's listings (hook removes those listings' reviews too)
    const listings = await Listing.find({ owner: user._id }).select("_id");
    for (const l of listings) {
        await Listing.findByIdAndDelete(l._id);
    }
    // 2. delete the user's reviews on other people's listings
    const reviews = await Review.find({ author: user._id }).select("_id");
    const reviewIds = reviews.map((r) => r._id);
    if (reviewIds.length) {
        await Listing.updateMany({ reviews: { $in: reviewIds } }, { $pull: { reviews: { $in: reviewIds } } });
        await Review.deleteMany({ _id: { $in: reviewIds } });
    }
    // 3. delete the user
    await User.findByIdAndDelete(user._id);

    req.flash("success", `User ${user.username} and their content were deleted.`);
    res.redirect("/admin/users");
};

/* ---------- Reviews ---------- */
module.exports.reviews = async (req, res) => {
    const listings = await Listing.find({ "reviews.0": { $exists: true } })
        .populate({ path: "reviews", populate: { path: "author" } });
    const rows = [];
    listings.forEach((listing) => {
        listing.reviews.forEach((review) => rows.push({ review, listing }));
    });
    rows.sort((a, b) => b.review._id.toString().localeCompare(a.review._id.toString()));
    res.render("admin/reviews.ejs", { rows });
};

module.exports.destroyReview = async (req, res) => {
    const { id } = req.params;
    await Listing.updateMany({ reviews: id }, { $pull: { reviews: id } });
    await Review.findByIdAndDelete(id);
    req.flash("success", "Review deleted.");
    res.redirect("/admin/reviews");
};
