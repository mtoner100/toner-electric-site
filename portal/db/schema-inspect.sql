-- Dispatch + digital inspection forms (additive migration; safe to re-run).
-- The paper marshal page stays paper: an approved digital form becomes an
-- inspections row with no pdf/serial until the scanned marshal page arrives.

CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL REFERENCES properties(id),
  building TEXT,
  inspection_type TEXT NOT NULL,       -- quarterly | semi_annual | pretest | acceptance
  quarter INTEGER,                     -- 1..4 for quarterlies
  due_date TEXT,                       -- ISO yyyy-mm-dd
  assigned_to TEXT NOT NULL,           -- employee email (must be on the Access allowlist)
  notes TEXT,                          -- dispatch notes from Frank
  status TEXT NOT NULL DEFAULT 'assigned', -- assigned | submitted | approved | cancelled
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_assign_status ON assignments(status);
CREATE INDEX IF NOT EXISTS idx_assign_who ON assignments(assigned_to);

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id),
  form_json TEXT NOT NULL,             -- full form payload (counts, panel, remarks…)
  outcome TEXT,                        -- pass | corrected | fail
  submitted_by TEXT,
  submitted_at TEXT DEFAULT (datetime('now')),
  reviewed_by TEXT,
  reviewed_at TEXT,
  inspection_id INTEGER                -- inspections.id once approved
);
CREATE INDEX IF NOT EXISTS idx_sub_assignment ON submissions(assignment_id);
