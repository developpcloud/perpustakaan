// Pengaturan & fungsi bersama (dipakai index.html dan admin.html)
const API = 'GANTI_DENGAN_URL_APPS_SCRIPT'; // URL Web App dari Apps Script, cukup diisi di sini
const $ = s => document.querySelector(s);
const e = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ph = (id, w = 160) => `https://drive.google.com/thumbnail?id=${id}&sz=w${w}`;
const img = (id, w) => id ? `<img src="${ph(id, w)}" alt="" loading="lazy" onerror="this.remove()">` : '';
let tt;
function toast(m, bad) { const t = $('#toast'); t.textContent = m; t.className = 'show' + (bad ? ' bad' : ''); clearTimeout(tt); tt = setTimeout(() => t.className = '', 2800); }
