-- Toner Electric fire-alarm records index.
-- The PDF is always the source of truth; this is the searchable index over it.

DROP TABLE IF EXISTS inspections;
DROP TABLE IF EXISTS properties;
DROP TABLE IF EXISTS meta;

CREATE TABLE properties (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,          -- stable key, e.g. "52-underwood-ln"
  display_name TEXT,                  -- "VFW Post 4487" (may be empty)
  address TEXT NOT NULL,              -- "52 Underwood Ln"
  town TEXT,                          -- "Middletown" (may be unknown)
  aliases TEXT DEFAULT '[]'           -- JSON array: name/address variants seen on paper
);

CREATE TABLE inspections (
  id INTEGER PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES properties(id),
  date TEXT,                          -- ISO yyyy-mm-dd; NULL only if unreadable
  inspection_type TEXT,               -- quarterly | semi_annual | pretest | acceptance | unknown
  quarter INTEGER,                    -- 1..4 when the marshal page marks one
  outcome TEXT,                       -- pass | corrected | fail | unknown
  marshal_serial TEXT,                -- stamped serial on the RI fire-marshal page
  master_box TEXT,                    -- master box / ID# when present
  panel TEXT,                         -- e.g. "Firelite (addressable)"
  remarks TEXT,
  building TEXT,                      -- sub-building/system, e.g. "29A" vs "29B"
  needs_review INTEGER NOT NULL DEFAULT 0,
  review_reason TEXT,
  pdf_key TEXT,                       -- R2 object key of the canonical per-inspection PDF
  source_file TEXT,                   -- original scan filename
  source_pages TEXT                   -- pages within the original, e.g. "1-2" or "7"
);

CREATE INDEX idx_insp_property ON inspections(property_id);
CREATE INDEX idx_insp_date ON inspections(date);
CREATE INDEX idx_insp_serial ON inspections(marshal_serial);

CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
