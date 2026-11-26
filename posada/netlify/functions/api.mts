import { getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";

// Datos:
//   p/<id>   -> participante { id, name, email, gifts[], tokenHash, createdAt }
//   draw     -> { drawnAt, pairs: { giverId: receiverId } }   (nunca se expone completo)

const store = () => getStore({ name: "posada", consistency: "strong" });
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });
const bad = (msg: string, status = 400) => json({ error: msg }, status);

const rand = (bytes: number) =>
  [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
async function sha(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const cleanUrl = (v: unknown) => {
  const s = clean(v, 600);
  if (!s) return "";
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : "https://" + s);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : "";
  } catch { return ""; }
};
const cleanGifts = (g: unknown) =>
  (Array.isArray(g) ? g : []).slice(0, 12).map((x: any) => ({
    title: clean(x?.title, 120), url: cleanUrl(x?.url), price: clean(x?.price, 30), note: clean(x?.note, 200),
  })).filter((x) => x.title);

async function all() {
  const s = store();
  const { blobs } = await s.list({ prefix: "p/" });
  const ps = await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" })));
  return (ps.filter(Boolean) as any[]).sort((a, b) => a.createdAt - b.createdAt);
}
async function byToken(token: string | null) {
  if (!token) return null;
  const h = await sha(token);
  return (await all()).find((p) => p.tokenHash === h) ?? null;
}
const publicP = (p: any) => ({ id: p.id, name: p.name, gifts: p.gifts });
function isAdmin(pin: unknown) {
  const real = Netlify.env.get("ADMIN_PIN");
  return !!real && String(pin ?? "") === real;
}

async function sendEmail(to: string, giver: string, receiver: any, link: string) {
  const key = Netlify.env.get("RESEND_API_KEY");
  const from = Netlify.env.get("EMAIL_FROM");
  if (!key || !from || !to) return false;
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
  const list = receiver.gifts.map((g: any) =>
    `<li><b>${esc(g.title)}</b>${g.price ? " · " + esc(g.price) : ""}${g.url ? ` — <a href="${esc(g.url)}">ver dónde comprar</a>` : ""}${g.note ? `<br><small>${esc(g.note)}</small>` : ""}</li>`).join("");
  const html = `<p>¡Hola ${esc(giver)}!</p><p>En el intercambio de la posada te tocó regalarle a <b style="font-size:20px">${esc(receiver.name)}</b>.</p>${list ? `<p>Su lista de deseos:</p><ul>${list}</ul>` : "<p>Todavía no sube su lista.</p>"}<p>Shhh, es secreto 🤫. También lo puedes ver aquí: <a href="${esc(link)}">${esc(link)}</a></p>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to, subject: "🎁 Tu intercambio de la posada", html }),
  });
  return r.ok;
}

export default async (req: Request, context: Context) => {
  const s = store();
  const url = new URL(req.url);
  const action = context.params.action;
  const body: any = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const token = url.searchParams.get("t") || body.token || null;

  try {
    if (action === "state" && req.method === "GET") {
      const ps = await all();
      const draw: any = await s.get("draw", { type: "json" });
      const me = await byToken(token);
      let mine = null;
      if (me && draw?.pairs?.[me.id]) {
        const r = ps.find((p) => p.id === draw.pairs[me.id]);
        if (r) mine = publicP(r);
      }
      return json({
        participants: ps.map(publicP),
        drawn: !!draw, drawnAt: draw?.drawnAt ?? null,
        me: me ? { id: me.id, name: me.name, email: me.email, gifts: me.gifts } : null,
        mine,
      });
    }

    if (action === "join" && req.method === "POST") {
      if (await s.get("draw")) return bad("El sorteo ya se hizo; ya no se pueden agregar personas.");
      const name = clean(body.name, 40);
      if (!name) return bad("Escribe tu nombre.");
      const ps = await all();
      if (ps.length >= 60) return bad("Ya hay demasiadas personas.");
      if (ps.some((p) => p.name.toLowerCase() === name.toLowerCase()))
        return bad("Ya hay alguien con ese nombre. Agrega tu apellido o apodo.");
      const id = rand(6), tok = rand(18);
      const p = {
        id, name, email: clean(body.email, 120), gifts: cleanGifts(body.gifts),
        tokenHash: await sha(tok), createdAt: Date.now(),
      };
      await s.setJSON("p/" + id, p);
      return json({ id, token: tok });
    }

    if (action === "me" && req.method === "POST") {
      const me = await byToken(token);
      if (!me) return bad("No encontré tu registro. Usa tu link personal.", 404);
      if (body.name !== undefined) {
        const name = clean(body.name, 40);
        if (!name) return bad("Escribe tu nombre.");
        me.name = name;
      }
      if (body.email !== undefined) me.email = clean(body.email, 120);
      if (body.gifts !== undefined) me.gifts = cleanGifts(body.gifts);
      await s.setJSON("p/" + me.id, me);
      return json({ ok: true });
    }

    if (action === "leave" && req.method === "POST") {
      const me = await byToken(token);
      if (!me) return bad("No encontré tu registro.", 404);
      if (await s.get("draw")) return bad("El sorteo ya se hizo; pídele al organizador que lo reinicie.");
      await s.delete("p/" + me.id);
      return json({ ok: true });
    }

    // ---------- organizador ----------
    if (action === "admin" && req.method === "POST") {
      if (!isAdmin(body.pin)) return bad("PIN incorrecto.", 403);
      const ps = await all();
      const draw: any = await s.get("draw", { type: "json" });

      if (body.op === "check") return json({ ok: true, drawn: !!draw });

      if (body.op === "remove") {
        if (draw) return bad("Primero reinicia el sorteo.");
        await s.delete("p/" + clean(body.id, 20));
        return json({ ok: true });
      }

      if (body.op === "reset") {
        await s.delete("draw");
        return json({ ok: true });
      }

      if (body.op === "draw") {
        if (draw) return bad("El sorteo ya se hizo.");
        if (ps.length < 3) return bad("Se necesitan al menos 3 personas.");
        // Barajar y formar un solo círculo: nadie se regala a sí mismo.
        const order = ps.map((p) => p.id);
        for (let i = order.length - 1; i > 0; i--) {
          const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
          [order[i], order[j]] = [order[j], order[i]];
        }
        const pairs: Record<string, string> = {};
        order.forEach((id, i) => (pairs[id] = order[(i + 1) % order.length]));
        await s.setJSON("draw", { drawnAt: Date.now(), pairs });

        // Correo opcional (solo si hay RESEND_API_KEY y EMAIL_FROM configurados)
        let sent = 0;
        if (Netlify.env.get("RESEND_API_KEY")) {
          const results = await Promise.all(ps.map(async (p) => {
            const r = ps.find((x) => x.id === pairs[p.id]);
            return r && p.email ? sendEmail(p.email, p.name, r, url.origin + "/") : false;
          }));
          sent = results.filter(Boolean).length;
        }
        return json({ ok: true, count: ps.length, emailed: sent });
      }
      return bad("Operación desconocida.");
    }

    return bad("Ruta no encontrada.", 404);
  } catch (e: any) {
    console.error(e);
    return bad("Error del servidor: " + (e?.message ?? e), 500);
  }
};

export const config: Config = { path: "/api/:action" };
