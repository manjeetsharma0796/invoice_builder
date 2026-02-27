const express = require("express");
const router = express.Router();

/**
 * GET / — Main upload page
 */
router.get("/", (req, res) => {
    res.render("index");
});

/**
 * GET /builder — Template builder page
 */
router.get("/builder", (req, res) => {
    res.render("templates");
});

/**
 * GET /result/:id — Result page for a processed invoice
 */
router.get("/result/:id", (req, res) => {
    res.render("result", { invoiceId: req.params.id });
});

/**
 * GET /settings — Provider/model settings page
 */
router.get("/settings", (req, res) => {
    res.render("settings");
});

module.exports = router;
