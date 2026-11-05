// Password gate for Crew Table. Every request needs the SITE_PASSWORD secret; then the static app is served.
// Fails closed: if the secret is not set, nobody gets in.
const enc = new TextEncoder();

async function sameText(a, b) {
  const [x, y] = await Promise.all([a, b].map(async s => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))));
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function login(message = 'Password required') {
  return new Response(message, {
    status: 401,
    headers: {'WWW-Authenticate': 'Basic realm="Crew Table", charset="UTF-8"', 'Cache-Control': 'no-store'}
  });
}

export default {
  async fetch(request, env) {
    if (!env.SITE_PASSWORD) {
      return new Response('Password not set. Add the SITE_PASSWORD secret in Cloudflare (see DEPLOY.md).', {status: 503, headers: {'Cache-Control': 'no-store'}});
    }
    const header = request.headers.get('Authorization') || '';
    if (!header.startsWith('Basic ')) return login();
    let user = '', pass = '';
    try {
      const text = new TextDecoder().decode(Uint8Array.from(atob(header.slice(6)), c => c.charCodeAt(0)));
      const i = text.indexOf(':');
      user = text.slice(0, i);
      pass = text.slice(i + 1);
    } catch {
      return login();
    }
    const okPass = await sameText(pass, env.SITE_PASSWORD);
    const okUser = env.SITE_USER ? await sameText(user, env.SITE_USER) : true;
    if (!(okPass && okUser)) return login();
    const res = await env.ASSETS.fetch(request);
    const out = new Response(res.body, res);
    out.headers.set('Cache-Control', 'private, no-store');
    return out;
  }
};
