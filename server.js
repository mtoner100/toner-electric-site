const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// Google Places config. The API key is a secret and must come from the
// environment - never commit it. Set GOOGLE_API_KEY in the Render dashboard.
// The Place ID is public information, so a default is fine here.
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const PLACE_ID = process.env.GOOGLE_PLACE_ID || "ChIJBS5FZU6p5YkRkWZGWg0NUwg";

if (!GOOGLE_API_KEY) {
    console.error("GOOGLE_API_KEY is not set. Add it as an environment variable before starting.");
    process.exit(1);
}

// Only our own site may call this endpoint. Without this, anyone can hit
// /reviews and run up Google Places charges on our account.
const ALLOWED_ORIGINS = [
    "https://www.tonerelectric.com",
    "https://tonerelectric.com",
    "http://localhost:8765"
];

app.use(cors({
    origin: (origin, callback) => {
        // no origin = curl, server-to-server, or a same-origin request
        if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        return callback(new Error("Not allowed by CORS"));
    }
}));

const MAX_REVIEWS = 5;

// Google runs two versions of this API. Projects created from 2025 onward can
// only enable "Places API (New)"; older projects may only have the legacy one.
// We try the new one first and fall back, so either project type works.
// Once you know which one your project uses, the other branch can be deleted.

async function fetchFromNewApi() {
    const { data } = await axios.get(`https://places.googleapis.com/v1/places/${PLACE_ID}`, {
        timeout: 8000,
        headers: {
            "X-Goog-Api-Key": GOOGLE_API_KEY,
            "X-Goog-FieldMask": "displayName,rating,reviews"
        }
    });

    return {
        source: "places-new",
        rating: data.rating ?? null,
        reviews: (data.reviews || []).map(r => ({
            author: r.authorAttribution?.displayName || "Google user",
            rating: r.rating,
            when: r.relativePublishTimeDescription || "",
            text: r.text?.text || "",
            publishedAt: r.publishTime || null
        }))
    };
}

async function fetchFromLegacyApi() {
    const { data } = await axios.get("https://maps.googleapis.com/maps/api/place/details/json", {
        timeout: 8000,
        params: { place_id: PLACE_ID, fields: "name,rating,reviews", key: GOOGLE_API_KEY }
    });

    // The legacy API replies 200 even for errors, so check the payload status.
    if (data.status !== "OK") {
        throw new Error(data.error_message || data.status);
    }

    return {
        source: "places-legacy",
        rating: data.result?.rating ?? null,
        reviews: (data.result?.reviews || []).map(r => ({
            author: r.author_name || "Google user",
            rating: r.rating,
            when: r.relative_time_description || "",
            text: r.text || "",
            publishedAt: r.time ? new Date(r.time * 1000).toISOString() : null
        }))
    };
}

async function fetchReviews() {
    try {
        return await fetchFromNewApi();
    } catch (newErr) {
        const detail = newErr.response?.data?.error?.message || newErr.message;
        console.warn(`Places API (New) failed: ${detail} - trying the legacy API.`);
        return await fetchFromLegacyApi();
    }
}

// Reviews change rarely, so serve a cached copy and only ask Google
// a few times a day. This keeps the page fast and the API bill near zero.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
let cache = { data: null, fetchedAt: 0 };

app.get("/reviews", async (req, res) => {
    if (cache.data && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
        res.set("X-Cache", "HIT");
        return res.json(cache.data);
    }

    try {
        const result = await fetchReviews();

        // newest first, and never send more than we display
        result.reviews.sort((a, b) => String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")));
        result.reviews = result.reviews.slice(0, MAX_REVIEWS);

        cache = { data: result, fetchedAt: Date.now() };
        res.set("X-Cache", "MISS");
        res.set("X-Places-Source", result.source);
        res.json(result);
    } catch (error) {
        const detail = error.response?.data?.error?.message || error.message;
        console.error("Could not fetch Google reviews:", detail);

        // If Google is unreachable but we have an older copy, show that
        // rather than an empty section.
        if (cache.data) {
            res.set("X-Cache", "STALE");
            return res.json(cache.data);
        }
        res.status(502).json({ error: "Reviews are temporarily unavailable." });
    }
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
