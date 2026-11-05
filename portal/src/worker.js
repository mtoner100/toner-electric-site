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
        return await handleApi(request, url, env);
      } catch (err) {
        return json({ error: "server error" }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
};

// ---------------------------------------------------------------- auth

async function authorize(request, env) {
  if (env.DEV_BYPASS_AUTH === "true") return { ok: true };
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    // Fail closed if Access isn't configured yet.
    return { ok: false, message: "Portal is not configured." };
  }
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return { ok: false, message: "Access denied." };
  try {
    const valid = await verifyAccessJwt(token, env);
    return valid ? { ok: true } : { ok: false, message: "Access denied." };
  } catch {
    return { ok: false, message: "Access denied." };
  }
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
  return crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    bytesFromB64url(s),
    new TextEncoder().encode(`${h}.${p}`),
  );
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

async function handleApi(request, url, env) {
  if (request.method !== "GET") return json({ error: "method not allowed" }, 405);

  if (url.pathname === "/api/health") return json({ ok: true });
  if (url.pathname === "/api/index") return apiIndex(env);

  const pdf = url.pathname.match(/^\/api\/pdf\/(\d+)$/);
  if (pdf) return apiPdf(Number(pdf[1]), env);

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
