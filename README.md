# tonerelectric.com

Static site for Toner Electric Company, Middletown RI.
Hosted on GitHub Pages from `main`. Pushing to `main` deploys.

## Editing content

Every page is plain HTML — open it, edit it, commit it. No build step needed
for ordinary content changes (staff bios, copy, prices, photos).

## Editing the header or footer

The header, nav and footer are shared. Don't edit them inside the page files:
they live in `partials/` and get copied into every page by a small script.

1. Edit `partials/header.html`, `partials/footer.html` or `partials/head.html`
2. Run:

   ```
   node build/sync.js
   ```

3. Commit the changed HTML files as usual

The script only rewrites what sits between the `<!-- @@header -->` and
`<!-- @@end -->` markers. Per-page `<title>`, meta description and canonical
URL live outside those markers and are never touched.

It has no dependencies — plain Node, nothing to install, nothing to go stale.
If it ever stops working, just edit the header in each HTML file by hand;
nothing depends on it.

## Structure

```
partials/       shared header, footer, common <head> tags
build/sync.js   copies partials into the pages
css/style.css   all styles; design tokens are at the top
js/site.js      mobile nav drawer + estimate form
google-reviews.js  fetches reviews on the homepage
server.js       reviews proxy, deployed separately on Render
```

## Images

Resize to about 2x their displayed size and convert to WebP before adding.
A 4000px camera export used at 300px wide costs visitors megabytes.

## The reviews server

`server.js` runs on Render, not GitHub Pages. It proxies Google Places so the
API key stays off the website. The key is set as the `GOOGLE_API_KEY`
environment variable in the Render dashboard — never in this repo.
See `.env.example`.
