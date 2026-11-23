// Halaman admin. Bergantung pada common.js, JSZip, dan qrcodejs.
// Field: [label, petunjuk, bendera] bendera: r = wajib, w = lebar penuh, n = angka, l = pilihan kategori
const DEFS = {
  siswa: {
    sheet: 'Siswa', t: 'Siswa', add: 'Tambah siswa', show: [0, 1, 2], photo: true,
    f: [['NIS', '', 'r'], ['Nama lengkap', '', 'rw'], ['Kelas', 'Contoh: 7A', 'r']]
  },
  buku: {
    sheet: 'Buku', t: 'Buku', add: 'Tambah buku', show: [0, 1, 2, 7, 3, 9],
    f: [['Kode buku', 'Nomor induk, sama dengan stiker QR', 'r'], ['Judul', '', 'rw'], ['Pengarang', '', 'w'],
        ['Stok', 'Jumlah eksemplar', 'rn'], ['Penerbit', ''], ['Tahun terbit', '', 'n'], ['ISBN', ''],
        ['Kategori', 'Pilih atau ketik', 'l'], ['No. klasifikasi', 'Contoh: 510 (DDC)'], ['Rak', 'Contoh: A-2']]
  }
};
const KATEGORI = ['Fiksi', 'Non-fiksi', 'Pelajaran', 'Referensi', 'Agama', 'Sains', 'Sejarah', 'Bahasa', 'Biografi', 'Lainnya'];
let PIN = sessionStorage.apin || '', cache = {}, LIST = [];

async function api(a, d = {}) {
  const r = await fetch(API, { method: 'POST', body: JSON.stringify({ a, pin: PIN, d }) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.err);
  return j;
}
const run = async f => { try { await f(); } catch (x) { toast(x.message === 'Failed to fetch' ? 'Tidak ada koneksi ke server' : x.message, 1); } };

function modal(html, submit) {
  const d = $('#dlg'); d.innerHTML = `<form>${html}</form>`;
  const f = d.firstChild;
  f.onsubmit = async ev => { ev.preventDefault(); try { await submit(new FormData(f)); d.close(); } catch (x) { toast(x.message, 1); } };
  d.showModal();
}
const bar = ok => `<div class="bar"><button type="button" class="btn ghost" onclick="dlg.close()">Batal</button><button class="btn">${ok}</button></div>`;

async function shrink(file) {
  const b = await createImageBitmap(file), s = Math.min(1, 420 / Math.max(b.width, b.height)), c = document.createElement('canvas');
  c.width = Math.round(b.width * s); c.height = Math.round(b.height * s);
  c.getContext('2d').drawImage(b, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', .82).split(',')[1];
}

async function go(v) {
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  $('#view').innerHTML = '<p class="mu">Memuat data…</p>';
  try { await V[v](); } catch (x) { toast(x.message, 1); }
}

async function dash() {
  const d = await api('dash'), m = Math.max(1, ...d.days.map(x => x[1]));
  $('#view').innerHTML = `<div class="top"><h1>Ringkasan</h1></div>
  <div class="stats">${[['Siswa', d.siswa], ['Judul buku', d.buku], ['Sedang dipinjam', d.aktif], ['Terlambat', d.telat, d.telat ? 'er' : '']].map(s => `<div class="box st ${s[2] || ''}"><b>${s[1]}</b><span>${s[0]}</span></div>`).join('')}</div>
  <div class="box"><h3 style="margin-top:0">Kunjungan 7 hari terakhir</h3><div class="bars">${d.days.map(x => `<div><div class="ba"><i style="height:${x[1] / m * 100}%"></i></div><b>${x[1]}</b><span>${new Date(x[0] + 'T12:00').toLocaleDateString('id', { weekday: 'short' })}</span></div>`).join('')}</div></div>`;
}

async function tbl(k) {
  const D = DEFS[k]; cache[k] = (await api('list', { sheet: D.sheet })).rows;
  const ks = k === 'siswa' ? [...new Set(cache[k].map(r => r[2]))].sort((a, b) => a.localeCompare(b, 'id', { numeric: true })) : [];
  const extra = k === 'siswa' ? '<button class="btn ghost" onclick="bulk()">Upload foto massal</button>' : '<button class="btn ghost" onclick="labels()">Cetak label QR</button>';
  $('#view').dataset.k = k;
  $('#view').innerHTML = `<div class="top"><h1>${D.t}</h1><span class="mu" id="cnt"></span><div class="sp"></div>${extra}<button class="btn ghost" onclick="imp('${k}')">Impor dari Excel</button><button class="btn" onclick="edit('${k}')">${D.add}</button></div>
  <div class="tools"><input id="fq" placeholder="Cari ${D.t.toLowerCase()}">${k === 'siswa' ? `<select id="fk"><option value="">Semua kelas</option>${ks.map(x => `<option>${e(x)}</option>`).join('')}</select>` : ''}</div>
  <div class="tw"><table><thead><tr>${D.photo ? '<th></th>' : ''}${D.show.map(i => `<th>${D.f[i][0]}</th>`).join('')}<th></th></tr></thead><tbody id="tb"></tbody></table></div><p class="mu" id="more" style="margin-top:10px"></p>`;
  const fill = () => {
    const q = $('#fq').value.toLowerCase(), kl = $('#fk') ? $('#fk').value : '';
    LIST = cache[k].filter(r => (!q || r.join(' ').toLowerCase().includes(q)) && (!kl || r[2] === kl));
    $('#cnt').textContent = cache[k].length + ' data';
    $('#tb').innerHTML = LIST.slice(0, 200).map(r => `<tr>${D.photo ? `<td><span class="av sm">${e(r[1][0])}${img(r[3], 80)}</span></td>` : ''}${D.show.map(i => `<td>${e(r[i])}</td>`).join('')}<td class="act"><button class="btn ghost sm" data-ed="${e(r[0])}">Ubah</button><button class="btn ghost sm del" data-dl="${e(r[0])}">Hapus</button></td></tr>`).join('')
      || `<tr><td colspan="12" class="empty">${cache[k].length ? 'Tidak ada yang cocok.' : 'Belum ada data. Tambah satu per satu atau impor dari Excel.'}</td></tr>`;
    $('#more').textContent = LIST.length > 200 ? `Menampilkan 200 dari ${LIST.length}. Persempit dengan pencarian.` : '';
  };
  $('#fq').oninput = fill; if ($('#fk')) $('#fk').onchange = fill; fill();
}

function nextKode() {
  const n = Math.max(0, ...cache.buku.map(r => +((r[0].match(/(\d+)$/) || [0, 0])[1])));
  return 'B' + String(n + 1).padStart(4, '0');
}
function edit(k, key) {
  const D = DEFS[k], r = key ? cache[k].find(x => x[0] === key) : (k === 'buku' ? [nextKode(), '', '', '1'] : []);
  const kat = [...new Set([...KATEGORI, ...(cache.buku || []).map(x => x[7]).filter(Boolean)])];
  const fields = D.f.map((f, i) => `<label class="${f[2].includes('w') ? 'w' : ''}">${f[0]}<input name="f${i}" type="${f[2].includes('n') ? 'number' : 'text'}" ${f[2].includes('n') ? 'min="0"' : ''} ${f[2].includes('l') ? 'list="kat"' : ''} placeholder="${e(f[1])}" value="${e(r[i] || '')}" ${f[2].includes('r') ? 'required' : ''}></label>`).join('');
  const foto = D.photo ? (key ? `<div class="w cur"><span class="av">${e(r[1][0])}${img(r[3], 200)}</span><label style="flex:1;margin:0">Foto siswa<input type="file" name="foto" accept="image/*"></label></div>` : '<p class="mu w" style="grid-column:1/-1;margin-bottom:8px">Foto bisa ditambahkan setelah data disimpan, atau lewat upload foto massal.</p>') : '';
  modal(`<h2>${key ? 'Ubah' : 'Tambah'} ${D.t.toLowerCase()}</h2><datalist id="kat">${kat.map(x => `<option value="${e(x)}">`).join('')}</datalist><div class="fg">${fields}${foto}</div>` + bar('Simpan'),
    async f => {
      await api('save', { sheet: D.sheet, old: key || '', row: D.f.map((_, i) => f.get('f' + i)) });
      const file = D.photo && f.get('foto');
      if (file && file.size) await api('foto', { items: [{ nis: f.get('f0').trim(), data: await shrink(file) }] });
      toast('Tersimpan'); tbl(k);
    });
}
function imp(k) {
  const D = DEFS[k];
  modal(`<h2>Impor ${D.t.toLowerCase()} dari Excel</h2><p class="mu" style="margin-bottom:12px">Salin sel dari Excel atau Google Sheets dengan urutan kolom: ${D.f.map(f => f[0]).join(', ')}. Tempel di bawah. Data dengan ${D.f[0][0]} yang sudah ada akan diperbarui.</p><label><textarea name="t" required></textarea></label>` + bar('Impor'),
    async f => {
      const n = D.f.length;
      const rs = f.get('t').split(/\r?\n/).map(l => l.split(l.includes('\t') ? '\t' : ',').slice(0, n).map(x => x.trim())).filter(r => r[0] && r[0].toLowerCase() !== D.f[0][0].toLowerCase());
      if (!rs.length) throw new Error('Tidak ada baris data');
      const j = await api('imp', { sheet: D.sheet, rows: rs }); toast(j.n + ' baris diproses'); tbl(k);
    });
}

function bulk() {
  const d = $('#dlg');
  d.innerHTML = `<h2>Upload foto massal</h2><p class="mu" style="margin-bottom:12px">Pilih file ZIP berisi foto yang diberi nama sesuai NIS, misalnya 12345.jpg. File RAR tidak bisa dibaca browser, jadi ekstrak dulu lalu kompres ulang menjadi ZIP. Foto dikecilkan otomatis sebelum diunggah.</p><label><input type="file" id="zf" accept=".zip"></label><div class="prog"><i id="pg"></i></div><p id="pt" class="mu"></p><div class="bar"><button class="btn ghost" onclick="dlg.close()">Tutup</button><button class="btn" id="go">Mulai upload</button></div>`;
  d.showModal();
  $('#go').onclick = () => run(async () => {
    const f = $('#zf').files[0]; if (!f) throw new Error('Pilih file ZIP dulu');
    $('#go').disabled = true;
    const z = await JSZip.loadAsync(f), nis = new Set(cache.siswa.map(r => r[0]));
    const ents = Object.values(z.files).filter(x => !x.dir && /\.(jpe?g|png|webp)$/i.test(x.name) && !x.name.includes('__MACOSX'));
    if (!ents.length) { $('#go').disabled = false; throw new Error('Tidak ada file foto di dalam ZIP'); }
    let ok = 0, skip = [], batch = [];
    const flush = async () => { if (batch.length) { await api('foto', { items: batch }); ok += batch.length; batch = []; } };
    try {
      for (let i = 0; i < ents.length; i++) {
        const id = ents[i].name.split('/').pop().replace(/\.[^.]+$/, '').trim();
        if (nis.has(id)) batch.push({ nis: id, data: await shrink(await ents[i].async('blob')) }); else skip.push(id);
        if (batch.length >= 6) await flush();
        $('#pg').style.width = ((i + 1) / ents.length * 100) + '%';
        $('#pt').textContent = `Memproses ${i + 1} dari ${ents.length} foto…`;
      }
      await flush();
    } finally { $('#go').disabled = false; }
    $('#pt').innerHTML = `<b style="color:var(--ok)">${ok} foto berhasil diunggah.</b>` + (skip.length ? `<br>${skip.length} file dilewati karena namanya bukan NIS terdaftar: ${e(skip.slice(0, 12).join(', '))}${skip.length > 12 ? ', dan lainnya' : ''}` : '');
    tbl('siswa');
  });
}

function labels() {
  if (!LIST.length) return toast('Tidak ada buku untuk dicetak', 1);
  const h = document.createElement('div'); h.id = 'lab';
  h.innerHTML = LIST.slice(0, 300).map(r => `<div class="lb"><div class="q" data-n="${e(r[0])}"></div><div><b>${e(r[0])}</b><span>${e(r[1].slice(0, 40))}</span></div></div>`).join('');
  document.body.append(h);
  h.querySelectorAll('.q').forEach(el => new QRCode(el, { text: el.dataset.n, width: 64, height: 64 }));
  setTimeout(() => { print(); h.remove(); }, 300);
}

async function pinjam() {
  const j = await api('list', { sheet: 'Peminjaman' }), t = new Date().toLocaleDateString('sv');
  const rs = j.rows.sort((a, b) => a[7].localeCompare(b[7]));
  $('#view').innerHTML = `<div class="top"><h1>Pinjaman aktif</h1><span class="mu">${rs.length} buku</span></div><div class="tw"><table><thead><tr><th>Siswa</th><th>Kelas</th><th>Buku</th><th>Jatuh tempo</th><th></th></tr></thead><tbody>${rs.map(r => `<tr><td>${e(r[3])}</td><td>${e(r[4])}</td><td>${e(r[6])}</td><td>${e(r[7])}${r[7] < t ? '<span class="pill">Terlambat</span>' : ''}</td><td class="act"><button class="btn ghost sm" data-rt="${e(r[0])}">Tandai kembali</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty">Tidak ada buku yang sedang dipinjam.</td></tr>'}</tbody></table></div>`;
}
async function atur() {
  const c = (await api('cfgGet')).c, i = (n, l, x = '') => `<label>${l}<input name="${n}" value="${e(c[n])}" ${x}></label>`;
  $('#view').innerHTML = `<div class="top"><h1>Pengaturan</h1></div><form class="box set" id="sf"><h3 style="margin-top:0">Identitas</h3>${i('sekolah', 'Nama sekolah', 'required')}${i('petugas', 'Nama petugas perpustakaan')}<h3>Peminjaman</h3><div class="two">${i('lama', 'Lama pinjam (hari)', 'type="number" min="1" required')}${i('maks', 'Maksimal buku per siswa', 'type="number" min="1" required')}</div><h3>Keamanan</h3>${i('pin', 'PIN petugas', 'required')}<small style="display:block;margin:-4px 0 16px">PIN admin diatur di Code.gs pada baris ADMIN_PIN.</small><button class="btn">Simpan pengaturan</button></form>`;
  $('#sf').onsubmit = ev => { ev.preventDefault(); run(async () => { await api('cfgSet', Object.fromEntries(new FormData(ev.target))); toast('Pengaturan tersimpan'); }); };
}
const V = { dash, siswa: () => tbl('siswa'), buku: () => tbl('buku'), pinjam, atur };

document.addEventListener('click', ev => {
  const t = ev.target.closest('[data-v],[data-ed],[data-dl],[data-rt]'); if (!t) return;
  const k = $('#view').dataset.k;
  if (t.dataset.v) { $('#view').dataset.k = ''; go(t.dataset.v); }
  if (t.dataset.ed) edit(k, t.dataset.ed);
  if (t.dataset.dl && confirm('Hapus data ' + t.dataset.dl + '?')) run(async () => { await api('del', { sheet: DEFS[k].sheet, key: t.dataset.dl }); toast('Dihapus'); tbl(k); });
  if (t.dataset.rt) run(async () => { await api('ret', { id: t.dataset.rt }); toast('Buku ditandai kembali'); pinjam(); });
});
async function enter() { $('#login').hidden = true; $('#app').hidden = false; go('dash'); }
$('#lf').onsubmit = async ev => {
  ev.preventDefault(); PIN = $('#pin').value;
  try { await api('dash'); sessionStorage.apin = PIN; enter(); } catch (x) { toast(x.message.includes('PIN') ? 'PIN admin salah' : x.message, 1); }
};
if (!API.startsWith('http')) toast('Isi dulu URL Apps Script di common.js', 1);
else if (PIN) api('dash').then(enter).catch(() => sessionStorage.removeItem('apin'));
