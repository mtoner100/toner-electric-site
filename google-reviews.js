const reviewsContainer = document.getElementById("reviews-container");

async function fetchReviews() {
    const url = "https://toner-electric-site.onrender.com/reviews"; // Ensure your backend server is running

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        if (data.result && data.result.reviews) {
            displayReviews(data.result.reviews);
        } else {
            reviewsContainer.innerHTML = "<p>No reviews available.</p>";
        }
    } catch (error) {
        console.error("Error fetching Google Reviews:", error);
        reviewsContainer.innerHTML = "<p>Could not load reviews.</p>";
    }
}

function displayReviews(reviews) {
    reviewsContainer.innerHTML = ""; // Clear previous reviews

    // Sort reviews by timestamp (newest first)
    const sortedReviews = reviews.sort((a, b) => b.time - a.time).slice(0, 5);

    sortedReviews.forEach(review => {
        const reviewElement = document.createElement("div");
        reviewElement.classList.add("review");

        reviewElement.innerHTML = `
            <div class="review-header">
                <strong>${review.author_name}</strong> - ⭐${review.rating} (${review.relative_time_description})
            </div>
            <p>${review.text}</p>
        `;

        reviewsContainer.appendChild(reviewElement);
    });
}

// Fetch reviews when the page loads
fetchReviews();
