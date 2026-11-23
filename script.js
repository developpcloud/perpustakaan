let SEKOLAH='',MAKS=2;
const today=()=>new Date().toLocaleDateString('sv');
let S={siswa:[],buku:[],aktif:[],hari:[]},mode='kunjungan',cur=null,cam=null,facing='environment',last={t:'',at:0};

async function api(a,d={}){
  if(!localStorage.pin)localStorage.pin=prompt('Masukkan PIN petugas')||'';
  const r=await fetch(`${API}?a=${a}&pin=${encodeURIComponent(localStorage.pin)}&d=${encodeURIComponent(JSON.stringify(d))}`);
  const j=await r.json();
  if(!j.ok){if(j.err==='PIN salah')localStorage.removeItem('pin');throw new Error(j.err)}
  return j;
}
function beep(ok=1){try{const c=new AudioContext(),o=c.createOscillator();o.connect(c.destination);o.frequency.value=ok?880:200;o.start();o.stop(c.currentTime+.13)}catch{}}
async function run(f){try{await f()}catch(x){toast(x.message==='Failed to fetch'?'Tidak ada koneksi ke server':x.message,1);beep(0)}}

const loanObj=r=>({id:r[0],nis:r[2],nama:r[3],kelas:r[4],kode:r[5],judul:r[6],due:r[7]});
async function load(){
  const j=await api('init');
  S.siswa=j.siswa.map(r=>({nis:r[0],nama:r[1],kelas:r[2],foto:r[3]}));
  S.buku=j.buku.map(r=>({kode:r[0],judul:r[1],peng:r[2],stok:+r[3]||1}));
  S.aktif=j.aktif.map(loanObj);
  S.hari=j.hari.map(r=>({t:r[0],nis:r[1],nama:r[2],kelas:r[3]}));
  SEKOLAH=j.cfg.sekolah;MAKS=+j.cfg.maks;$('#nm').textContent='Perpustakaan '+SEKOLAH;$('#petugas').textContent='Petugas: '+j.cfg.petugas;
  const ks=[...new Set(S.siswa.map(s=>s.kelas))].sort((a,b)=>a.localeCompare(b,'id',{numeric:true}));
  $('#kelas').innerHTML='<option value="">Semua kelas</option>'+ks.map(k=>`<option>${e(k)}</option>`).join('');
  $('#kelas2').innerHTML='<option value="">Semua kelas</option>'+ks.map(k=>`<option>${e(k)}</option>`).join('');
  render();
}
const avail=b=>b.stok-S.aktif.filter(l=>l.kode===b.kode).length;

function render(){
  $('#stat').innerHTML=`Hari ini <b>${S.hari.length}</b> pengunjung, <b>${S.aktif.length}</b> buku sedang dipinjam`;
  renderPanel();renderHits();
  $('#logBox').hidden=mode!=='kunjungan';
  $('#log').innerHTML=S.hari.slice(0,30).map(v=>`<div class="log"><div><b>${e(v.nama)}</b> <small style="color:var(--mu)">${e(v.kelas)}</small></div><span>${v.t.slice(11,16)}</span></div>`).join('')||'<p class="empty">Belum ada pengunjung.</p>';
  if(mode==='kartu')renderCards();
}
function renderPanel(){
  const p=$('#panel');
  if(!cur){
    const t={kunjungan:['Catat kunjungan','Scan kartu anggota siswa, atau cari manual jika kartu tertinggal.'],pinjam:['Peminjaman buku','Scan kartu siswa, lalu pilih atau scan buku yang dipinjam.'],kembali:['Pengembalian buku','Scan kartu siswa untuk melihat pinjamannya, atau langsung scan kode buku.']}[mode];
    p.innerHTML=`<div class="idle"><h3>${t[0]}</h3><p>${t[1]}</p></div>`;return;
  }
  const L=S.aktif.filter(l=>l.nis===cur.nis);
  p.innerHTML=`<div class="who"><div class="av">${e(cur.nama[0])}${img(cur.foto)}</div><div><h3>${e(cur.nama)}</h3><p>Kelas ${e(cur.kelas)}</p><p>NIS ${e(cur.nis)}</p></div><button class="x" id="clr" aria-label="Tutup">✕</button></div>`+
  (mode==='kunjungan'?'<span class="stamp">TERCATAT</span>':
  `<h4>Sedang dipinjam (${L.length} dari ${MAKS})</h4>`+(L.map(l=>`<div class="loan"><div><b>${e(l.judul)}</b><small>Kembali sebelum ${e(l.due)}</small></div>${l.due<today()?'<span class="pill off">Terlambat</span>':''}${mode==='kembali'?`<button class="btn sm" data-r="${l.id}">Kembalikan</button>`:''}</div>`).join('')||'<p class="empty">Tidak ada pinjaman.</p>'));
}
function renderHits(){
  const q=$('#q').value.trim().toLowerCase(),k=$('#kelas').value;let h='';
  if(mode==='pinjam'&&cur){
    h=S.buku.filter(b=>!q||(b.kode+b.judul+b.peng).toLowerCase().includes(q)).slice(0,40).map(b=>{const a=avail(b);
      return `<button class="row" ${a?'':'disabled'} data-b="${e(b.kode)}"><b>${e(b.judul)}</b><small>${e(b.peng)}</small><span class="pill ${a?'':'off'}">${a?a+' tersedia':'Habis'}</span></button>`}).join('');
  }else if(q||k){
    h=S.siswa.filter(s=>(!k||s.kelas===k)&&(!q||(s.nis+' '+s.nama).toLowerCase().includes(q))).slice(0,40).map(s=>`<button class="row" data-s="${e(s.nis)}"><span class="av sm">${e(s.nama[0])}${img(s.foto,80)}</span><b>${e(s.nama)}</b><small>Kelas ${e(s.kelas)}, NIS ${e(s.nis)}</small></button>`).join('');
  }else h='<p class="empty">Pilih kelas atau ketik nama untuk mencari siswa.</p>';
  $('#hits').innerHTML=h||'<p class="empty">Tidak ditemukan.</p>';
  $('#q').placeholder=mode==='pinjam'&&cur?'Scan atau cari judul buku':'Scan atau ketik NIS, nama';
}

async function pick(nis,via){
  const s=S.siswa.find(x=>x.nis===nis);if(!s)throw new Error('Siswa tidak terdaftar');
  cur=s;
  if(mode==='kunjungan'){
    const dup=S.hari.find(v=>v.nis===nis&&Date.now()-new Date(v.t.replace(' ','T'))<6e5);
    if(dup){toast(s.nama+' sudah tercatat tadi');}
    else{const j=await api('visit',{nis,via});S.hari.unshift({t:j.t,nis,nama:s.nama,kelas:s.kelas});beep();toast('Selamat datang, '+s.nama.split(' ')[0]);}
  }else beep();
  $('#q').value='';render();
}
async function doLoan(s,b){
  if(S.aktif.filter(l=>l.nis===s.nis).length>=MAKS)throw new Error('Batas pinjam '+MAKS+' buku tercapai');
  if(avail(b)<1)throw new Error('Stok buku habis');
  const j=await api('loan',{nis:s.nis,kode:b.kode});
  S.aktif.push({id:j.id,nis:s.nis,nama:s.nama,kelas:s.kelas,kode:b.kode,judul:b.judul,due:j.due});
  beep();toast('Dipinjam: '+b.judul);$('#q').value='';render();
}
async function doReturn(id){
  const l=S.aktif.find(x=>x.id===id);await api('ret',{id});
  S.aktif=S.aktif.filter(x=>x.id!==id);
  if(!cur){cur=S.siswa.find(s=>s.nis===l.nis)||null}
  beep();toast('Dikembalikan: '+l.judul);render();
}
function handle(t){
  t=t.trim();if(!t)return;
  const s=S.siswa.find(x=>x.nis===t),b=S.buku.find(x=>x.kode===t);
  if(mode==='kembali'){const l=S.aktif.find(x=>x.kode===t);if(l)return run(()=>doReturn(l.id))}
  if(mode==='pinjam'&&cur&&b)return run(()=>doLoan(cur,b));
  if(s)return run(()=>pick(s.nis,'Scan kartu'));
  toast('Kode tidak dikenali',1);beep(0);
}
function onScan(t){if(t===last.t&&Date.now()-last.at<3000)return;last={t,at:Date.now()};handle(t)}

async function toggleCam(){
  if(cam){try{await cam.stop()}catch{}cam=null;$('#camBtn').textContent='Nyalakan kamera';$('#reader').classList.remove('on');$('#reader').innerHTML='';return}
  $('#reader').classList.add('on');cam=new Html5Qrcode('reader');
  try{await cam.start({facingMode:facing},{fps:10,qrbox:{width:230,height:230}},onScan);$('#camBtn').textContent='Matikan kamera'}
  catch{toast('Kamera tidak bisa dibuka. Cek izin kamera di browser.',1);cam=null;$('#reader').classList.remove('on')}
}

function setMode(m){
  mode=m;cur=null;
  document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.m===m));
  $('#main').hidden=m==='kartu';$('#cardsView').hidden=m!=='kartu';
  if(m==='kartu'&&cam)toggleCam();
  render();
}
function renderCards(){
  const k=$('#kelas2').value;
  $('#sheet').innerHTML=S.siswa.filter(s=>!k||s.kelas===k).map(s=>`<div class="idc"><div class="idh"><b>${e(SEKOLAH)}</b>Kartu Anggota Perpustakaan</div><div class="idb"><div class="idp">${e(s.nama[0])}${img(s.foto,240)}</div><div><h4>${e(s.nama)}</h4><p>Kelas ${e(s.kelas)}</p><p>NIS ${e(s.nis)}</p></div><div class="qr" data-n="${e(s.nis)}"></div></div></div>`).join('');
  document.querySelectorAll('.qr').forEach(el=>new QRCode(el,{text:el.dataset.n,width:84,height:84,correctLevel:QRCode.CorrectLevel.M}));
}

$('#tabs').onclick=ev=>{const m=ev.target.dataset.m;if(m)setMode(m)};
$('#camBtn').onclick=toggleCam;
$('#flip').onclick=async()=>{facing=facing==='user'?'environment':'user';if(cam){await toggleCam();toggleCam()}};
$('#q').oninput=renderHits;$('#kelas').onchange=renderHits;$('#kelas2').onchange=renderCards;
$('#q').onkeydown=ev=>{if(ev.key==='Enter'){const v=ev.target.value.trim();if(S.siswa.some(s=>s.nis===v)||S.buku.some(b=>b.kode===v)){handle(v);ev.target.value='';renderHits()}}};
document.addEventListener('click',ev=>{
  const t=ev.target.closest('[data-s],[data-b],[data-r],#clr');if(!t)return;
  if(t.id==='clr'){cur=null;return render()}
  if(t.dataset.s)run(()=>pick(t.dataset.s,'Manual'));
  if(t.dataset.b)run(()=>doLoan(cur,S.buku.find(b=>b.kode===t.dataset.b)));
  if(t.dataset.r)run(()=>doReturn(t.dataset.r));
});
render();
if(API.startsWith('http'))run(load);else toast('Isi dulu URL Apps Script di index.html',1);
