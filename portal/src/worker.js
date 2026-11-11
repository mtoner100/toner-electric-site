// Toner Electric — private fire-alarm records portal.
//
// Every request is expected to arrive through Cloudflare Access on
// records.tonerelectric.com. The worker still verifies the Access JWT itself,
// so a stray route or preview URL can never serve data unauthenticated.
// Local dev sets DEV_BYPASS_AUTH=true in .dev.vars.

let jwksCache = { keys: null, fetchedAt: 0 };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const auth = await authorize(request, env);
    if (!auth.ok) {
      return new Response(auth.message, {
        status: 403,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, url, env, auth);
      } catch (err) {
        return json({ error: "server error" }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
};

// ---------------------------------------------------------------- auth

async function authorize(request, env) {
  if (env.DEV_BYPASS_AUTH === "true") {
    // Local dev only: impersonate via ?as=email to exercise both roles.
    const as = new URL(request.url).searchParams.get("as");
    return { ok: true, email: (as || "matt.toner8@gmail.com").toLowerCase() };
  }
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    // Fail closed if Access isn't configured yet.
    return { ok: false, message: "Portal is not configured." };
  }
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return { ok: false, message: "Access denied." };
  try {
    const payload = await verifyAccessJwt(token, env);
    return payload
      ? { ok: true, email: (payload.email || "").toLowerCase() }
      : { ok: false, message: "Access denied." };
  } catch {
    return { ok: false, message: "Access denied." };
  }
}

function isAdmin(env, email) {
  return (env.ADMIN_EMAILS || "")
    .toLowerCase().split(",").map((s) => s.trim()).filter(Boolean)
    .includes(email || "");
}

async function verifyAccessJwt(token, env) {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [h, p, s] = parts;
  const header = JSON.parse(textFromB64url(h));
  const payload = JSON.parse(textFromB64url(p));

  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) return false;
  if (payload.nbf && payload.nbf > now + 60) return false;
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(env.ACCESS_AUD)) return false;
  if (!payload.iss || !payload.iss.includes(env.ACCESS_TEAM_DOMAIN)) return false;

  const jwk = await signingKey(header.kid, env);
  if (!jwk) return false;
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    bytesFromB64url(s),
    new TextEncoder().encode(`${h}.${p}`),
  );
  return ok ? payload : null;
}

async function signingKey(kid, env) {
  const fresh = Date.now() - jwksCache.fetchedAt < 60 * 60 * 1000;
  if (!jwksCache.keys || !fresh || !jwksCache.keys.find((k) => k.kid === kid)) {
    const res = await fetch(`https://${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`);
    if (!res.ok) return null;
    const body = await res.json();
    jwksCache = { keys: body.keys || [], fetchedAt: Date.now() };
  }
  return jwksCache.keys.find((k) => k.kid === kid) || null;
}

function textFromB64url(s) {
  return atob(s.replace(/-/g, "+").replace(/_/g, "/"));
}

function bytesFromB64url(s) {
  const bin = textFromB64url(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------------------------------------------------------------- api

async function handleApi(request, url, env, auth) {
  if (url.pathname.startsWith("/api/inspect/"))
    return handleInspect(request, url, env, auth);

  if (request.method !== "GET") return json({ error: "method not allowed" }, 405);

  if (url.pathname === "/api/health") return json({ ok: true });
  if (url.pathname === "/api/index") return apiIndex(env);

  const pdf = url.pathname.match(/^\/api\/pdf\/(\d+)$/);
  if (pdf) return apiPdf(Number(pdf[1]), env);

  return json({ error: "not found" }, 404);
}

// ------------------------------------------------- dispatch + digital forms

const INSPECTION_TYPES = ["quarterly", "semi_annual", "pretest", "acceptance"];

async function handleInspect(request, url, env, auth) {
  const email = auth.email || "";
  const admin = isAdmin(env, email);
  const path = url.pathname.slice("/api/inspect/".length);
  const body = request.method === "POST"
    ? await request.json().catch(() => null)
    : null;
  if (request.method === "POST" && !body) return json({ error: "bad request" }, 400);

  if (request.method === "GET" && path === "me")
    return json({ email, admin });

  if (request.method === "GET" && path === "properties") {
    if (!admin) return json({ error: "forbidden" }, 403);
    const props = (await env.DB.prepare(
      `SELECT id, display_name, address, town FROM properties
       ORDER BY COALESCE(NULLIF(display_name, ''), address) COLLATE NOCASE`,
    ).all()).results;
    const bldgs = (await env.DB.prepare(
      `SELECT DISTINCT property_id, building FROM inspections
       WHERE building IS NOT NULL ORDER BY building`,
    ).all()).results;
    return json({ properties: props, buildings: bldgs });
  }

  if (request.method === "GET" && path === "board") {
    const base =
      `SELECT a.*, p.display_name, p.address, p.town
       FROM assignments a JOIN properties p ON p.id = a.property_id`;
    let rows;
    if (admin) {
      rows = (await env.DB.prepare(
        `${base} WHERE a.status IN ('assigned','submitted')
         ORDER BY a.due_date IS NULL, a.due_date, a.id`,
      ).all()).results;
    } else {
      rows = (await env.DB.prepare(
        `${base} WHERE a.assigned_to = ?1 AND a.status IN ('assigned','submitted')
         ORDER BY a.due_date IS NULL, a.due_date, a.id`,
      ).bind(email).all()).results;
    }
    let queue = [];
    if (admin) {
      queue = (await env.DB.prepare(
        `SELECT s.id AS submission_id, s.form_json, s.outcome, s.submitted_by,
                s.submitted_at, a.id AS assignment_id, a.building,
                a.inspection_type, a.quarter, p.display_name, p.address, p.town
         FROM submissions s
         JOIN assignments a ON a.id = s.assignment_id
         JOIN properties p ON p.id = a.property_id
         WHERE a.status = 'submitted' AND s.inspection_id IS NULL
           AND s.id = (SELECT MAX(id) FROM submissions WHERE assignment_id = a.id)
         ORDER BY s.id`,
      ).all()).results;
    }
    return json({ email, admin, assignments: rows, queue });
  }

  if (request.method === "GET" && path === "prefill") {
    const aid = Number(url.searchParams.get("assignment_id"));
    const a = await env.DB.prepare(
      `SELECT a.*, p.display_name, p.address, p.town
       FROM assignments a JOIN properties p ON p.id = a.property_id
       WHERE a.id = ?1`,
    ).bind(aid).first();
    if (!a) return json({ error: "not found" }, 404);
    if (!admin && a.assigned_to !== email) return json({ error: "forbidden" }, 403);

    let last = null;
    if (a.building) {
      last = await env.DB.prepare(
        `SELECT panel, master_box, date FROM inspections
         WHERE property_id = ?1 AND building = ?2 AND date IS NOT NULL
         ORDER BY date DESC LIMIT 1`,
      ).bind(a.property_id, a.building).first();
    }
    if (!last) {
      last = await env.DB.prepare(
        `SELECT panel, master_box, date FROM inspections
         WHERE property_id = ?1 AND date IS NOT NULL
         ORDER BY date DESC LIMIT 1`,
      ).bind(a.property_id).first();
    }
    const prevSub = await env.DB.prepare(
      `SELECT s.form_json FROM submissions s
       JOIN assignments pa ON pa.id = s.assignment_id
       WHERE pa.property_id = ?1
         AND (pa.building = ?2 OR (pa.building IS NULL AND ?2 IS NULL))
         AND s.inspection_id IS NOT NULL
       ORDER BY s.id DESC LIMIT 1`,
    ).bind(a.property_id, a.building ?? null).first();
    let lastForm = null;
    if (prevSub) { try { lastForm = JSON.parse(prevSub.form_json); } catch {} }
    return json({ assignment: a, last: last || {}, lastForm });
  }

  if (request.method === "POST" && path === "assign") {
    if (!admin) return json({ error: "forbidden" }, 403);
    const { property_id, building, inspection_type, quarter, due_date, assigned_to, notes } = body;
    if (!INSPECTION_TYPES.includes(inspection_type)) return json({ error: "bad type" }, 400);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(assigned_to || "")) return json({ error: "bad email" }, 400);
    const prop = await env.DB.prepare(`SELECT id FROM properties WHERE id = ?1`)
      .bind(Number(property_id)).first();
    if (!prop) return json({ error: "no such property" }, 400);
    const r = await env.DB.prepare(
      `INSERT INTO assignments (property_id, building, inspection_type, quarter,
         due_date, assigned_to, notes, created_by)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    ).bind(
      Number(property_id), building || null, inspection_type,
      quarter ? Number(quarter) : null, due_date || null,
      assigned_to.toLowerCase(), notes || null, email,
    ).run();
    return json({ ok: true, id: r.meta.last_row_id });
  }

  if (request.method === "POST" && (path === "cancel" || path === "reopen")) {
    if (!admin) return json({ error: "forbidden" }, 403);
    const next = path === "cancel" ? "cancelled" : "assigned";
    const r = await env.DB.prepare(
      `UPDATE assignments SET status = ?1
       WHERE id = ?2 AND status IN ('assigned','submitted')`,
    ).bind(next, Number(body.assignment_id)).run();
    return json({ ok: r.meta.changes > 0 });
  }

  if (request.method === "POST" && path === "submit") {
    const a = await env.DB.prepare(`SELECT * FROM assignments WHERE id = ?1`)
      .bind(Number(body.assignment_id)).first();
    if (!a) return json({ error: "not found" }, 404);
    if (!admin && a.assigned_to !== email) return json({ error: "forbidden" }, 403);
    if (!["assigned", "submitted"].includes(a.status)) return json({ error: "closed" }, 400);
    const form = body.form || {};
    if (!["pass", "corrected", "fail"].includes(form.outcome)) return json({ error: "pick an outcome" }, 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date || "")) return json({ error: "bad date" }, 400);
    await env.DB.prepare(
      `INSERT INTO submissions (assignment_id, form_json, outcome, submitted_by)
       VALUES (?1, ?2, ?3, ?4)`,
    ).bind(a.id, JSON.stringify(form), form.outcome, email).run();
    await env.DB.prepare(`UPDATE assignments SET status = 'submitted' WHERE id = ?1`)
      .bind(a.id).run();
    return json({ ok: true });
  }

  if (request.method === "POST" && path === "approve") {
    if (!admin) return json({ error: "forbidden" }, 403);
    const s = await env.DB.prepare(
      `SELECT s.*, a.property_id, a.building, a.inspection_type, a.quarter
       FROM submissions s JOIN assignments a ON a.id = s.assignment_id
       WHERE s.id = ?1`,
    ).bind(Number(body.submission_id)).first();
    if (!s) return json({ error: "not found" }, 404);
    if (s.inspection_id) return json({ error: "already approved" }, 400);
    let form = {};
    try { form = JSON.parse(s.form_json); } catch {}
    const ins = await env.DB.prepare(
      `INSERT INTO inspections (property_id, date, inspection_type, quarter,
         outcome, master_box, panel, remarks, building, needs_review,
         review_reason, pdf_key, source_file, source_pages, drive_file_id)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0, NULL, NULL, ?10, NULL, NULL)`,
    ).bind(
      s.property_id, form.date || null, s.inspection_type, s.quarter ?? null,
      s.outcome, form.master_box || null, form.panel || null,
      form.remarks || null, s.building ?? null, `digital-form-${s.id}`,
    ).run();
    const inspectionId = ins.meta.last_row_id;
    await env.DB.prepare(
      `UPDATE submissions SET inspection_id = ?1, reviewed_by = ?2,
         reviewed_at = datetime('now') WHERE id = ?3`,
    ).bind(inspectionId, email, s.id).run();
    await env.DB.prepare(`UPDATE assignments SET status = 'approved' WHERE id = ?1`)
      .bind(s.assignment_id).run();
    return json({ ok: true, inspection_id: inspectionId });
  }

  return json({ error: "not found" }, 404);
}

async function apiIndex(env) {
  const properties = (
    await env.DB.prepare(
      `SELECT id, slug, display_name, address, town, aliases
       FROM properties
       ORDER BY COALESCE(NULLIF(display_name, ''), address) COLLATE NOCASE`,
    ).all()
  ).results;
  const inspections = (
    await env.DB.prepare(
      `SELECT id, property_id, date, inspection_type, quarter, outcome,
              marshal_serial, master_box, panel, remarks, building,
              needs_review, review_reason, drive_file_id,
              pdf_key IS NOT NULL AS has_pdf
       FROM inspections
       ORDER BY date DESC, id DESC`,
    ).all()
  ).results;
  const meta = (await env.DB.prepare(`SELECT key, value FROM meta`).all()).results;
  return json(
    {
      properties,
      inspections,
      meta: Object.fromEntries(meta.map((r) => [r.key, r.value])),
    },
    200,
    { "cache-control": "no-store" },
  );
}

async function apiPdf(id, env) {
  const row = await env.DB.prepare(`SELECT pdf_key FROM inspections WHERE id = ?`)
    .bind(id)
    .first();
  if (!row || !row.pdf_key) return json({ error: "no pdf for this record" }, 404);
  const obj = await env.PDFS.get(row.pdf_key);
  if (!obj) return json({ error: "pdf missing from storage" }, 404);
  const filename = row.pdf_key.split("/").pop();
  return new Response(obj.body, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${filename}"`,
      "cache-control": "private, max-age=3600",
    },
  });
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra },
  });
}
