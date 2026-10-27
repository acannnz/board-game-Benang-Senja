// Pembantu DOM kecil yang dipakai banyak modul UI.
export const $ = (sel, root = document) => root.querySelector(sel);
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
export const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
export const lsDel = k => { try { localStorage.removeItem(k); } catch (e) {} };

let toastTimer = null;
export function toast(teks, ms = 2600) {
  const el = $('#toast');
  el.textContent = teks; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

// kilatan teks besar di tengah layar (pergantian hari, tukar tubuh, dll.)
export function kilat(judul, sub = '', ms = 2200) {
  const el = $('#flash');
  el.innerHTML = `<div class="teks">${esc(judul)}${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
  el.hidden = false;
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  return sleep(ms).then(() => { el.hidden = true; });
}
