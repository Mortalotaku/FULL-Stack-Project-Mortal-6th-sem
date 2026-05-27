const API = '';

async function api(path, opts = {}) {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts.headers },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || r.statusText);
  return data;
}

function showMsg(el, text, ok) {
  if (!el) return;
  el.textContent = text;
  el.className = `msg show ${ok ? 'ok' : 'err'}`;
}

window.api = api;
window.showMsg = showMsg;
