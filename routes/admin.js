const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn, isAdmin } = require("../middleware.js");
const adminController = require("../controllers/admin.js");

// every /admin route requires a logged-in admin
router.use(isLoggedIn, isAdmin);

router.get("/", wrapAsync(adminController.dashboard));

router.get("/listings", wrapAsync(adminController.listings));
router.delete("/listings/:id", wrapAsync(adminController.destroyListing));

router.get("/users", wrapAsync(adminController.users));
router.patch("/users/:id/admin", wrapAsync(adminController.toggleAdmin));
router.delete("/users/:id", wrapAsync(adminController.destroyUser));

router.get("/reviews", wrapAsync(adminController.reviews));
router.delete("/reviews/:id", wrapAsync(adminController.destroyReview));

module.exports = router;
