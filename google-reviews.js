const reviewsContainer = document.getElementById("reviews-container");
const REVIEWS_URL = "https://toner-electric-site.onrender.com/reviews";

function setMessage(text) {
    reviewsContainer.replaceChildren();
    const p = document.createElement("p");
    p.textContent = text;
    reviewsContainer.appendChild(p);
}

async function fetchReviews() {
    if (!reviewsContainer) return;
    setMessage("Loading reviews…");

    // The reviews server sleeps when idle and can take a while to wake up,
    // so give it room but don't leave visitors hanging forever.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch(REVIEWS_URL, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (data.reviews && data.reviews.length) {
            displayReviews(data.reviews);
        } else {
            setMessage("No reviews to show right now.");
        }
    } catch (error) {
        console.error("Error fetching Google Reviews:", error);
        setMessage("Reviews couldn't be loaded. See them on our Google listing.");
    } finally {
        clearTimeout(timer);
    }
}

function displayReviews(reviews) {
    reviewsContainer.replaceChildren();

    reviews.forEach(review => {
        const card = document.createElement("div");
        card.className = "review";

        const header = document.createElement("div");
        header.className = "review-header";

        // Review text comes from the public - build it with textContent so a
        // review containing HTML can never inject markup into the page.
        const author = document.createElement("strong");
        author.textContent = review.author;
        header.appendChild(author);
        header.append(` - ${"⭐".repeat(Math.round(review.rating) || 0)}${review.when ? ` (${review.when})` : ""}`);

        const body = document.createElement("p");
        body.textContent = review.text;

        card.append(header, body);
        reviewsContainer.appendChild(card);
    });
}

fetchReviews();
