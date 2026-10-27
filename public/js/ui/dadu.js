// Animasi lemparan 2 dadu (kubus CSS 3D) dengan hasil uji.
import { $, esc, sleep } from '../util.js';

// rotasi kubus supaya muka bernilai n menghadap ke depan
const ROT = { 1:[0, 0], 2:[0, -90], 3:[-90, 0], 4:[90, 0], 5:[0, 90], 6:[0, 180] };
const TITIK = { 1:[5], 2:[1, 9], 3:[1, 5, 9], 4:[1, 3, 7, 9], 5:[1, 3, 5, 7, 9], 6:[1, 3, 4, 6, 7, 9] };

function muka(n) {
  let h = '';
  for (let i = 1; i <= 9; i++) h += TITIK[n].includes(i) ? `<i style="grid-area:${Math.ceil(i / 3)}/${((i - 1) % 3) + 1}"></i>` : '';
  return `<div class="face f${n}">${h}</div>`;
}
const kubus = () => `<div class="cube">${[1, 2, 3, 4, 5, 6].map(muka).join('')}</div>`;

export async function lemparDadu({ a, b, bonus, target, ok, judul }) {
  const el = $('#dice');
  const bon = bonus ? (bonus > 0 ? ` + ${bonus}` : ` − ${-bonus}`) : '';
  el.innerHTML = `<div class="dadu-box"><div class="judul">${esc(judul)} · butuh ${target}</div><div class="dadu-row">${kubus()}${kubus()}</div><div class="dadu-hasil"></div></div>`;
  el.hidden = false;
  const cubes = el.querySelectorAll('.cube');
  cubes.forEach(c => { c.style.transition = 'none'; c.style.transform = `rotateX(${Math.random() * 360}deg) rotateY(${Math.random() * 360}deg)`; });
  await sleep(40);
  [a, b].forEach((n, i) => {
    const [rx, ry] = ROT[n], c = cubes[i];
    c.style.transition = '';
    c.style.transform = `rotateX(${rx + 720}deg) rotateY(${ry + 720 + i * 360}deg)`;
  });
  await sleep(1150);
  const h = el.querySelector('.dadu-hasil');
  h.className = 'dadu-hasil ' + (ok ? 'ok' : 'gagal');
  h.textContent = `${a} + ${b}${bon} = ${a + b + bonus} · ${ok ? 'Berhasil!' : 'Gagal'}`;
  await sleep(1100);
  el.hidden = true;
}
