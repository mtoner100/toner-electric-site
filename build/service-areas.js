#!/usr/bin/env node
/*
 * Generates one landing page per town in Newport County.
 *
 *   node build/service-areas.js
 *
 * Each page needs genuinely different content - Google treats near-identical
 * town pages as doorway pages and demotes them. The copy below is written per
 * town around what actually differs: the age and type of housing stock, and
 * the distance from the shop in Middletown.
 *
 * Edit a town's entry here, re-run, then run build/sync.js to refresh the
 * shared header and footer.
 */

const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const SITE = "https://www.tonerelectric.com";

const towns = [
  {
    slug: "newport",
    name: "Newport",
    drive: "about 10 minutes from our shop in Middletown",
    intro:
      "Newport has some of the oldest housing stock in Rhode Island, and it shows up in the electrical work. Colonial and Victorian homes around the Point, Historic Hill and Kay Street were wired long before modern demand, and many still run on undersized services, ungrounded two-prong outlets or surviving knob-and-tube.",
    focus: [
      ["Service upgrades in older homes", "100-amp services and fuse panels struggle with modern kitchens, heat pumps and car chargers. Upgrading to 200 amps is one of the most common jobs we do in Newport."],
      ["Rewiring without tearing the house apart", "Working in a historic home means fishing wire through plaster and lath, not cutting channels through it. Our electricians leave the finishes intact."],
      ["Commercial and hospitality work", "Restaurants, shops and inns around Thames Street and Broadway, including fire alarm systems and code upgrades."],
      ["Short-term rental fire alarm upgrades", "Rental properties have their own fire alarm and code requirements. We design, install and inspect systems that meet them."]
    ],
    closing:
      "Whether it is a single outlet in a Point-area cottage or a full fire alarm system for a commercial property downtown, the same RI-licensed team handles it."
  },
  {
    slug: "middletown",
    name: "Middletown",
    drive: "our home town - the shop is on Oliphant Lane",
    intro:
      "Middletown is where Toner Electric has been based since 1987. Our shop sits on Oliphant Lane, which means Middletown customers usually get the fastest response of anywhere we serve, and our vans pass through town all day.",
    focus: [
      ["Residential service and repairs", "Panel replacements, troubleshooting, outdoor and landscape lighting, and the small jobs a lot of contractors will not take."],
      ["EV charger installation", "Level 2 home chargers for every make, including Tesla wall mounts, sized correctly for your existing service."],
      ["Commercial work along West Main Road", "Retail, offices and light industrial, including fire alarm design, installation and inspection."],
      ["Renovations and additions", "New circuits, lighting design and service capacity for kitchen remodels, additions and finished basements."]
    ],
    closing:
      "Being local means we can often get to a Middletown problem the same week, and an owner is usually the one who picks up the phone."
  },
  {
    slug: "portsmouth",
    name: "Portsmouth",
    drive: "about 15 minutes north of the shop",
    intro:
      "Portsmouth covers the northern end of Aquidneck Island, and the properties are a mix: mid-century neighbourhoods, newer subdivisions, and older houses on larger lots with barns, sheds and detached garages that need power run out to them.",
    focus: [
      ["Power to outbuildings", "Detached garages, barns, workshops and sheds, including proper burial depth, conduit and sub-panels."],
      ["Service and panel upgrades", "Larger lots often mean longer service runs and higher loads. We size the service to what the property actually draws."],
      ["EV charger installation", "Longer commutes off-island make home charging worth doing properly the first time."],
      ["Whole-house surge suppression", "Protecting heat pumps, well pumps and electronics from surges on overhead lines."]
    ],
    closing:
      "From a light fixture in a Common Fence Point cottage to a sub-panel in a barn off East Main Road, we cover the whole town."
  },
  {
    slug: "jamestown",
    name: "Jamestown",
    drive: "about 25 minutes over the Newport Pell Bridge",
    intro:
      "Jamestown sits on Conanicut Island, and the electrical work reflects it. Salt air is hard on outdoor equipment, meter sockets and service masts corrode faster than they do inland, and a good number of properties are seasonal homes that sit empty for months at a time.",
    focus: [
      ["Corrosion on exterior equipment", "Meter sockets, service masts, outdoor receptacles and disconnects take a beating from salt air and need replacing sooner than inland."],
      ["Seasonal and second homes", "Systems that sit idle for months, then get switched on all at once. Worth checking before the season rather than during it."],
      ["Service upgrades for older cottages", "Many shoreline properties still run on services sized for a very different era of electrical demand."],
      ["Outdoor and dock lighting", "Weather-rated fixtures, GFCI protection and wiring specified for a coastal environment."]
    ],
    closing:
      "We cross the bridge for Jamestown work regularly, and we bring what the job needs so it does not turn into a second trip."
  },
  {
    slug: "tiverton",
    name: "Tiverton",
    drive: "about 30 minutes via the Sakonnet River Bridge",
    intro:
      "Tiverton runs from Stone Bridge down along the Sakonnet River, and the properties get more rural as you head south. Older farmhouses, converted barns, and homes on well and septic all bring electrical work you do not see as much on Aquidneck Island itself.",
    focus: [
      ["Older farmhouse wiring", "Homes that have been added to over decades, often with a patchwork of circuits and panels that need sorting out properly."],
      ["Well pumps and septic systems", "Dedicated circuits, proper disconnects and controls for equipment the house genuinely depends on."],
      ["Barns, workshops and outbuildings", "Sub-panels, lighting and power runs to buildings well away from the main service."],
      ["Troubleshooting and repairs", "Intermittent faults, tripping breakers and dead circuits, traced properly rather than guessed at."]
    ],
    closing:
      "Tiverton is a longer run for us than Aquidneck Island, so we plan the work to get it done in as few visits as possible."
  },
  {
    slug: "little-compton",
    name: "Little Compton",
    drive: "about 40 minutes, the furthest town we cover",
    intro:
      "Little Compton is the most rural town in Newport County: farms, stone walls, coastal properties and long driveways. Service runs are longer here than anywhere else we work, and a lot of the housing stock is old enough that the original wiring was never meant to carry a modern load.",
    focus: [
      ["Long service and feeder runs", "Voltage drop is a real problem over distance. Runs need to be sized for the length, not just the load."],
      ["Farm and agricultural buildings", "Power to barns, equipment sheds and outbuildings, with the right protection for a working environment."],
      ["Coastal property wiring", "Weather-rated exterior equipment and fixtures specified for salt air exposure."],
      ["Service upgrades in older homes", "Bringing farmhouses and coastal cottages up to a service that matches how they are actually used today."]
    ],
    closing:
      "Little Compton is the furthest we travel, so we schedule the work deliberately and turn up with the van stocked for it."
  }
];

const icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

function page(t) {
  const title = `Electrician in ${t.name}, RI | Toner Electric`;
  const desc = `Licensed electrical contractor serving ${t.name}, Rhode Island since 1952. Residential and commercial wiring, service upgrades, EV chargers and fire alarms.`;
  const url = `${SITE}/electrician-${t.slug}-ri.html`;

  const focus = t.focus.map(([h, p]) => `        <div class="qa__item">
          <h3>${h}</h3>
          <p>${p}</p>
        </div>`).join("\n");

  const schema = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Electrical contracting",
    provider: { "@type": "Electrician", "@id": `${SITE}/#business`, name: "Toner Electric Company" },
    areaServed: { "@type": "City", name: t.name, containedInPlace: { "@type": "State", name: "Rhode Island" } },
    url
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>${title}</title>
  <meta name="description" content="${desc}" />
  <link rel="canonical" href="${url}" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Toner Electric Company" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${desc}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${SITE}/images/og_image.jpg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />

  <!-- @@head -->
  <!-- @@end -->

  <script type="application/ld+json">
${JSON.stringify(schema, null, 2).split("\n").map(l => "  " + l).join("\n")}
  </script>
</head>
<body>

<!-- @@header -->
<!-- @@end -->

<main id="main">

  <section class="page-banner">
    <div class="container">
      <span class="eyebrow">Service area</span>
      <h1>Electrician in ${t.name}, RI</h1>
      <p>
        Toner Electric is a family-owned electrical contractor serving ${t.name} since 1952 &mdash;
        ${t.drive}.
      </p>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="split">
        <div>
          <span class="eyebrow">Working in ${t.name}</span>
          <h2>What we see most in ${t.name}</h2>
          <p style="margin-bottom:1.5rem">${t.intro}</p>
          <ul class="check-list">
            <li>${icon}<span>RI-licensed electricians, fully insured</span></li>
            <li>${icon}<span>Free estimates on new work</span></li>
            <li>${icon}<span>Speak to an owner when you call during business hours</span></li>
            <li>${icon}<span>We leave your home or business neat and clean</span></li>
          </ul>
        </div>
        <div class="split__media">
          <img src="images/aidan_russ.webp" alt="Toner Electric electricians working on a residential service panel" width="600" height="800" loading="lazy" decoding="async" />
        </div>
      </div>
    </div>
  </section>

  <section class="section section--tint">
    <div class="container">
      <div class="section-head">
        <span class="eyebrow">Common jobs</span>
        <h2>Electrical work in ${t.name}</h2>
      </div>
      <div class="qa prose">
${focus}
      </div>
      <p style="margin-top:2rem;max-width:68ch">${t.closing}</p>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-head">
        <span class="eyebrow">Our services</span>
        <h2>What we do across Newport County</h2>
      </div>
      <div class="grid grid--3">
        <a href="electrical_services.html" class="card">
          <h3>Electrical Services</h3>
          <p>Wiring, service upgrades, panel replacements, renovations, troubleshooting and repairs.</p>
          <span class="card__more">Learn more</span>
        </a>
        <a href="electrical_services.html#ev" class="card">
          <h3>EV Charger Installation</h3>
          <p>Level 2 home chargers for every make, including Tesla wall mounts.</p>
          <span class="card__more">Learn more</span>
        </a>
        <a href="fire_alarms.html" class="card">
          <h3>Commercial Fire Alarms</h3>
          <p>Design, installation, code upgrades and scheduled inspections.</p>
          <span class="card__more">Learn more</span>
        </a>
      </div>
    </div>
  </section>

  <section class="section section--dark">
    <div class="container">
      <div class="section-head">
        <span class="eyebrow">Free estimates</span>
        <h2>Need an electrician in ${t.name}?</h2>
        <p>Best reached between 7:30 and 10:00 AM, Monday to Friday.</p>
      </div>
      <div class="btn-row">
        <a href="tel:+14018470993" class="btn btn--primary">Call (401) 847-0993</a>
        <a href="index.html#contact" class="btn btn--ghost">Request an estimate</a>
      </div>
    </div>
  </section>

</main>

<!-- @@footer -->
<!-- @@end -->

</body>
</html>
`;
}

let written = 0;
for (const t of towns) {
  const file = path.join(root, `electrician-${t.slug}-ri.html`);
  fs.writeFileSync(file, page(t));
  console.log(`  electrician-${t.slug}-ri.html`.padEnd(38) + `${t.name}`);
  written++;
}
console.log(`\n${written} service area pages generated.`);
console.log("Now run: node build/sync.js");

module.exports = { towns };
