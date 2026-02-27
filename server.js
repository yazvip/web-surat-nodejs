const express = require('express');
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const multer = require('multer');
const libre = require('libreoffice-convert');
const QRCode = require('qrcode'); // Library QR Code
libre.convertAsync = require('util').promisify(libre.convert); 

const app = express();
const PORT = 3000;

// ==========================================
// 1. PENGATURAN DIREKTORI & DATABASE JSON
// ==========================================
const DB_FILE = path.join(__dirname, 'database.json');
const DIR_TEMPLATES = path.join(__dirname, 'uploads', 'templates');
const DIR_DOWNLOADS = path.join(__dirname, 'public', 'downloads');
const DIR_QR = path.join(__dirname, 'uploads', 'qr');

// Buat folder jika belum ada
if (!fs.existsSync(DIR_TEMPLATES)) fs.mkdirSync(DIR_TEMPLATES, { recursive: true });
if (!fs.existsSync(DIR_DOWNLOADS)) fs.mkdirSync(DIR_DOWNLOADS, { recursive: true });
if (!fs.existsSync(DIR_QR)) fs.mkdirSync(DIR_QR, { recursive: true });

// Inisialisasi Database JSON beserta Pengaturan Default
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ 
        templates: [], 
        surat: [],
        settings: {
            gunakanQR: false
        }
    }, null, 4));
} else {
    let db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    if (!db.settings) {
        db.settings = { gunakanQR: false };
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 4));
    }
}

const readDB = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 4));

// Pengaturan Upload Multer untuk Template (File Kosong)
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, DIR_TEMPLATES),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Pengaturan Upload Multer KHUSUS untuk Arsip Manual (Langsung ke folder Downloads)
const storageArsip = multer.diskStorage({
    destination: (req, file, cb) => cb(null, DIR_DOWNLOADS),
    filename: (req, file, cb) => {
        let namaPemohon = req.body.namaPemohon || 'Manual';
        const safeName = namaPemohon.replace(/[^a-zA-Z0-9]/g, '_');
        const uniqueSuffix = Date.now().toString().slice(-5);
        cb(null, `Arsip_${safeName}_${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});
const uploadArsip = multer({ storage: storageArsip });

app.use(express.urlencoded({ extended: true }));
app.use('/downloads', express.static(DIR_DOWNLOADS));

// ==========================================
// 2. TAMPILAN WEB UI (HTML & TAILWIND)
// ==========================================

const layoutHTML = (title, content, activeMenu, extraScript = '') => `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Sistem Surat Desa</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://unpkg.com/feather-icons"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <style>body { font-family: 'Inter', sans-serif; background-color: #f1f5f9; }</style>
</head>
<body class="flex h-screen overflow-hidden">
    <!-- Sidebar -->
    <aside class="w-64 bg-slate-800 text-white flex flex-col hidden md:flex">
        <div class="h-16 flex items-center px-6 bg-slate-900 border-b border-slate-700 shrink-0">
            <h1 class="text-lg font-bold flex items-center gap-2 text-blue-400">
                <i data-feather="hexagon"></i> SIDesa
            </h1>
        </div>
        <nav class="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            <a href="/" class="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeMenu === 'dashboard' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}">
                <i data-feather="home" class="w-5 h-5"></i> Dashboard
            </a>
            <a href="/templates" class="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeMenu === 'templates' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}">
                <i data-feather="file-text" class="w-5 h-5"></i> Kelola Template
            </a>
            <a href="/pengaturan" class="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeMenu === 'pengaturan' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}">
                <i data-feather="settings" class="w-5 h-5"></i> Pengaturan
            </a>
        </nav>
        <div class="p-4 bg-slate-900 text-xs text-slate-400 text-center shrink-0">V.5.2 - Arsip Manual</div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 flex flex-col h-screen overflow-hidden">
        <header class="h-16 bg-white shadow-sm flex items-center px-6 shrink-0 md:hidden">
            <h1 class="text-lg font-bold text-slate-800 flex items-center gap-2">
                <i data-feather="hexagon" class="text-blue-600 w-5 h-5"></i> SIDesa
            </h1>
            <div class="ml-auto flex gap-4 text-sm">
                <a href="/" class="${activeMenu === 'dashboard' ? 'text-blue-600 font-bold' : 'text-slate-600'}">Arsip</a>
                <a href="/pengaturan" class="${activeMenu === 'pengaturan' ? 'text-blue-600 font-bold' : 'text-slate-600'}">Seting</a>
            </div>
        </header>
        <div class="flex-1 p-4 md:p-8 overflow-y-auto">
            ${content}
        </div>
    </main>
    <script>feather.replace();</script>
    ${extraScript}
</body>
</html>
`;

// ==========================================
// 3. LOGIKA BACKEND & ROUTING
// ==========================================

// HALAMAN 1: Dashboard (Statistik & Daftar Surat)
app.get('/', (req, res) => {
    const db = readDB();
    const suratList = db.surat.reverse(); 

    // Kalkulasi Statistik
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const suratBulanIni = suratList.filter(s => {
        if(!s.tanggalDibuat) return false;
        const parts = s.tanggalDibuat.split('/');
        return parseInt(parts[1]) === currentMonth && parseInt(parts[2]?.substring(0,4)) === currentYear;
    }).length;

    // Komponen Statistik
    const statsHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center gap-4">
                <div class="bg-blue-100 p-4 rounded-lg text-blue-600"><i data-feather="file-text" class="w-8 h-8"></i></div>
                <div><p class="text-sm text-slate-500 font-medium">Total Surat Terbit</p><h3 class="text-2xl font-bold text-slate-800">${suratList.length}</h3></div>
            </div>
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center gap-4">
                <div class="bg-emerald-100 p-4 rounded-lg text-emerald-600"><i data-feather="bar-chart-2" class="w-8 h-8"></i></div>
                <div><p class="text-sm text-slate-500 font-medium">Surat Bulan Ini</p><h3 class="text-2xl font-bold text-slate-800">${suratBulanIni}</h3></div>
            </div>
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center gap-4">
                <div class="bg-amber-100 p-4 rounded-lg text-amber-600"><i data-feather="layers" class="w-8 h-8"></i></div>
                <div><p class="text-sm text-slate-500 font-medium">Template Aktif</p><h3 class="text-2xl font-bold text-slate-800">${db.templates.length}</h3></div>
            </div>
        </div>
    `;

    let tableRows = suratList.length === 0 
        ? `<tr><td colspan="6" class="px-6 py-8 text-center text-slate-500">Belum ada surat yang dibuat.</td></tr>` 
        : suratList.map((s, index) => `
        <tr class="border-b hover:bg-slate-50 transition-colors bg-white">
            <td class="px-6 py-4 text-sm text-slate-600">${index + 1}</td>
            <td class="px-6 py-4">
                <div class="font-semibold text-slate-800 flex items-center gap-2">
                    ${s.jenisSurat}
                    ${s.templateId === 'manual' ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">MANUAL</span>' : ''}
                </div>
                <div class="text-xs text-slate-500 mt-1">${s.nomorSurat || '-'}</div>
            </td>
            <td class="px-6 py-4 text-sm text-slate-800 font-medium">${s.namaPemohon}</td>
            <td class="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">${s.tanggalDibuat}</td>
            <td class="px-6 py-4 flex gap-2">
                <a href="/preview-pdf/${s.filename}" target="_blank" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 text-rose-700 rounded-md hover:bg-rose-200 hover:shadow transition text-sm font-semibold border border-rose-200" title="Cetak PDF">
                    <i data-feather="printer" class="w-4 h-4"></i> Cetak PDF
                </a>
                <a href="/downloads/${s.filename}" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100 hover:shadow transition text-sm font-semibold border border-indigo-200" title="Unduh File Word">
                    <i data-feather="download" class="w-4 h-4"></i> Word
                </a>
            </td>
        </tr>
    `).join('');

    let extraScript = `
        <script>
            ${req.query.success ? `Swal.fire({toast: true, position: 'top-end', icon: 'success', title: 'Berhasil disimpan!', showConfirmButton: false, timer: 3000}); window.history.replaceState(null, null, window.location.pathname);` : ''}
            ${req.query.success_upload ? `Swal.fire({toast: true, position: 'top-end', icon: 'success', title: 'Arsip Manual Berhasil Diupload!', showConfirmButton: false, timer: 3000}); window.history.replaceState(null, null, window.location.pathname);` : ''}
            
            function searchTable() {
                let input = document.getElementById("searchInput").value.toLowerCase();
                let rows = document.querySelectorAll("tbody tr");
                rows.forEach(row => { row.style.display = row.innerText.toLowerCase().includes(input) ? "" : "none"; });
            }

            function toggleModal() {
                const modal = document.getElementById('modalUpload');
                modal.classList.toggle('hidden');
            }
        </script>
    `;

    const content = `
        ${statsHTML}
        
        <!-- Modal Upload Arsip Manual -->
        <div id="modalUpload" class="hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
                <div class="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 class="font-bold text-slate-800 flex items-center gap-2">
                        <i data-feather="upload-cloud" class="text-blue-600"></i> Upload Arsip Manual
                    </h3>
                    <button onclick="toggleModal()" class="text-slate-400 hover:text-red-500 bg-white rounded-full p-1 hover:bg-red-50 transition"><i data-feather="x" class="w-5 h-5"></i></button>
                </div>
                <form action="/upload-arsip" method="POST" enctype="multipart/form-data" class="p-6 space-y-5">
                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-1.5">Jenis Surat</label>
                        <input type="text" name="jenisSurat" required placeholder="Contoh: Surat Pengantar KTP" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition">
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-1.5">Nama Pemohon</label>
                        <input type="text" name="namaPemohon" required placeholder="Contoh: Budi Santoso" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition">
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-1.5">Nomor Surat</label>
                        <input type="text" name="nomorSurat" required placeholder="Contoh: 145/001/DS/I/2026" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition">
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-1.5">File Dokumen (.docx)</label>
                        <input type="file" name="fileArsip" accept=".docx" required class="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 cursor-pointer text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <p class="text-xs text-slate-500 mt-1">Hanya menerima file berformat Microsoft Word (.docx).</p>
                    </div>
                    <div class="pt-2">
                        <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-600/30 transition flex justify-center items-center gap-2">
                            <i data-feather="save" class="w-4 h-4"></i> Simpan ke Arsip
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <div class="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
            <div>
                <h2 class="text-xl font-bold text-slate-800">Arsip Surat Terbit</h2>
            </div>
            <div class="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <div class="relative flex-1 sm:w-64">
                    <i data-feather="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"></i>
                    <input type="text" id="searchInput" onkeyup="searchTable()" placeholder="Cari Nama / Nomor..." class="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm transition shadow-sm">
                </div>
                <!-- Tombol Upload Arsip Manual Baru -->
                <button onclick="toggleModal()" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-md flex items-center justify-center gap-2 transition shrink-0">
                    <i data-feather="upload" class="w-4 h-4"></i> Upload Arsip
                </button>
                <a href="/templates" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-md flex items-center justify-center gap-2 transition shrink-0">
                    <i data-feather="plus" class="w-4 h-4"></i> Buat Surat
                </a>
            </div>
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full text-left whitespace-nowrap">
                    <thead class="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-xs font-bold">
                        <tr><th class="px-6 py-4 w-16">No</th><th class="px-6 py-4">Jenis & Nomor Surat</th><th class="px-6 py-4">Nama Pemohon</th><th class="px-6 py-4">Waktu Dibuat</th><th class="px-6 py-4 w-64">Aksi File</th></tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        </div>
    `;
    res.send(layoutHTML('Dashboard', content, 'dashboard', extraScript));
});

// ROUTE BARU: Proses Upload Arsip Manual
app.post('/upload-arsip', uploadArsip.single('fileArsip'), (req, res) => {
    try {
        if (!req.file) return res.send("Gagal mengupload file arsip.");
        
        const db = readDB();
        
        // Simpan data arsip ke database
        db.surat.push({
            id: Date.now().toString(),
            templateId: 'manual', // Penanda bahwa ini arsip upload manual
            jenisSurat: req.body.jenisSurat,
            namaPemohon: req.body.namaPemohon,
            nomorSurat: req.body.nomorSurat,
            tanggalDibuat: new Date().toLocaleString('id-ID'), // Tanggal Otomatis di server
            filename: req.file.filename
        });
        
        writeDB(db);
        
        // Kembali ke dashboard dengan query sukses
        res.redirect('/?success_upload=1');
    } catch (error) {
        console.error("Error Upload Arsip:", error);
        res.status(500).send("Terjadi kesalahan saat menyimpan arsip manual.");
    }
});

// HALAMAN PENGATURAN (Format Per-Template & QR)
app.get('/pengaturan', (req, res) => {
    const db = readDB();
    const settings = db.settings;
    
    // Looping semua template untuk dibuatkan form setting mandiri
    const templatesSettingHTML = db.templates.length === 0 
        ? `<div class="p-6 text-center text-slate-500 bg-slate-50 border border-slate-200 rounded-xl">Belum ada template. Silakan upload template terlebih dahulu di menu Kelola Template.</div>`
        : db.templates.map(t => `
            <div class="p-5 border border-slate-200 rounded-xl bg-slate-50/50 space-y-4 hover:border-blue-300 transition-colors">
                <h4 class="font-bold text-slate-800 flex items-center gap-2">
                    <i data-feather="file-text" class="w-4 h-4 text-blue-600"></i> ${t.namaTemplate}
                </h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-slate-600 mb-1">Format Nomor Surat</label>
                        <input type="text" name="format_${t.id}" value="${t.formatNomor || '145/[NOMOR]/DS/[BULAN]/[TAHUN]'}" required class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm transition">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-600 mb-1">Terakhir Dicetak (Angka)</label>
                        <input type="number" name="nomor_${t.id}" value="${t.nomorTerakhir || 0}" required class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm transition">
                    </div>
                </div>
            </div>
        `).join('');

    const content = `
        <h2 class="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><i data-feather="settings"></i> Pengaturan Sistem</h2>
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 max-w-4xl">
            <form action="/simpan-pengaturan" method="POST" class="space-y-8">
                
                <!-- Section 1: Pengaturan Global -->
                <div>
                    <h3 class="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Pengaturan Global</h3>
                    <label class="flex items-center gap-3 cursor-pointer p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition">
                        <div class="relative">
                            <input type="checkbox" name="gunakanQR" value="true" class="sr-only" ${settings.gunakanQR ? 'checked' : ''}>
                            <div class="block bg-slate-200 w-14 h-8 rounded-full transition-colors border-2 border-slate-300 peer-checked:bg-blue-600"></div>
                            <div class="dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform shadow"></div>
                        </div>
                        <div>
                            <span class="block text-sm font-bold text-slate-700">Aktifkan Tanda Tangan QR Code</span>
                            <span class="block text-xs text-slate-500 mt-0.5">Sistem akan menyisipkan gambar QR Code (Gunakan tag <strong>{%QR_CODE}</strong> di Word).</span>
                        </div>
                    </label>
                </div>

                <!-- Section 2: Pengaturan Per Template -->
                <div>
                    <div class="flex items-end justify-between mb-4 border-b pb-2">
                        <h3 class="text-lg font-bold text-slate-800">Format Penomoran per Jenis Surat</h3>
                    </div>
                    
                    <div class="p-4 bg-blue-50 rounded-lg border border-blue-100 flex gap-3 mb-4">
                        <i data-feather="info" class="text-blue-500 shrink-0"></i>
                        <p class="text-sm text-blue-800">Gunakan tag <strong>[NOMOR]</strong>, <strong>[BULAN]</strong>, dan <strong>[TAHUN]</strong> pada format agar otomatis berubah. Setiap jenis surat kini memiliki hitungan nomor urutnya masing-masing.</p>
                    </div>

                    <div class="space-y-4">
                        ${templatesSettingHTML}
                    </div>
                </div>

                <style> input:checked ~ .dot { transform: translateX(100%); } input:checked ~ .block { background-color: #2563eb; border-color: #2563eb; } </style>

                <div class="mt-8 pt-6 border-t border-slate-200">
                    <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-md transition flex items-center gap-2">
                        <i data-feather="save" class="w-4 h-4"></i> Simpan Semua Pengaturan
                    </button>
                </div>
            </form>
        </div>
    `;
    res.send(layoutHTML('Pengaturan', content, 'pengaturan', req.query.success ? `<script>Swal.fire({toast:true,position:'top-end',icon:'success',title:'Pengaturan berhasil disimpan!',showConfirmButton:false,timer:3000});window.history.replaceState(null,null,'/pengaturan');</script>` : ''));
});

// PROSES: Simpan Pengaturan (Global & Per-Template)
app.post('/simpan-pengaturan', (req, res) => {
    const db = readDB();
    
    // Simpan pengaturan global
    db.settings.gunakanQR = req.body.gunakanQR === 'true'; 

    // Simpan pengaturan tiap template
    db.templates = db.templates.map(t => {
        if (req.body[`format_${t.id}`] !== undefined) {
            t.formatNomor = req.body[`format_${t.id}`];
            t.nomorTerakhir = parseInt(req.body[`nomor_${t.id}`]) || 0;
        }
        return t;
    });

    writeDB(db);
    res.redirect('/pengaturan?success=1');
});


// HALAMAN 2: Kelola Template (Upload & Hapus)
app.get('/templates', (req, res) => {
    const db = readDB();
    let tableRows = db.templates.length === 0 
        ? `<tr><td colspan="4" class="px-6 py-8 text-center text-slate-500">Belum ada template. Silakan upload template (.docx) pertama Anda.</td></tr>` 
        : db.templates.map((t, index) => `
        <tr class="border-b hover:bg-slate-50">
            <td class="px-6 py-4 text-sm text-slate-600">${index + 1}</td>
            <td class="px-6 py-4"><div class="font-medium text-slate-800">${t.namaTemplate}</div><div class="text-xs text-slate-500 mt-1"><i data-feather="file" class="w-3 h-3 inline"></i> ${t.originalFile}</div></td>
            <td class="px-6 py-4 text-sm text-slate-500">${t.tanggalUpload}</td>
            <td class="px-6 py-4 flex gap-2">
                <a href="/buat-surat/${t.id}" class="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm font-semibold shadow-sm"><i data-feather="edit-3" class="w-4 h-4"></i> Buat Surat</a>
                <a href="/templates/hapus/${t.id}" onclick="return confirm('Yakin ingin menghapus template ini?')" class="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 transition text-sm font-medium border border-red-200"><i data-feather="trash-2" class="w-4 h-4"></i> Hapus</a>
            </td>
        </tr>
    `).join('');

    const content = `
        <h2 class="text-2xl font-bold text-slate-800 mb-6">Kelola Template Surat</h2>
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
            <h3 class="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2"><i data-feather="upload" class="text-blue-500"></i> Upload Template (.docx)</h3>
            <form action="/templates/upload" method="POST" enctype="multipart/form-data" class="flex flex-col md:flex-row gap-4 items-end">
                <div class="flex-1 w-full"><label class="block text-sm font-medium text-slate-700 mb-1">Jenis Surat (Nama Form)</label><input type="text" name="namaTemplate" required placeholder="Contoh: SKU / SKTM" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"></div>
                <div class="flex-1 w-full"><label class="block text-sm font-medium text-slate-700 mb-1">Pilih File (.docx)</label><input type="file" name="fileTemplate" accept=".docx" required class="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 cursor-pointer text-sm"></div>
                <button type="submit" class="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2.5 rounded-lg font-semibold shadow transition h-[42px] flex items-center justify-center gap-2 w-full md:w-auto"><i data-feather="save" class="w-4 h-4"></i> Simpan</button>
            </form>
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full text-left whitespace-nowrap"><thead class="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-xs font-bold"><tr><th class="px-6 py-4 w-16">No</th><th class="px-6 py-4">Nama Template & File</th><th class="px-6 py-4">Tanggal Upload</th><th class="px-6 py-4 w-64">Aksi</th></tr></thead><tbody>${tableRows}</tbody></table>
            </div>
        </div>
    `;
    res.send(layoutHTML('Kelola Template', content, 'templates'));
});

app.post('/templates/upload', upload.single('fileTemplate'), (req, res) => {
    if (!req.file) return res.send("Gagal mengupload file.");
    const db = readDB();
    db.templates.push({ 
        id: Date.now().toString(), 
        namaTemplate: req.body.namaTemplate, 
        originalFile: req.file.originalname, 
        savedFile: req.file.filename, 
        tanggalUpload: new Date().toLocaleString('id-ID'),
        formatNomor: "145/[NOMOR]/DS/[BULAN]/[TAHUN]", // Nilai default saat upload baru
        nomorTerakhir: 0
    });
    writeDB(db);
    res.redirect('/templates');
});

app.get('/templates/hapus/:id', (req, res) => {
    const db = readDB();
    const index = db.templates.findIndex(t => t.id === req.params.id);
    if (index > -1) {
        const filePath = path.join(DIR_TEMPLATES, db.templates[index].savedFile);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        db.templates.splice(index, 1);
        writeDB(db);
    }
    res.redirect('/templates');
});


// ==========================================
// 4. FITUR CERDAS: AUTO-GENERATE FORM & AUTO NUMBER
// ==========================================

function extractTagsFromDocx(filePath) {
    try {
        const docXml = new PizZip(fs.readFileSync(filePath, 'binary')).file("word/document.xml").asText();
        const plainText = docXml.replace(/<[^>]+>/g, ""); 
        const tags = new Set();
        
        const regex = /\{([a-zA-Z0-9_]+)\}/g;
        let match;
        while ((match = regex.exec(plainText)) !== null) {
            tags.add(match[1]);
        }
        return Array.from(tags);
    } catch (error) { return []; }
}

app.get('/buat-surat/:templateId', (req, res) => {
    const db = readDB();
    const template = db.templates.find(t => t.id === req.params.templateId);
    if (!template) return res.send("Template tidak ditemukan.");

    const tags = extractTagsFromDocx(path.join(DIR_TEMPLATES, template.savedFile)); 
    if (tags.length === 0) return res.send("Error: Tidak ada variabel {TAG} yang ditemukan. Pastikan Anda tidak menggunakan spasi pada nama tag seperti { NAMA }.");

    // FITUR: Generate Nomor Surat Otomatis BERDASARKAN TEMPLATE SPESIFIK
    let nextNum = (template.nomorTerakhir !== undefined ? template.nomorTerakhir : 0) + 1;
    let formatTpl = template.formatNomor || "145/[NOMOR]/DS/[BULAN]/[TAHUN]";
    let bulanRomawi = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][new Date().getMonth()];
    let tahun = new Date().getFullYear();
    
    let autoNomor = formatTpl
        .replace('[NOMOR]', String(nextNum).padStart(3, '0'))
        .replace('[BULAN]', bulanRomawi)
        .replace('[TAHUN]', tahun);

    let formInputs = tags.map(tag => {
        let component = '';
        let lowerTag = tag.toLowerCase();
        const selectClass = "w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition appearance-none cursor-pointer";

        if (lowerTag.includes('nomor') && !lowerTag.includes('nik')) {
            // Pre-fill Nomor Surat Otomatis
            component = `<input type="text" name="${tag}" value="${autoNomor}" required class="w-full px-4 py-2.5 bg-blue-50 border border-blue-200 text-blue-800 font-semibold rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition">
                         <p class="text-xs text-blue-500 mt-1">Nomor otomatis untuk <b>${template.namaTemplate}</b>.</p>`;
        } else if (lowerTag.includes('kelamin')) {
            component = `<div class="relative"><select name="${tag}" required class="${selectClass}"><option value="">-- Pilih Jenis Kelamin --</option><option value="Laki-laki">Laki-laki</option><option value="Perempuan">Perempuan</option></select><i data-feather="chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none"></i></div>`;
        } else if (lowerTag.includes('agama')) {
            component = `<div class="relative"><select name="${tag}" required class="${selectClass}"><option value="">-- Pilih Agama --</option><option value="Islam">Islam</option><option value="Kristen Protestan">Kristen Protestan</option><option value="Katolik">Katolik</option><option value="Hindu">Hindu</option><option value="Buddha">Buddha</option><option value="Konghucu">Konghucu</option></select><i data-feather="chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none"></i></div>`;
        } else if (lowerTag.includes('status')) {
            component = `<div class="relative"><select name="${tag}" required class="${selectClass}"><option value="">-- Pilih Status Perkawinan --</option><option value="Belum Kawin">Belum Kawin</option><option value="Kawin">Kawin</option><option value="Cerai Hidup">Cerai Hidup</option><option value="Cerai Mati">Cerai Mati</option></select><i data-feather="chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none"></i></div>`;
        } else if (lowerTag.includes('alamat') || lowerTag.includes('usaha') || lowerTag.includes('keterangan')) {
            component = `<textarea name="${tag}" rows="3" required placeholder="Ketik rincian di sini..." class="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition resize-y"></textarea>`;
        } else if (lowerTag.includes('tanggal') || lowerTag.includes('tgl')) {
            component = `<input type="text" name="${tag}" required placeholder="Misal: 17 Agustus 1945" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition">`;
        } else {
            component = `<input type="text" name="${tag}" required placeholder="Isi ${tag.replace(/_/g, ' ')}..." class="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition">`;
        }

        return `
            <div class="mb-5">
                <label class="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">${tag.replace(/_/g, ' ')}</label>
                ${component}
            </div>
        `;
    }).join('');

    const submitScript = `<script>document.getElementById('formSurat').addEventListener('submit', function() { const btn = document.getElementById('btnSubmit'); btn.classList.add('opacity-75', 'cursor-not-allowed'); btn.innerHTML = '<i data-feather="loader" class="w-5 h-5 animate-spin"></i> Sedang Memproses Dokumen...'; feather.replace(); });</script>`;

    const content = `
        <div class="mb-6 flex items-center gap-4">
            <a href="/templates" class="text-slate-500 hover:text-blue-600 transition bg-slate-200 p-2 rounded-full"><i data-feather="arrow-left" class="w-5 h-5"></i></a>
            <div>
                <h2 class="text-2xl font-bold text-slate-800">Pembuatan Surat</h2>
                <p class="text-slate-500 mt-1 text-sm">Jenis Surat: <strong>${template.namaTemplate}</strong></p>
            </div>
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 max-w-4xl mx-auto">
            <form id="formSurat" action="/generate-surat" method="POST">
                <input type="hidden" name="templateId" value="${template.id}">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8">${formInputs}</div>
                <div class="mt-8 pt-6 border-t border-slate-100 flex gap-4">
                    <button id="btnSubmit" type="submit" class="w-full md:w-auto md:ml-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-8 rounded-xl shadow-lg shadow-blue-600/30 transition flex justify-center items-center gap-2">
                        <i data-feather="printer" class="w-5 h-5"></i> Proses & Buat Surat
                    </button>
                </div>
            </form>
        </div>
    `;
    res.send(layoutHTML('Buat Surat', content, 'templates', submitScript));
});

// PROSES: Generate Word (Dukungan QR Code Asynchronous)
app.post('/generate-surat', async (req, res) => {
    try {
        const db = readDB();
        const template = db.templates.find(t => t.id === req.body.templateId);
        if (!template) return res.status(404).send("Template tidak ditemukan.");

        const suratId = Date.now().toString(); // ID Unik Surat
        let docOptions = { paragraphLoop: true, linebreaks: true };

        // FITUR: TANDA TANGAN ELEKTRONIK (QR CODE)
        if (db.settings.gunakanQR) {
            try {
                const ImageModule = require('docxtemplater-image-module-free');
                const qrPath = path.join(DIR_QR, `${suratId}.png`);
                
                const verifyUrl = `http://localhost:${PORT}/verifikasi/${suratId}`;
                await QRCode.toFile(qrPath, verifyUrl, { width: 150 });

                const imageOpts = {
                    centered: false,
                    getImage: (tagValue) => fs.readFileSync(tagValue),
                    getSize: () => [100, 100]
                };
                docOptions.modules = [new ImageModule(imageOpts)];
                
                req.body.QR_CODE = qrPath;
            } catch (err) {
                console.error("Gagal memproses QR Code. Pastikan docxtemplater-image-module-free terinstall.", err);
            }
        }

        const doc = new Docxtemplater(new PizZip(fs.readFileSync(path.join(DIR_TEMPLATES, template.savedFile), 'binary')), docOptions);
        doc.render(req.body);

        const buffer = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });

        let namaPemohon = req.body['NAMA'] || req.body['NAMA_LENGKAP'] || req.body['PEMOHON'] || 'Warga';
        let outputFileName = `Surat_${namaPemohon.replace(/[^a-zA-Z0-9]/g, '_')}_${suratId.slice(-5)}.docx`;
        
        fs.writeFileSync(path.join(DIR_DOWNLOADS, outputFileName), buffer);

        let nomorSuratInput = Object.keys(req.body).find(k => k.toLowerCase().includes('nomor') && !k.toLowerCase().includes('nik'));

        db.surat.push({
            id: suratId,
            templateId: template.id,
            jenisSurat: template.namaTemplate,
            namaPemohon: namaPemohon,
            nomorSurat: nomorSuratInput ? req.body[nomorSuratInput] : '-',
            tanggalDibuat: new Date().toLocaleString('id-ID'),
            filename: outputFileName
        });

        // TINGKATKAN NOMOR TERAKHIR UNTUK TEMPLATE YANG BERSANGKUTAN SAJA
        const tIndex = db.templates.findIndex(t => t.id === template.id);
        if (tIndex > -1) {
            db.templates[tIndex].nomorTerakhir = (db.templates[tIndex].nomorTerakhir !== undefined ? db.templates[tIndex].nomorTerakhir : 0) + 1;
        }
        
        writeDB(db);

        res.redirect('/?success=1');
    } catch (error) {
        res.status(500).send("Error: " + error.message);
    }
});

// FITUR: Konversi PDF
app.get('/preview-pdf/:filename', async (req, res) => {
    try {
        const docxPath = path.join(DIR_DOWNLOADS, req.params.filename);
        if (!fs.existsSync(docxPath)) return res.status(404).send("Error: File dokumen tidak ditemukan.");

        const fileBuffer = fs.readFileSync(docxPath);
        const pdfBuffer = await libre.convertAsync(fileBuffer, '.pdf', undefined);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${req.params.filename.replace('.docx', '.pdf')}"`);
        res.send(pdfBuffer);
    } catch (error) {
        res.status(500).send(`<h3>Gagal membuat PDF! Pastikan LibreOffice terinstall.</h3><p>${error.message}</p>`);
    }
});

// HALAMAN PUBLIK: Verifikasi Surat via QR Code
app.get('/verifikasi/:id', (req, res) => {
    const db = readDB();
    const surat = db.surat.find(s => s.id === req.params.id);

    if (!surat) {
        return res.send(`
            <div style="font-family:sans-serif; text-align:center; padding: 50px; color: red;">
                <h1 style="font-size: 50px; margin:0;">❌</h1>
                <h2>Surat Tidak Ditemukan / Palsu</h2>
                <p>Dokumen ini tidak terdaftar di database Pemerintah Desa.</p>
            </div>
        `);
    }

    res.send(`
        <div style="font-family:sans-serif; text-align:center; padding: 50px; color: #166534; background: #f0fdf4; min-height: 100vh;">
            <h1 style="font-size: 50px; margin:0;">✅</h1>
            <h2>Dokumen Resmi & Terverifikasi</h2>
            <div style="background: white; border: 1px solid #bbf7d0; padding: 20px; border-radius: 10px; max-width: 400px; margin: 20px auto; text-align: left; color: #374151;">
                <p><strong>Jenis Surat:</strong> ${surat.jenisSurat}</p>
                <p><strong>Nomor Surat:</strong> ${surat.nomorSurat}</p>
                <p><strong>Nama Pemohon:</strong> ${surat.namaPemohon}</p>
                <p><strong>Dikeluarkan Pada:</strong> ${surat.tanggalDibuat}</p>
            </div>
            <p style="color: #6b7280; font-size: 14px;">Surat ini sah dikeluarkan oleh Sistem Informasi Desa.</p>
        </div>
    `);
});

app.listen(PORT, () => console.log(`✅ Server SI-DESA V5.2 berjalan di http://localhost:${PORT}`));
