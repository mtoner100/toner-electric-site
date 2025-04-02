const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = 3000;

// Enable CORS for frontend
app.use(cors());

// Google Places API Config (Replace with Your API Key & Place ID)
const GOOGLE_API_KEY = "AIzaSyAgyW30bqoYVOoSbhsqEqhDFN6IpSBP1Vg";
const PLACE_ID = "ChIJBS5FZU6p5YkRkWZGWg0NUwg";  // Replace with your Place ID

// Proxy endpoint to fetch Google Reviews
app.get("/reviews", async (req, res) => {
    try {
        const googleURL = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${PLACE_ID}&fields=name,rating,reviews&key=${GOOGLE_API_KEY}`;
        
        const response = await axios.get(googleURL);
        res.json(response.data);
    } catch (error) {
        console.error("Error fetching Google Reviews:", error);
        res.status(500).json({ error: "Failed to fetch reviews" });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
