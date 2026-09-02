/* Renders Google reviews into the homepage. Reviews are public content, so
   every value goes in with textContent - never innerHTML. */
(function () {
  const container = document.getElementById("reviews-container");
  if (!container) return;

  const REVIEWS_URL = "https://toner-electric-site.onrender.com/reviews";

  function status(text) {
    container.replaceChildren();
    const p = document.createElement("p");
    p.className = "reviews-status";
    p.textContent = text;
    container.appendChild(p);
  }

  /* Placeholders roughly the size of real reviews. Without these the grid is
     almost empty while the request is in flight, and everything below it jumps
     up the page - which broke "Request an Estimate" links from other pages. */
  function showSkeletons(n) {
    container.replaceChildren();
    for (let i = 0; i < n; i++) {
      const card = document.createElement("div");
      card.className = "review review--skeleton";
      card.setAttribute("aria-hidden", "true");
      for (let j = 0; j < 5; j++) card.appendChild(document.createElement("span"));
      container.appendChild(card);
    }
  }

  /* If the visitor arrived on a #hash, correct their position once the real
     reviews have replaced the placeholders - unless they've started scrolling
     themselves, in which case leave them alone. */
  let userScrolled = false;
  ["wheel", "touchmove", "keydown"].forEach(evt =>
    window.addEventListener(evt, () => { userScrolled = true; }, { passive: true, once: true })
  );

  function restoreHashPosition() {
    if (userScrolled || !location.hash) return;
    const target = document.querySelector(location.hash);
    if (target) target.scrollIntoView();
  }

  function render(reviews) {
    container.replaceChildren();

    reviews.forEach(review => {
      const card = document.createElement("article");
      card.className = "review";

      const stars = document.createElement("div");
      stars.className = "review__stars";
      stars.setAttribute("aria-label", `${review.rating} out of 5 stars`);
      stars.textContent = "★".repeat(Math.round(review.rating) || 0);

      const text = document.createElement("p");
      text.className = "review__text";
      text.textContent = review.text;

      const author = document.createElement("div");
      author.className = "review__author";
      author.textContent = review.author;
      if (review.when) {
        const when = document.createElement("span");
        when.textContent = review.when;
        author.appendChild(when);
      }

      card.append(stars, text, author);
      container.appendChild(card);
    });
  }

  async function load() {
    showSkeletons(5);

    // The reviews server sleeps when idle and can take a while to wake.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(REVIEWS_URL, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      if (data.reviews && data.reviews.length) {
        render(data.reviews);
        const score = document.getElementById("review-score");
        if (score && data.rating) score.textContent = data.rating;
        restoreHashPosition();
      } else {
        status("No reviews to show right now.");
      }
    } catch (error) {
      console.error("Error fetching Google reviews:", error);
      status("Reviews couldn't be loaded. See them on our Google listing.");
      restoreHashPosition();
    } finally {
      clearTimeout(timer);
    }
  }

  load();
})();
