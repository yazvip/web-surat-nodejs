const express = require('express');
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const multer = require('multer');
const libre = require('libreoffice-convert');
const QRCode = require('qrcode');
libre.convertAsync = require('util').promisify(libre.convert);

const app = express();
const PORT = process.env.PORT || 3001;

// ==========================================
// 1. PENGATURAN DIREKTORI & DATABASE JSON
// ==========================================
const DB_FILE = path.join(__dirname, 'database.json');
const DIR_TEMPLATES = path.join(__dirname, 'uploads', 'templates');
const DIR_DOWNLOADS = path.join(__dirname, 'public', 'downloads');
const DIR_QR = path.join(__dirname, 'uploads', 'qr');

if (!fs.existsSync(DIR_TEMPLATES)) fs.mkdirSync(DIR_TEMPLATES, { recursive: true });
if (!fs.existsSync(DIR_DOWNLOADS)) fs.mkdirSync(DIR_DOWNLOADS, { recursive: true });
if (!fs.existsSync(DIR_QR)) fs.mkdirSync(DIR_QR, { recursive: true });

if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({
        templates: [],
        surat: [],
        settings: {
            gunakanQR: false,
            namaInstansi: 'Pemerintah Desa',
            alamatInstansi: 'Jl. Raya Desa No. 1',
            kodePos: '12345',
            telepon: '(021) 12345678',
            website: 'www.desa.go.id'
        }
    }, null, 4));
} else {
    let db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    if (!db.settings) db.settings = { gunakanQR: false };
    if (!db.settings.namaInstansi) db.settings.namaInstansi = 'Pemerintah Desa';
    if (!db.settings.alamatInstansi) db.settings.alamatInstansi = 'Jl. Raya Desa No. 1';
    if (!db.settings.kodePos) db.settings.kodePos = '12345';
    if (!db.settings.telepon) db.settings.telepon = '(021) 12345678';
    if (!db.settings.website) db.settings.website = 'www.desa.go.id';
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 4));
}

const readDB = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 4));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, DIR_TEMPLATES),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

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
app.use(express.json());
app.use('/downloads', express.static(DIR_DOWNLOADS));

// ==========================================
// 2. LAYOUT HTML SUPER CANGGIH v6.0
// ==========================================

const layoutHTML = (title, content, activeMenu, extraScript = '', breadcrumb = '') => `
<!DOCTYPE html>
<html lang="id" class="scroll-smooth">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
    <title>${title} — SIDesa Pro</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <script src="https://unpkg.com/feather-icons"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    fontFamily: { sans: ['Plus Jakarta Sans', 'sans-serif'] },
                    animation: {
                        'fade-in': 'fadeIn 0.3s ease-out',
                        'slide-up': 'slideUp 0.4s ease-out',
                        'slide-in-right': 'slideInRight 0.3s ease-out',
                    },
                    keyframes: {
                        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
                        slideUp: { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
                        slideInRight: { '0%': { opacity: '0', transform: 'translateX(20px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
                    }
                }
            }
        }
    </script>
    <style>
        * { box-sizing: border-box; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .dark ::-webkit-scrollbar-thumb { background: #475569; }
        .sidebar-gradient { background: linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #0f172a 100%); }
        .glass { backdrop-filter: blur(16px) saturate(180%); background: rgba(255,255,255,0.85); border: 1px solid rgba(255,255,255,0.3); }
        .dark .glass { background: rgba(15,23,42,0.85); border: 1px solid rgba(255,255,255,0.1); }
        .card-hover { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .card-hover:hover { transform: translateY(-4px); box-shadow: 0 20px 40px rgba(0,0,0,0.12); }
        .gradient-text { background: linear-gradient(135deg, #3b82f6, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .nav-active { background: linear-gradient(135deg, #3b82f6, #6366f1); box-shadow: 0 4px 15px rgba(59,130,246,0.4); }
        .stat-blue { background: linear-gradient(135deg, #3b82f6, #1d4ed8); }
        .stat-green { background: linear-gradient(135deg, #22c55e, #15803d); }
        .stat-purple { background: linear-gradient(135deg, #a855f7, #7c3aed); }
        .stat-orange { background: linear-gradient(135deg, #f97316, #c2410c); }
        .input-field { transition: all 0.2s; }
        .input-field:focus { box-shadow: 0 0 0 3px rgba(59,130,246,0.2); }
        .table-row { transition: all 0.15s; }
        .table-row:hover { background: linear-gradient(90deg, rgba(59,130,246,0.05), transparent); }
        .bottom-nav { box-shadow: 0 -4px 20px rgba(0,0,0,0.1); }
        .sidebar-item { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
        .sidebar-item:hover { background: rgba(255,255,255,0.1); transform: translateX(4px); }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner { animation: spin 1s linear infinite; }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .skeleton { background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
        .dark .skeleton { background: linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
        .modal-backdrop { backdrop-filter: blur(8px); }
        .status-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; }
        #sidebarOverlay { display: none; }
        #sidebarOverlay.active { display: block; }
        #sidebar { transform: translateX(-100%); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        #sidebar.open { transform: translateX(0); }
        @media (min-width: 1024px) {
            #sidebar { transform: translateX(0); position: relative; }
            #sidebarOverlay { display: none !important; }
        }
        .fab { box-shadow: 0 8px 25px rgba(59,130,246,0.5); transition: all 0.3s; }
        .fab:hover { transform: scale(1.1) rotate(90deg); box-shadow: 0 12px 35px rgba(59,130,246,0.6); }
        body, .bg-white, .bg-slate-50, .bg-slate-100 { transition: background-color 0.3s, color 0.3s; }
    </style>
</head>
<body class="bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 min-h-screen flex">

    <!-- Sidebar Overlay (Mobile) -->
    <div id="sidebarOverlay" class="fixed inset-0 bg-black/60 modal-backdrop z-40 lg:hidden" onclick="closeSidebar()"></div>

    <!-- SIDEBAR -->
    <aside id="sidebar" class="fixed lg:relative z-50 w-72 h-screen sidebar-gradient text-white flex flex-col shrink-0 overflow-hidden">
        <div class="px-6 py-5 border-b border-white/10 shrink-0">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                </div>
                <div>
                    <h1 class="text-base font-bold text-white leading-tight">SIDesa Pro</h1>
                    <p class="text-xs text-slate-400 leading-tight">Sistem Informasi Desa</p>
                </div>
                <button onclick="closeSidebar()" class="ml-auto lg:hidden text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition">
                    <i data-feather="x" class="w-5 h-5"></i>
                </button>
            </div>
        </div>
        <nav class="flex-1 px-4 py-5 space-y-1 overflow-y-auto">
            <p class="text-xs font-bold text-slate-500 uppercase tracking-widest px-3 mb-3">Menu Utama</p>
            <a href="/" class="sidebar-item flex items-center gap-3 px-4 py-3 rounded-xl ${activeMenu === 'dashboard' ? 'nav-active text-white' : 'text-slate-400 hover:text-white'}">
                <div class="w-8 h-8 rounded-lg ${activeMenu === 'dashboard' ? 'bg-white/20' : 'bg-white/5'} flex items-center justify-center">
                    <i data-feather="grid" class="w-4 h-4"></i>
                </div>
                <span class="font-semibold text-sm">Dashboard</span>
                ${activeMenu === 'dashboard' ? '<div class="ml-auto w-1.5 h-1.5 rounded-full bg-white"></div>' : ''}
            </a>
            <a href="/arsip" class="sidebar-item flex items-center gap-3 px-4 py-3 rounded-xl ${activeMenu === 'arsip' ? 'nav-active text-white' : 'text-slate-400 hover:text-white'}">
                <div class="w-8 h-8 rounded-lg ${activeMenu === 'arsip' ? 'bg-white/20' : 'bg-white/5'} flex items-center justify-center">
                    <i data-feather="archive" class="w-4 h-4"></i>
                </div>
                <span class="font-semibold text-sm">Arsip Surat</span>
                ${activeMenu === 'arsip' ? '<div class="ml-auto w-1.5 h-1.5 rounded-full bg-white"></div>' : ''}
            </a>
            <a href="/templates" class="sidebar-item flex items-center gap-3 px-4 py-3 rounded-xl ${activeMenu === 'templates' ? 'nav-active text-white' : 'text-slate-400 hover:text-white'}">
                <div class="w-8 h-8 rounded-lg ${activeMenu === 'templates' ? 'bg-white/20' : 'bg-white/5'} flex items-center justify-center">
                    <i data-feather="file-text" class="w-4 h-4"></i>
                </div>
                <span class="font-semibold text-sm">Kelola Template</span>
                ${activeMenu === 'templates' ? '<div class="ml-auto w-1.5 h-1.5 rounded-full bg-white"></div>' : ''}
            </a>
            <p class="text-xs font-bold text-slate-500 uppercase tracking-widest px-3 mb-3 mt-6">Sistem</p>
            <a href="/pengaturan" class="sidebar-item flex items-center gap-3 px-4 py-3 rounded-xl ${activeMenu === 'pengaturan' ? 'nav-active text-white' : 'text-slate-400 hover:text-white'}">
                <div class="w-8 h-8 rounded-lg ${activeMenu === 'pengaturan' ? 'bg-white/20' : 'bg-white/5'} flex items-center justify-center">
                    <i data-feather="settings" class="w-4 h-4"></i>
                </div>
                <span class="font-semibold text-sm">Pengaturan</span>
                ${activeMenu === 'pengaturan' ? '<div class="ml-auto w-1.5 h-1.5 rounded-full bg-white"></div>' : ''}
            </a>
        </nav>
        <div class="px-4 py-4 border-t border-white/10 shrink-0">
            <div class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5">
                <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-xs font-bold text-white">A</div>
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold text-white truncate">Admin Desa</p>
                    <p class="text-xs text-slate-500 truncate">v6.0 Pro</p>
                </div>
                <button onclick="toggleDarkMode()" class="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition">
                    <i data-feather="moon" class="w-4 h-4" id="darkModeIcon"></i>
                </button>
            </div>
        </div>
    </aside>

    <!-- MAIN CONTENT -->
    <main class="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header class="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 lg:px-8 h-16 flex items-center gap-4 shrink-0 sticky top-0 z-30 shadow-sm">
            <button onclick="openSidebar()" class="lg:hidden p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition text-slate-600 dark:text-slate-300">
                <i data-feather="menu" class="w-5 h-5"></i>
            </button>
            <div class="hidden sm:flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <a href="/" class="hover:text-blue-600 transition font-medium">SIDesa</a>
                ${breadcrumb ? `<i data-feather="chevron-right" class="w-3 h-3"></i><span class="text-slate-800 dark:text-slate-200 font-semibold">${breadcrumb}</span>` : ''}
            </div>
            <h1 class="sm:hidden font-bold text-slate-800 dark:text-slate-100 text-base">${title}</h1>
            <div class="ml-auto flex items-center gap-2">
                <button onclick="toggleGlobalSearch()" class="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition text-slate-500 dark:text-slate-400 hidden sm:flex">
                    <i data-feather="search" class="w-5 h-5"></i>
                </button>
                <button onclick="toggleDarkMode()" class="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition text-slate-500 dark:text-slate-400 hidden lg:flex">
                    <i data-feather="moon" class="w-5 h-5" id="darkModeIconHeader"></i>
                </button>
                <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold cursor-pointer shadow-md">A</div>
            </div>
        </header>

        <!-- Global Search Modal -->
        <div id="globalSearchModal" class="hidden fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 modal-backdrop bg-black/50">
            <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up">
                <div class="flex items-center gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-700">
                    <i data-feather="search" class="w-5 h-5 text-slate-400"></i>
                    <input type="text" id="globalSearchInput" placeholder="Cari surat, template, pemohon..." 
                        class="flex-1 bg-transparent outline-none text-slate-800 dark:text-slate-200 placeholder-slate-400 text-sm font-medium"
                        oninput="performGlobalSearch(this.value)">
                    <button onclick="toggleGlobalSearch()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                        <i data-feather="x" class="w-4 h-4"></i>
                    </button>
                </div>
                <div id="globalSearchResults" class="max-h-80 overflow-y-auto p-3">
                    <p class="text-center text-slate-400 text-sm py-8">Ketik untuk mencari... (Ctrl+K)</p>
                </div>
            </div>
        </div>

        <div class="flex-1 overflow-y-auto p-4 lg:p-8 pb-24 lg:pb-8 animate-fade-in">
            ${content}
        </div>
    </main>

    <!-- MOBILE BOTTOM NAVIGATION -->
    <nav class="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 bottom-nav z-30 lg:hidden">
        <div class="flex items-center justify-around px-2 py-2">
            <a href="/" class="flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition ${activeMenu === 'dashboard' ? 'text-blue-600' : 'text-slate-500 dark:text-slate-400'}">
                <i data-feather="grid" class="w-5 h-5"></i>
                <span class="text-xs font-semibold">Dashboard</span>
            </a>
            <a href="/arsip" class="flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition ${activeMenu === 'arsip' ? 'text-blue-600' : 'text-slate-500 dark:text-slate-400'}">
                <i data-feather="archive" class="w-5 h-5"></i>
                <span class="text-xs font-semibold">Arsip</span>
            </a>
            <a href="/templates" class="flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition ${activeMenu === 'templates' ? 'text-blue-600' : 'text-slate-500 dark:text-slate-400'}">
                <i data-feather="file-text" class="w-5 h-5"></i>
                <span class="text-xs font-semibold">Template</span>
            </a>
            <a href="/pengaturan" class="flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition ${activeMenu === 'pengaturan' ? 'text-blue-600' : 'text-slate-500 dark:text-slate-400'}">
                <i data-feather="settings" class="w-5 h-5"></i>
                <span class="text-xs font-semibold">Seting</span>
            </a>
        </div>
    </nav>

    <script>
        feather.replace();
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
            updateDarkModeIcon(true);
        }
        function toggleDarkMode() {
            const isDark = document.documentElement.classList.toggle('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            updateDarkModeIcon(isDark);
        }
        function updateDarkModeIcon(isDark) {
            document.querySelectorAll('#darkModeIcon, #darkModeIconHeader').forEach(icon => {
                if (icon) icon.setAttribute('data-feather', isDark ? 'sun' : 'moon');
            });
            feather.replace();
        }
        function openSidebar() {
            document.getElementById('sidebar').classList.add('open');
            document.getElementById('sidebarOverlay').classList.add('active');
            document.body.style.overflow = 'hidden';
        }
        function closeSidebar() {
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('sidebarOverlay').classList.remove('active');
            document.body.style.overflow = '';
        }
        function toggleGlobalSearch() {
            const modal = document.getElementById('globalSearchModal');
            modal.classList.toggle('hidden');
            if (!modal.classList.contains('hidden')) {
                setTimeout(() => document.getElementById('globalSearchInput').focus(), 100);
            }
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { document.getElementById('globalSearchModal').classList.add('hidden'); closeSidebar(); }
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); toggleGlobalSearch(); }
        });
        async function performGlobalSearch(query) {
            const resultsEl = document.getElementById('globalSearchResults');
            if (!query.trim()) { resultsEl.innerHTML = '<p class="text-center text-slate-400 text-sm py-8">Ketik untuk mencari... (Ctrl+K)</p>'; return; }
            try {
                const res = await fetch('/api/search?q=' + encodeURIComponent(query));
                const data = await res.json();
                if (data.results.length === 0) { resultsEl.innerHTML = '<p class="text-center text-slate-400 text-sm py-8">Tidak ada hasil ditemukan.</p>'; return; }
                resultsEl.innerHTML = data.results.map(r => \`
                    <a href="\${r.url}" class="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition group" onclick="toggleGlobalSearch()">
                        <div class="w-9 h-9 rounded-lg \${r.type === 'surat' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'} flex items-center justify-center shrink-0">
                            <i data-feather="\${r.type === 'surat' ? 'file-text' : 'layers'}" class="w-4 h-4"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">\${r.title}</p>
                            <p class="text-xs text-slate-500 truncate">\${r.subtitle}</p>
                        </div>
                        <i data-feather="arrow-right" class="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition shrink-0"></i>
                    </a>
                \`).join('');
                feather.replace();
            } catch(e) {}
        }
        function showToast(message, type = 'success') {
            Swal.fire({ toast: true, position: 'top-end', icon: type, title: message, showConfirmButton: false, timer: 3500, timerProgressBar: true, customClass: { popup: 'rounded-2xl shadow-2xl text-sm font-semibold' } });
        }
        function toggleModal(id) {
            document.getElementById(id).classList.toggle('hidden');
        }
        function updateFileName(input) {
            const el = document.getElementById('selectedFileName');
            if (input.files[0] && el) { el.textContent = '✓ ' + input.files[0].name; el.classList.remove('hidden'); }
        }
    </script>
    ${extraScript}
</body>
</html>
`;

// ==========================================
// 3. API ENDPOINTS
// ==========================================

app.get('/api/search', (req, res) => {
    const q = (req.query.q || '').toLowerCase();
    const db = readDB();
    const results = [];
    db.surat.forEach(s => {
        if (s.jenisSurat?.toLowerCase().includes(q) || s.namaPemohon?.toLowerCase().includes(q) || s.nomorSurat?.toLowerCase().includes(q)) {
            results.push({ type: 'surat', title: s.jenisSurat, subtitle: `${s.namaPemohon} • ${s.tanggalDibuat}`, url: `/arsip?search=${encodeURIComponent(s.namaPemohon)}` });
        }
    });
    db.templates.forEach(t => {
        if (t.namaTemplate?.toLowerCase().includes(q)) {
            results.push({ type: 'template', title: t.namaTemplate, subtitle: `Template • ${t.tanggalUpload}`, url: `/buat-surat/${t.id}` });
        }
    });
    res.json({ results: results.slice(0, 8) });
});

app.delete('/api/surat/:id', (req, res) => {
    const db = readDB();
    const index = db.surat.findIndex(s => s.id === req.params.id);
    if (index === -1) return res.json({ success: false, message: 'Surat tidak ditemukan' });
    const surat = db.surat[index];
    const filePath = path.join(DIR_DOWNLOADS, surat.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    db.surat.splice(index, 1);
    writeDB(db);
    res.json({ success: true });
});

app.get('/api/arsip', (req, res) => {
    const db = readDB();
    res.json({ surat: [...db.surat].reverse() });
});

app.get('/api/stats', (req, res) => {
    const db = readDB();
    const now = new Date();
    const monthlyStats = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const month = d.getMonth() + 1;
        const year = d.getFullYear();
        const count = db.surat.filter(s => {
            if (!s.tanggalDibuat) return false;
            const parts = s.tanggalDibuat.split('/');
            return parseInt(parts[1]) === month && parseInt(parts[2]?.substring(0,4)) === year;
        }).length;
        monthlyStats.push({ month: d.toLocaleString('id-ID', { month: 'short' }), count });
    }
    const byType = {};
    db.surat.forEach(s => { byType[s.jenisSurat] = (byType[s.jenisSurat] || 0) + 1; });
    res.json({ monthlyStats, byType });
});

// ==========================================
// 4. HALAMAN DASHBOARD
// ==========================================
app.get('/', (req, res) => {
    const db = readDB();
    const suratList = [...db.surat].reverse();
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const suratBulanIni = suratList.filter(s => {
        if (!s.tanggalDibuat) return false;
        const parts = s.tanggalDibuat.split('/');
        return parseInt(parts[1]) === currentMonth && parseInt(parts[2]?.substring(0,4)) === currentYear;
    }).length;
    const suratManual = suratList.filter(s => s.templateId === 'manual').length;
    const recentSurat = suratList.slice(0, 5);

    const recentRows = recentSurat.length === 0
        ? `<div class="text-center py-12 text-slate-400 dark:text-slate-500">
            <div class="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4"><i data-feather="inbox" class="w-8 h-8"></i></div>
            <p class="font-semibold">Belum ada surat</p><p class="text-sm mt-1">Buat surat pertama Anda sekarang</p>
           </div>`
        : recentSurat.map(s => `
        <div class="table-row flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition cursor-pointer group">
            <div class="w-10 h-10 rounded-xl ${s.templateId === 'manual' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'} flex items-center justify-center shrink-0">
                <i data-feather="${s.templateId === 'manual' ? 'upload' : 'file-text'}" class="w-5 h-5"></i>
            </div>
            <div class="flex-1 min-w-0">
                <p class="font-semibold text-slate-800 dark:text-slate-200 text-sm truncate">${s.jenisSurat}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400 truncate">${s.namaPemohon} • ${s.nomorSurat || '-'}</p>
            </div>
            <div class="text-right shrink-0">
                <p class="text-xs text-slate-400 dark:text-slate-500">${s.tanggalDibuat?.split(',')[0] || '-'}</p>
                <div class="flex gap-1 mt-1 justify-end opacity-0 group-hover:opacity-100 transition">
                    <a href="/preview-pdf/${s.filename}" target="_blank" class="p-1 rounded-lg bg-rose-100 dark:bg-rose-900/30 text-rose-600 hover:bg-rose-200 transition"><i data-feather="printer" class="w-3.5 h-3.5"></i></a>
                    <a href="/downloads/${s.filename}" class="p-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 hover:bg-indigo-200 transition"><i data-feather="download" class="w-3.5 h-3.5"></i></a>
                </div>
            </div>
        </div>`).join('');

    const templateQuickLinks = db.templates.slice(0, 4).map(t => `
        <a href="/buat-surat/${t.id}" class="card-hover flex items-center gap-3 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 group">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-blue-500/20"><i data-feather="edit-3" class="w-5 h-5"></i></div>
            <div class="flex-1 min-w-0">
                <p class="font-bold text-slate-800 dark:text-slate-200 text-sm truncate">${t.namaTemplate}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">Klik untuk buat surat</p>
            </div>
            <i data-feather="arrow-right" class="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition shrink-0"></i>
        </a>`).join('') || `<div class="col-span-2 text-center py-8 text-slate-400 dark:text-slate-500 text-sm"><p>Belum ada template. <a href="/templates" class="text-blue-600 font-semibold hover:underline">Upload sekarang →</a></p></div>`;

    const extraScript = `<script>
        ${req.query.success ? `showToast('Surat berhasil dibuat & disimpan!', 'success'); window.history.replaceState(null, null, '/');` : ''}
        ${req.query.success_upload ? `showToast('Arsip manual berhasil diupload!', 'success'); window.history.replaceState(null, null, '/');` : ''}
        async function loadChart() {
            try {
                const res = await fetch('/api/stats');
                const data = await res.json();
                const ctx = document.getElementById('suratChart');
                if (!ctx) return;
                const isDark = document.documentElement.classList.contains('dark');
                const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
                const textColor = isDark ? '#94a3b8' : '#64748b';
                new Chart(ctx, { type: 'bar', data: { labels: data.monthlyStats.map(m => m.month), datasets: [{ label: 'Surat Terbit', data: data.monthlyStats.map(m => m.count), backgroundColor: 'rgba(59,130,246,0.8)', borderRadius: 8, borderSkipped: false }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: isDark ? '#1e293b' : '#0f172a', titleColor: '#f8fafc', bodyColor: '#94a3b8', padding: 12, cornerRadius: 12 } }, scales: { x: { grid: { display: false }, ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 12 } } }, y: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 12 }, stepSize: 1 }, beginAtZero: true } } } });
                const ctx2 = document.getElementById('typeChart');
                if (!ctx2 || Object.keys(data.byType).length === 0) return;
                const colors = ['#3b82f6','#8b5cf6','#22c55e','#f97316','#ef4444','#06b6d4'];
                new Chart(ctx2, { type: 'doughnut', data: { labels: Object.keys(data.byType), datasets: [{ data: Object.values(data.byType), backgroundColor: colors, borderWidth: 0, hoverOffset: 8 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 11 }, padding: 12, usePointStyle: true } }, tooltip: { backgroundColor: isDark ? '#1e293b' : '#0f172a', titleColor: '#f8fafc', bodyColor: '#94a3b8', padding: 12, cornerRadius: 12 } } } });
            } catch(e) { console.error(e); }
        }
        loadChart();
    </script>`;

    const modalUpload = `
        <div id="modalUpload" class="hidden fixed inset-0 modal-backdrop bg-black/60 z-50 flex justify-center items-center p-4">
            <div class="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
                <div class="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center"><i data-feather="upload-cloud" class="w-5 h-5"></i></div>
                        <div><h3 class="font-bold text-slate-800 dark:text-slate-200">Upload Arsip Manual</h3><p class="text-xs text-slate-500 dark:text-slate-400">Tambah dokumen ke arsip</p></div>
                    </div>
                    <button onclick="toggleModal('modalUpload')" class="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-red-500 transition"><i data-feather="x" class="w-5 h-5"></i></button>
                </div>
                <form action="/upload-arsip" method="POST" enctype="multipart/form-data" class="p-6 space-y-4">
                    <div><label class="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Jenis Surat</label><input type="text" name="jenisSurat" required placeholder="Contoh: Surat Pengantar KTP" class="input-field w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400"></div>
                    <div><label class="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Nama Pemohon</label><input type="text" name="namaPemohon" required placeholder="Contoh: Budi Santoso" class="input-field w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400"></div>
                    <div><label class="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Nomor Surat</label><input type="text" name="nomorSurat" required placeholder="Contoh: 145/001/DS/I/2026" class="input-field w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400"></div>
                    <div>
                        <label class="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">File Dokumen (.docx)</label>
                        <label class="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition group">
                            <div class="flex flex-col items-center gap-2 text-slate-400 group-hover:text-blue-500 transition"><i data-feather="upload" class="w-6 h-6"></i><span class="text-sm font-semibold">Klik untuk pilih file</span><span class="text-xs">Format: .docx</span></div>
                            <input type="file" name="fileArsip" accept=".docx" required class="hidden" onchange="updateFileName(this)">
                        </label>
                        <p id="selectedFileName" class="text-xs text-blue-600 mt-1.5 font-medium hidden"></p>
                    </div>
                    <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-600/30 transition flex justify-center items-center gap-2 mt-2"><i data-feather="save" class="w-4 h-4"></i> Simpan ke Arsip</button>
                </form>
            </div>
        </div>`;

    const content = `
        ${modalUpload}
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 animate-slide-up">
            <div><h2 class="text-2xl lg:text-3xl font-extrabold text-slate-800 dark:text-slate-100">Dashboard</h2><p class="text-slate-500 dark:text-slate-400 mt-1 text-sm">Selamat datang kembali, Admin! 👋</p></div>
            <div class="flex gap-3">
                <button onclick="toggleModal('modalUpload')" class="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:border-blue-300 dark:hover:border-blue-600 transition text-sm font-semibold shadow-sm"><i data-feather="upload" class="w-4 h-4"></i> Upload Arsip</button>
                <a href="/templates" class="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition text-sm font-bold shadow-lg shadow-blue-600/30"><i data-feather="plus" class="w-4 h-4"></i> Buat Surat</a>
            </div>
        </div>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div class="card-hover stat-blue rounded-2xl p-5 text-white shadow-lg shadow-blue-500/20 animate-slide-up">
                <div class="flex items-start justify-between mb-4"><div class="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><i data-feather="file-text" class="w-5 h-5"></i></div><span class="text-xs font-bold bg-white/20 px-2 py-1 rounded-lg">Total</span></div>
                <h3 class="text-3xl font-extrabold">${suratList.length}</h3><p class="text-blue-100 text-sm mt-1 font-medium">Surat Terbit</p>
            </div>
            <div class="card-hover stat-green rounded-2xl p-5 text-white shadow-lg shadow-green-500/20 animate-slide-up">
                <div class="flex items-start justify-between mb-4"><div class="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><i data-feather="trending-up" class="w-5 h-5"></i></div><span class="text-xs font-bold bg-white/20 px-2 py-1 rounded-lg">Bulan Ini</span></div>
                <h3 class="text-3xl font-extrabold">${suratBulanIni}</h3><p class="text-green-100 text-sm mt-1 font-medium">Surat Bulan Ini</p>
            </div>
            <div class="card-hover stat-purple rounded-2xl p-5 text-white shadow-lg shadow-purple-500/20 animate-slide-up">
                <div class="flex items-start justify-between mb-4"><div class="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><i data-feather="layers" class="w-5 h-5"></i></div><span class="text-xs font-bold bg-white/20 px-2 py-1 rounded-lg">Aktif</span></div>
                <h3 class="text-3xl font-extrabold">${db.templates.length}</h3><p class="text-purple-100 text-sm mt-1 font-medium">Template Aktif</p>
            </div>
            <div class="card-hover stat-orange rounded-2xl p-5 text-white shadow-lg shadow-orange-500/20 animate-slide-up">
                <div class="flex items-start justify-between mb-4"><div class="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><i data-feather="upload-cloud" class="w-5 h-5"></i></div><span class="text-xs font-bold bg-white/20 px-2 py-1 rounded-lg">Manual</span></div>
                <h3 class="text-3xl font-extrabold">${suratManual}</h3><p class="text-orange-100 text-sm mt-1 font-medium">Arsip Manual</p>
            </div>
        </div>
        <div class="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
            <div class="xl:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm animate-slide-up">
                <div class="flex items-center justify-between mb-6"><div><h3 class="font-bold text-slate-800 dark:text-slate-200">Statistik Surat</h3><p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">6 bulan terakhir</p></div><div class="flex items-center gap-2"><div class="w-3 h-3 rounded-full bg-blue-500"></div><span class="text-xs text-slate-500 dark:text-slate-400 font-medium">Surat Terbit</span></div></div>
                <div class="h-48"><canvas id="suratChart"></canvas></div>
            </div>
            <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm animate-slide-up">
                <div class="mb-4"><h3 class="font-bold text-slate-800 dark:text-slate-200">Jenis Surat</h3><p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Distribusi per jenis</p></div>
                <div class="h-48 ${suratList.length === 0 ? 'flex items-center justify-center' : ''}">${suratList.length === 0 ? '<p class="text-slate-400 dark:text-slate-500 text-sm text-center">Belum ada data</p>' : '<canvas id="typeChart"></canvas>'}</div>
            </div>
        </div>
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm animate-slide-up">
                <div class="flex items-center justify-between mb-5"><div><h3 class="font-bold text-slate-800 dark:text-slate-200">Buat Surat Cepat</h3><p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Pilih template untuk mulai</p></div><a href="/templates" class="text-xs text-blue-600 font-bold hover:underline">Lihat Semua →</a></div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${templateQuickLinks}</div>
            </div>
            <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm animate-slide-up">
                <div class="flex items-center justify-between mb-5"><div><h3 class="font-bold text-slate-800 dark:text-slate-200">Aktivitas Terbaru</h3><p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">5 surat terakhir dibuat</p></div><a href="/arsip" class="text-xs text-blue-600 font-bold hover:underline">Lihat Semua →</a></div>
                <div class="space-y-1">${recentRows}</div>
            </div>
        </div>`;

    res.send(layoutHTML('Dashboard', content, 'dashboard', extraScript, 'Dashboard'));
});

// ==========================================
// 5. HALAMAN ARSIP SURAT
// ==========================================
app.get('/arsip', (req, res) => {
    const extraScript = `<script>
        ${req.query.success_upload ? `showToast('Arsip manual berhasil diupload!', 'success'); window.history.replaceState(null, null, '/arsip');` : ''}
        let currentPage = 1;
        const itemsPerPage = 10;
        let filteredData = [];
        let allData = [];
        async function loadArsip() {
            try {
                const res = await fetch('/api/arsip');
                const data = await res.json();
                allData = data.surat;
                filteredData = [...allData];
                renderTable();
            } catch(e) {}
        }
        function renderTable() {
            const tbody = document.getElementById('arsipTableBody');
            const start = (currentPage - 1) * itemsPerPage;
            const end = start + itemsPerPage;
            const pageData = filteredData.slice(start, end);
            if (filteredData.length === 0) {
                tbody.innerHTML = \`<tr><td colspan="6" class="py-16 text-center"><div class="flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500"><div class="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center"><i data-feather="search" class="w-8 h-8"></i></div><p class="font-semibold">Tidak ada hasil</p><p class="text-sm">Coba kata kunci lain</p></div></td></tr>\`;
                feather.replace(); return;
            }
            tbody.innerHTML = pageData.map((s, i) => \`
                <tr class="table-row border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition group">
                    <td class="px-4 py-4 text-sm text-slate-400 dark:text-slate-500 font-medium">\${start + i + 1}</td>
                    <td class="px-4 py-4"><div class="flex items-center gap-3"><div class="w-9 h-9 rounded-xl \${s.templateId === 'manual' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'} flex items-center justify-center shrink-0"><i data-feather="\${s.templateId === 'manual' ? 'upload' : 'file-text'}" class="w-4 h-4"></i></div><div><p class="font-semibold text-slate-800 dark:text-slate-200 text-sm">\${s.jenisSurat}</p><p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">\${s.nomorSurat || '-'}</p></div></div></td>
                    <td class="px-4 py-4"><p class="font-semibold text-slate-800 dark:text-slate-200 text-sm">\${s.namaPemohon}</p></td>
                    <td class="px-4 py-4 hidden md:table-cell"><span class="status-badge \${s.templateId === 'manual' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'}">\${s.templateId === 'manual' ? '📎 Manual' : '⚡ Otomatis'}</span></td>
                    <td class="px-4 py-4 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap hidden lg:table-cell">\${s.tanggalDibuat || '-'}</td>
                    <td class="px-4 py-4"><div class="flex items-center gap-2">
                        <a href="/preview-pdf/\${s.filename}" target="_blank" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-lg hover:bg-rose-100 transition text-xs font-bold border border-rose-200 dark:border-rose-800"><i data-feather="printer" class="w-3.5 h-3.5"></i><span class="hidden sm:inline">PDF</span></a>
                        <a href="/downloads/\${s.filename}" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 transition text-xs font-bold border border-indigo-200 dark:border-indigo-800"><i data-feather="download" class="w-3.5 h-3.5"></i><span class="hidden sm:inline">Word</span></a>
                        <button onclick="deleteSurat('\${s.id}', '\${s.jenisSurat}')" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition text-xs font-bold border border-slate-200 dark:border-slate-600 hover:border-red-200"><i data-feather="trash-2" class="w-3.5 h-3.5"></i></button>
                    </div></td>
                </tr>\`).join('');
            feather.replace();
            renderPagination();
        }
        function renderPagination() {
            const totalPages = Math.ceil(filteredData.length / itemsPerPage);
            const paginationEl = document.getElementById('pagination');
            const infoEl = document.getElementById('paginationInfo');
            const start = filteredData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
            const end = Math.min(currentPage * itemsPerPage, filteredData.length);
            infoEl.textContent = \`Menampilkan \${start}–\${end} dari \${filteredData.length} surat\`;
            if (totalPages <= 1) { paginationEl.innerHTML = ''; return; }
            let pages = '';
            for (let i = 1; i <= totalPages; i++) {
                if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                    pages += \`<button onclick="goToPage(\${i})" class="w-9 h-9 rounded-xl text-sm font-bold transition \${i === currentPage ? 'bg-blue-600 text-white shadow-md' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600'}">\${i}</button>\`;
                } else if (i === currentPage - 2 || i === currentPage + 2) {
                    pages += '<span class="w-9 h-9 flex items-center justify-center text-slate-400">…</span>';
                }
            }
            paginationEl.innerHTML = \`<button onclick="goToPage(\${currentPage - 1})" \${currentPage === 1 ? 'disabled' : ''} class="w-9 h-9 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"><i data-feather="chevron-left" class="w-4 h-4"></i></button>\${pages}<button onclick="goToPage(\${currentPage + 1})" \${currentPage === totalPages ? 'disabled' : ''} class="w-9 h-9 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"><i data-feather="chevron-right" class="w-4 h-4"></i></button>\`;
            feather.replace();
        }
        function goToPage(page) {
            const totalPages = Math.ceil(filteredData.length / itemsPerPage);
            if (page < 1 || page > totalPages) return;
            currentPage = page; renderTable();
        }
        function searchArsip(query) {
            const q = query.toLowerCase();
            filteredData = allData.filter(s => s.jenisSurat?.toLowerCase().includes(q) || s.namaPemohon?.toLowerCase().includes(q) || s.nomorSurat?.toLowerCase().includes(q));
            currentPage = 1; renderTable();
        }
        function filterByType(type) {
            if (type === 'all') filteredData = [...allData];
            else if (type === 'manual') filteredData = allData.filter(s => s.templateId === 'manual');
            else filteredData = allData.filter(s => s.templateId !== 'manual');
            currentPage = 1; renderTable();
            document.querySelectorAll('.filter-btn').forEach(btn => { btn.classList.remove('bg-blue-600', 'text-white', 'shadow-md'); btn.classList.add('bg-white', 'dark:bg-slate-700', 'text-slate-600', 'dark:text-slate-300'); });
            event.target.classList.add('bg-blue-600', 'text-white', 'shadow-md');
            event.target.classList.remove('bg-white', 'dark:bg-slate-700', 'text-slate-600', 'dark:text-slate-300');
        }
        async function deleteSurat(id, name) {
            const result = await Swal.fire({ title: 'Hapus Surat?', html: \`Surat <strong>\${name}</strong> akan dihapus permanen.\`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#64748b', confirmButtonText: 'Ya, Hapus!', cancelButtonText: 'Batal', customClass: { popup: 'rounded-2xl', confirmButton: 'rounded-xl font-bold', cancelButton: 'rounded-xl font-bold' } });
            if (result.isConfirmed) {
                try {
                    const res = await fetch('/api/surat/' + id, { method: 'DELETE' });
                    const data = await res.json();
                    if (data.success) { allData = allData.filter(s => s.id !== id); filteredData = filteredData.filter(s => s.id !== id); renderTable(); showToast('Surat berhasil dihapus!', 'success'); }
                } catch(e) { showToast('Gagal menghapus surat', 'error'); }
            }
        }
        async function exportCSV() {
            const res = await fetch('/api/arsip');
            const data = await res.json();
            const rows = [['No','Jenis Surat','Nomor Surat','Nama Pemohon','Tipe','Tanggal']];
            data.surat.forEach((s, i) => { rows.push([i+1, s.jenisSurat, s.nomorSurat||'-', s.namaPemohon, s.templateId==='manual'?'Manual':'Otomatis', s.tanggalDibuat||'-']); });
            const csv = rows.map(r => r.map(c => '"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'arsip-surat.csv'; a.click();
            showToast('Data berhasil diekspor ke CSV!', 'success');
        }
        loadArsip();
        const urlSearch = new URLSearchParams(window.location.search).get('search');
        if (urlSearch) { document.getElementById('searchInput').value = urlSearch; setTimeout(() => searchArsip(urlSearch), 500); }
    </script>`;

    const modalUpload = `
        <div id="modalUpload" class="hidden fixed inset-0 modal-backdrop bg-black/60 z-50 flex justify-center items-center p-4">
            <div class="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
                <div class="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <div class="flex items-center gap-3"><div class="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center"><i data-feather="upload-cloud" class="w-5 h-5"></i></div><div><h3 class="font-bold text-slate-800 dark:text-slate-200">Upload Arsip Manual</h3><p class="text-xs text-slate-500 dark:text-slate-400">Tambah dokumen ke arsip</p></div></div>
                    <button onclick="toggleModal('modalUpload')" class="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-red-500 transition"><i data-feather="x" class="w-5 h-5"></i></button>
                </div>
                <form action="/upload-arsip" method="POST" enctype="multipart/form-data" class="p-6 space-y-4">
                    <div><label class="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Jenis Surat</label><input type="text" name="jenisSurat" required placeholder="Contoh: Surat Pengantar KTP" class="input-field w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400"></div>
                    <div><label class="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Nama Pemohon</label><input type="text" name="namaPemohon" required placeholder="Contoh: Budi Santoso" class="input-field w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400"></div>
                    <div><label class="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Nomor Surat</label><input type="text" name="nomorSurat" required placeholder="Contoh: 145/001/DS/I/2026" class="input-field w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400"></div>
                    <div><label class="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">File Dokumen (.docx)</label><label class="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition group"><div class="flex flex-col items-center gap-2 text-slate-400 group-hover:text-blue-500 transition"><i data-feather="upload" class="w-6 h-6"></i><span class="text-sm font-semibold">Klik untuk pilih file</span><span class="text-xs">Format: .docx</span></div><input type="file" name="fileArsip" accept=".docx" required class="hidden" onchange="updateFileName(this)"></label><p id="selectedFileName" class="text-xs text-blue-600 mt-1.5 font-medium hidden"></p></div>
                    <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-600/30 transition flex justify-center items-center gap-2 mt-2"><i data-feather="save" class="w-4 h-4"></i> Simpan ke Arsip</button>
                </form>
            </div>
        </div>`;

    const content = `
        ${modalUpload}
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 animate-slide-up">
            <div><h2 class="text-2xl lg:text-3xl font-extrabold text-slate-800 dark:text-slate-100">Arsip Surat</h2><p class="text-slate-500 dark:text-slate-400 mt-1 text-sm">Kelola semua surat yang telah diterbitkan</p></div>
            <div class="flex gap-3">
                <button onclick="exportCSV()" class="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:border-green-400 hover:text-green-600 transition text-sm font-semibold shadow-sm"><i data-feather="download-cloud" class="w-4 h-4"></i><span class="hidden sm:inline">Export CSV</span></button>
                <button onclick="toggleModal('modalUpload')" class="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:border-blue-300 transition text-sm font-semibold shadow-sm"><i data-feather="upload" class="w-4 h-4"></i><span class="hidden sm:inline">Upload Arsip</span></button>
                <a href="/templates" class="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition text-sm font-bold shadow-lg shadow-blue-600/30"><i data-feather="plus" class="w-4 h-4"></i><span class="hidden sm:inline">Buat Surat</span></a>
            </div>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 mb-6 shadow-sm animate-slide-up">
            <div class="flex flex-col sm:flex-row gap-4">
                <div class="relative flex-1"><i data-feather="search" class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"></i><input type="text" id="searchInput" oninput="searchArsip(this.value)" placeholder="Cari nama, nomor, atau jenis surat..." class="input-field w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition text-slate-800 dark:text-slate-200 placeholder-slate-400"></div>
                <div class="flex gap-2 shrink-0">
                    <button onclick="filterByType('all')" class="filter-btn px-4 py-2.5 rounded-xl text-sm font-bold transition border border-slate-200 dark:border-slate-600 bg-blue-600 text-white shadow-md">Semua</button>
                    <button onclick="filterByType('auto')" class="filter-btn px-4 py-2.5 rounded-xl text-sm font-bold transition border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300">Otomatis</button>
                    <button onclick="filterByType('manual')" class="filter-btn px-4 py-2.5 rounded-xl text-sm font-bold transition border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300">Manual</button>
                </div>
            </div>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden animate-slide-up">
            <div class="overflow-x-auto">
                <table class="w-full text-left">
                    <thead class="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                            <th class="px-4 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-12">No</th>
                            <th class="px-4 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Jenis & Nomor Surat</th>
                            <th class="px-4 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nama Pemohon</th>
                            <th class="px-4 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">Tipe</th>
                            <th class="px-4 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden lg:table-cell">Tanggal</th>
                            <th class="px-4 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Aksi</th>
                        </tr>
                    </thead>
                    <tbody id="arsipTableBody">
                        ${[1,2,3,4,5].map(() => `<tr class="border-b border-slate-100 dark:border-slate-700"><td class="px-4 py-4"><div class="skeleton h-4 w-6 rounded"></div></td><td class="px-4 py-4"><div class="skeleton h-4 w-48 rounded mb-2"></div><div class="skeleton h-3 w-32 rounded"></div></td><td class="px-4 py-4"><div class="skeleton h-4 w-36 rounded"></div></td><td class="px-4 py-4 hidden md:table-cell"><div class="skeleton h-6 w-20 rounded-full"></div></td><td class="px-4 py-4 hidden lg:table-cell"><div class="skeleton h-4 w-28 rounded"></div></td><td class="px-4 py-4"><div class="skeleton h-8 w-24 rounded-lg"></div></td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
            <div class="px-4 py-4 border-t border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p id="paginationInfo" class="text-sm text-slate-500 dark:text-slate-400 font-medium"></p>
                <div id="pagination" class="flex items-center gap-1.5"></div>
            </div>
        </div>`;

    res.send(layoutHTML('Arsip Surat', content, 'arsip', extraScript, 'Arsip Surat'));
});

app.post('/upload-arsip', uploadArsip.single('fileArsip'), (req, res) => {
    try {
        if (!req.file) return res.send("Gagal mengupload file arsip.");
        const db = readDB();
        db.surat.push({ id: Date.now().toString(), templateId: 'manual', jenisSurat: req.body.jenisSurat, namaPemohon: req.body.namaPemohon, nomorSurat: req.body.nomorSurat, tanggalDibuat: new Date().toLocaleString('id-ID'), filename: req.file.filename });
        writeDB(db);
        res.redirect('/arsip?success_upload=1');
    } catch (error) {
        console.error("Error Upload Arsip:", error);
        res.status(500).send("Terjadi kesalahan saat menyimpan arsip manual.");
    }
});

// ==========================================
// 6. HALAMAN KELOLA TEMPLATE
// ==========================================
app.get('/templates', (req, res) => {
    const db = readDB();
    const templateCards = db.templates.length === 0
        ? `<div class="col-span-full flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500"><div class="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4"><i data-feather="file-plus" class="w-10 h-10"></i></div><p class="font-bold text-lg">Belum ada template</p><p class="text-sm mt-1">Upload template .docx pertama Anda di atas</p></div>`
        : db.templates.map((t, index) => `
        <div class="card-hover bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm group animate-slide-up" style="animation-delay:${index * 0.05}s">
            <div class="flex items-start justify-between mb-4">
                <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20"><i data-feather="file-text" class="w-6 h-6"></i></div>
                <a href="/templates/hapus/${t.id}" onclick="return confirm('Yakin ingin menghapus template \\'${t.namaTemplate}\\'?')" class="p-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 transition opacity-0 group-hover:opacity-100"><i data-feather="trash-2" class="w-4 h-4"></i></a>
            </div>
            <h3 class="font-bold text-slate-800 dark:text-slate-200 mb-1">${t.namaTemplate}</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1"><i data-feather="file" class="w-3 h-3"></i> ${t.originalFile}</p>
            <p class="text-xs text-slate-400 dark:text-slate-500 mb-4 flex items-center gap-1"><i data-feather="clock" class="w-3 h-3"></i> ${t.tanggalUpload}</p>
            <div class="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
                <div class="text-xs text-slate-500 dark:text-slate-400"><span class="font-bold text-slate-700 dark:text-slate-300">${t.nomorTerakhir || 0}</span> surat dibuat</div>
                <a href="/buat-surat/${t.id}" class="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-600/20"><i data-feather="edit-3" class="w-3.5 h-3.5"></i> Buat Surat</a>
            </div>
        </div>`).join('');

    const extraScript = `<script>
        ${req.query.success ? `showToast('Template berhasil diupload!', 'success'); window.history.replaceState(null, null, '/templates');` : ''}
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileTemplate');
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('border-blue-500', 'bg-blue-50'); });
            dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('border-blue-500', 'bg-blue-50'); });
            dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('border-blue-500', 'bg-blue-50'); const files = e.dataTransfer.files; if (files[0]) { fileInput.files = files; updateDropZone(files[0].name); } });
            dropZone.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', () => { if (fileInput.files[0]) updateDropZone(fileInput.files[0].name); });
        }
        function updateDropZone(filename) {
            document.getElementById('dropZoneText').innerHTML = \`<div class="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center mx-auto mb-2"><i data-feather="check-circle" class="w-5 h-5"></i></div><p class="font-bold text-blue-600 text-sm">\${filename}</p><p class="text-xs text-slate-500 mt-1">File siap diupload</p>\`;
            feather.replace();
        }
    </script>`;

    const content = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 animate-slide-up">
            <div><h2 class="text-2xl lg:text-3xl font-extrabold text-slate-800 dark:text-slate-100">Kelola Template</h2><p class="text-slate-500 dark:text-slate-400 mt-1 text-sm">Upload dan kelola template surat desa</p></div>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 mb-8 shadow-sm animate-slide-up">
            <h3 class="font-bold text-slate-800 dark:text-slate-200 mb-5 flex items-center gap-2"><div class="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center"><i data-feather="upload" class="w-4 h-4"></i></div> Upload Template Baru</h3>
            <form action="/templates/upload" method="POST" enctype="multipart/form-data">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label class="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wider">Nama Jenis Surat</label>
                        <input type="text" name="namaTemplate" required placeholder="Contoh: SKU, SKTM, Surat Keterangan Domisili" class="input-field w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400">
                        <p class="text-xs text-slate-400 dark:text-slate-500 mt-1.5">Nama ini akan muncul sebagai judul form pembuatan surat.</p>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wider">File Template (.docx)</label>
                        <div id="dropZone" class="flex flex-col items-center justify-center h-24 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-pointer hover:border-blue-400 transition">
                            <div id="dropZoneText" class="text-center text-slate-400 dark:text-slate-500"><i data-feather="upload-cloud" class="w-6 h-6 mx-auto mb-1"></i><p class="text-sm font-semibold">Drag & drop atau klik untuk pilih</p><p class="text-xs mt-0.5">Format: .docx</p></div>
                            <input type="file" id="fileTemplate" name="fileTemplate" accept=".docx" required class="hidden">
                        </div>
                    </div>
                </div>
                <div class="mt-5 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 flex gap-3">
                    <i data-feather="info" class="w-5 h-5 text-blue-500 shrink-0 mt-0.5"></i>
                    <div class="text-sm text-blue-800 dark:text-blue-300"><p class="font-bold mb-1">Cara membuat template:</p><p>Gunakan tag <code class="bg-blue-100 dark:bg-blue-800 px-1.5 py-0.5 rounded font-mono text-xs">{NAMA_TAG}</code> di dalam file Word. Contoh: <code class="bg-blue-100 dark:bg-blue-800 px-1.5 py-0.5 rounded font-mono text-xs">{NAMA}</code>, <code class="bg-blue-100 dark:bg-blue-800 px-1.5 py-0.5 rounded font-mono text-xs">{NIK}</code>, <code class="bg-blue-100 dark:bg-blue-800 px-1.5 py-0.5 rounded font-mono text-xs">{ALAMAT}</code>.</p></div>
                </div>
                <div class="mt-5 flex justify-end"><button type="submit" class="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-lg shadow-blue-600/30"><i data-feather="save" class="w-4 h-4"></i> Simpan Template</button></div>
            </form>
        </div>
        <div>
            <h3 class="font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2"><i data-feather="layers" class="w-5 h-5 text-blue-600"></i> Template Tersedia (${db.templates.length})</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">${templateCards}</div>
        </div>`;

    res.send(layoutHTML('Kelola Template', content, 'templates', extraScript, 'Kelola Template'));
});

app.post('/templates/upload', upload.single('fileTemplate'), (req, res) => {
    if (!req.file) return res.send("Gagal mengupload file.");
    const db = readDB();
    db.templates.push({ id: Date.now().toString(), namaTemplate: req.body.namaTemplate, originalFile: req.file.originalname, savedFile: req.file.filename, tanggalUpload: new Date().toLocaleString('id-ID'), formatNomor: "145/[NOMOR]/DS/[BULAN]/[TAHUN]", nomorTerakhir: 0 });
    writeDB(db);
    res.redirect('/templates?success=1');
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
// 7. HALAMAN PENGATURAN
// ==========================================
app.get('/pengaturan', (req, res) => {
    const db = readDB();
    const settings = db.settings;
    const templatesSettingHTML = db.templates.length === 0
        ? `<div class="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700"><i data-feather="file-plus" class="w-10 h-10 mb-3"></i><p class="font-semibold">Belum ada template</p><p class="text-sm mt-1">Upload template terlebih dahulu di menu <a href="/templates" class="text-blue-600 font-bold hover:underline">Kelola Template</a></p></div>`
        : db.templates.map(t => `
        <div class="p-5 bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-blue-300 dark:hover:border-blue-600 transition">
            <div class="flex items-center gap-3 mb-4"><div class="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white"><i data-feather="file-text" class="w-4 h-4"></i></div><div><h4 class="font-bold text-slate-800 dark:text-slate-200 text-sm">${t.namaTemplate}</h4><p class="text-xs text-slate-500 dark:text-slate-400">${t.originalFile}</p></div></div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label class="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Format Nomor Surat</label><input type="text" name="format_${t.id}" value="${t.formatNomor || '145/[NOMOR]/DS/[BULAN]/[TAHUN]'}" required class="input-field w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition text-slate-800 dark:text-slate-200 font-mono"></div>
                <div><label class="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Nomor Terakhir Dicetak</label><input type="number" name="nomor_${t.id}" value="${t.nomorTerakhir || 0}" required min="0" class="input-field w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition text-slate-800 dark:text-slate-200"></div>
            </div>
        </div>`).join('');

    const extraScript = req.query.success ? `<script>showToast('Pengaturan berhasil disimpan!', 'success'); window.history.replaceState(null, null, '/pengaturan');</script>` : '';

    const content = `
        <div class="mb-8 animate-slide-up"><h2 class="text-2xl lg:text-3xl font-extrabold text-slate-800 dark:text-slate-100">Pengaturan Sistem</h2><p class="text-slate-500 dark:text-slate-400 mt-1 text-sm">Konfigurasi sistem dan format penomoran surat</p></div>
        <form action="/simpan-pengaturan" method="POST" class="space-y-6 max-w-4xl">
            <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm animate-slide-up">
                <h3 class="font-bold text-slate-800 dark:text-slate-200 mb-5 flex items-center gap-2"><div class="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center"><i data-feather="home" class="w-4 h-4"></i></div> Identitas Instansi</h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div><label class="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Nama Instansi</label><input type="text" name="namaInstansi" value="${settings.namaInstansi || ''}" placeholder="Pemerintah Desa ..." class="input-field w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition text-slate-800 dark:text-slate-200 placeholder-slate-400"></div>
                    <div><label class="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Alamat</label><input type="text" name="alamatInstansi" value="${settings.alamatInstansi || ''}" placeholder="Jl. Raya Desa No. 1" class="input-field w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition text-slate-800 dark:text-slate-200 placeholder-slate-400"></div>
                    <div><label class="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Nomor Telepon</label><input type="text" name="telepon" value="${settings.telepon || ''}" placeholder="(021) 12345678" class="input-field w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition text-slate-800 dark:text-slate-200 placeholder-slate-400"></div>
                    <div><label class="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Website</label><input type="text" name="website" value="${settings.website || ''}" placeholder="www.desa.go.id" class="input-field w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition text-slate-800 dark:text-slate-200 placeholder-slate-400"></div>
                </div>
            </div>
            <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm animate-slide-up">
                <h3 class="font-bold text-slate-800 dark:text-slate-200 mb-5 flex items-center gap-2"><div class="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center"><i data-feather="sliders" class="w-4 h-4"></i></div> Pengaturan Global</h3>
                <label class="flex items-center gap-4 cursor-pointer p-4 bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-blue-300 dark:hover:border-blue-600 transition group">
                    <div class="relative shrink-0">
                        <input type="checkbox" name="gunakanQR" value="true" id="qrToggle" class="sr-only" ${settings.gunakanQR ? 'checked' : ''} onchange="updateToggle(this)">
                        <div id="toggleBg" class="w-14 h-7 rounded-full transition-colors ${settings.gunakanQR ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}"></div>
                        <div id="toggleDot" class="absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${settings.gunakanQR ? 'translate-x-7' : ''}"></div>
                    </div>
                    <div class="flex-1"><p class="font-bold text-slate-800 dark:text-slate-200 text-sm">Aktifkan Tanda Tangan QR Code</p><p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Sisipkan QR Code verifikasi pada surat. Gunakan tag <code class="bg-slate-200 dark:bg-slate-600 px-1 rounded font-mono">{%QR_CODE}</code> di template Word.</p></div>
                </label>
            </div>
            <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm animate-slide-up">
                <h3 class="font-bold text-slate-800 dark:text-slate-200 mb-5 flex items-center gap-2"><div class="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center"><i data-feather="hash" class="w-4 h-4"></i></div> Format Penomoran per Template</h3>
                <div class="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800 flex gap-3 mb-5"><i data-feather="alert-circle" class="w-5 h-5 text-amber-500 shrink-0 mt-0.5"></i><div class="text-sm text-amber-800 dark:text-amber-300"><p class="font-bold mb-1">Tag yang tersedia:</p><div class="flex flex-wrap gap-2"><code class="bg-amber-100 dark:bg-amber-800 px-2 py-0.5 rounded font-mono text-xs">[NOMOR]</code><code class="bg-amber-100 dark:bg-amber-800 px-2 py-0.5 rounded font-mono text-xs">[BULAN]</code><code class="bg-amber-100 dark:bg-amber-800 px-2 py-0.5 rounded font-mono text-xs">[TAHUN]</code></div></div></div>
                <div class="space-y-4">${templatesSettingHTML}</div>
            </div>
            <div class="flex justify-end gap-3 animate-slide-up">
                <a href="/" class="px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition hover:bg-slate-50 dark:hover:bg-slate-700">Batal</a>
                <button type="submit" class="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-lg shadow-blue-600/30"><i data-feather="save" class="w-4 h-4"></i> Simpan Pengaturan</button>
            </div>
        </form>
        <script>
        function updateToggle(checkbox) {
            const bg = document.getElementById('toggleBg');
            const dot = document.getElementById('toggleDot');
            if (checkbox.checked) { bg.classList.remove('bg-slate-300','dark:bg-slate-600'); bg.classList.add('bg-blue-600'); dot.classList.add('translate-x-7'); }
            else { bg.classList.add('bg-slate-300','dark:bg-slate-600'); bg.classList.remove('bg-blue-600'); dot.classList.remove('translate-x-7'); }
        }
        </script>`;

    res.send(layoutHTML('Pengaturan', content, 'pengaturan', extraScript, 'Pengaturan'));
});

app.post('/simpan-pengaturan', (req, res) => {
    const db = readDB();
    db.settings.gunakanQR = req.body.gunakanQR === 'true';
    db.settings.namaInstansi = req.body.namaInstansi || db.settings.namaInstansi;
    db.settings.alamatInstansi = req.body.alamatInstansi || db.settings.alamatInstansi;
    db.settings.telepon = req.body.telepon || db.settings.telepon;
    db.settings.website = req.body.website || db.settings.website;
    db.templates = db.templates.map(t => {
        if (req.body[`format_${t.id}`] !== undefined) { t.formatNomor = req.body[`format_${t.id}`]; t.nomorTerakhir = parseInt(req.body[`nomor_${t.id}`]) || 0; }
        return t;
    });
    writeDB(db);
    res.redirect('/pengaturan?success=1');
});

// ==========================================
// 8. FITUR CERDAS: AUTO-GENERATE FORM
// ==========================================
function extractTagsFromDocx(filePath) {
    try {
        const docXml = new PizZip(fs.readFileSync(filePath, 'binary')).file("word/document.xml").asText();
        const plainText = docXml.replace(/<[^>]+>/g, "");
        const tags = new Set();
        const regex = /\{([a-zA-Z0-9_]+)\}/g;
        let match;
        while ((match = regex.exec(plainText)) !== null) { tags.add(match[1]); }
        return Array.from(tags);
    } catch (error) { return []; }
}

app.get('/buat-surat/:templateId', (req, res) => {
    const db = readDB();
    const template = db.templates.find(t => t.id === req.params.templateId);
    if (!template) return res.send("Template tidak ditemukan.");
    const tags = extractTagsFromDocx(path.join(DIR_TEMPLATES, template.savedFile));
    if (tags.length === 0) return res.send(`<div style="font-family:sans-serif;padding:40px;text-align:center;color:#ef4444;"><h2>⚠️ Tidak ada variabel ditemukan</h2><p>Pastikan template menggunakan format <strong>{NAMA_TAG}</strong> tanpa spasi.</p><a href="/templates" style="color:#3b82f6;">← Kembali ke Template</a></div>`);

    let nextNum = (template.nomorTerakhir !== undefined ? template.nomorTerakhir : 0) + 1;
    let formatTpl = template.formatNomor || "145/[NOMOR]/DS/[BULAN]/[TAHUN]";
    let bulanRomawi = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"][new Date().getMonth()];
    let tahun = new Date().getFullYear();
    let autoNomor = formatTpl.replace('[NOMOR]', String(nextNum).padStart(3, '0')).replace('[BULAN]', bulanRomawi).replace('[TAHUN]', tahun);

    const selectClass = "input-field w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition text-sm text-slate-800 dark:text-slate-200 appearance-none cursor-pointer";
    const inputClass = "input-field w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400";

    let formInputs = tags.map(tag => {
        let component = '';
        let lowerTag = tag.toLowerCase();
        let label = tag.replace(/_/g, ' ');
        let icon = 'edit-2';
        if (lowerTag.includes('nomor') && !lowerTag.includes('nik')) {
            icon = 'hash';
            component = `<div class="relative"><input type="text" name="${tag}" value="${autoNomor}" required class="input-field w-full px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-300 font-bold rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition text-sm"><span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded-lg font-bold">AUTO</span></div><p class="text-xs text-blue-500 dark:text-blue-400 mt-1.5 flex items-center gap-1"><i data-feather="info" class="w-3 h-3"></i> Nomor otomatis untuk <b>${template.namaTemplate}</b></p>`;
        } else if (lowerTag.includes('kelamin')) {
            icon = 'users';
            component = `<div class="relative"><select name="${tag}" required class="${selectClass}"><option value="">-- Pilih Jenis Kelamin --</option><option value="Laki-laki">Laki-laki</option><option value="Perempuan">Perempuan</option></select><i data-feather="chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"></i></div>`;
        } else if (lowerTag.includes('agama')) {
            icon = 'heart';
            component = `<div class="relative"><select name="${tag}" required class="${selectClass}"><option value="">-- Pilih Agama --</option><option value="Islam">Islam</option><option value="Kristen Protestan">Kristen Protestan</option><option value="Katolik">Katolik</option><option value="Hindu">Hindu</option><option value="Buddha">Buddha</option><option value="Konghucu">Konghucu</option></select><i data-feather="chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"></i></div>`;
        } else if (lowerTag.includes('status')) {
            icon = 'user-check';
            component = `<div class="relative"><select name="${tag}" required class="${selectClass}"><option value="">-- Pilih Status Perkawinan --</option><option value="Belum Kawin">Belum Kawin</option><option value="Kawin">Kawin</option><option value="Cerai Hidup">Cerai Hidup</option><option value="Cerai Mati">Cerai Mati</option></select><i data-feather="chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"></i></div>`;
        } else if (lowerTag.includes('pekerjaan')) {
            icon = 'briefcase';
            component = `<div class="relative"><select name="${tag}" required class="${selectClass}"><option value="">-- Pilih Pekerjaan --</option><option value="Petani">Petani</option><option value="Pedagang">Pedagang</option><option value="Pegawai Negeri Sipil">Pegawai Negeri Sipil</option><option value="TNI/Polri">TNI/Polri</option><option value="Karyawan Swasta">Karyawan Swasta</option><option value="Wiraswasta">Wiraswasta</option><option value="Pelajar/Mahasiswa">Pelajar/Mahasiswa</option><option value="Ibu Rumah Tangga">Ibu Rumah Tangga</option><option value="Pensiunan">Pensiunan</option><option value="Tidak Bekerja">Tidak Bekerja</option><option value="Lainnya">Lainnya</option></select><i data-feather="chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"></i></div>`;
        } else if (lowerTag.includes('pendidikan')) {
            icon = 'book-open';
            component = `<div class="relative"><select name="${tag}" required class="${selectClass}"><option value="">-- Pilih Pendidikan --</option><option value="Tidak Sekolah">Tidak Sekolah</option><option value="SD/Sederajat">SD/Sederajat</option><option value="SMP/Sederajat">SMP/Sederajat</option><option value="SMA/Sederajat">SMA/Sederajat</option><option value="D3">D3</option><option value="S1">S1</option><option value="S2">S2</option><option value="S3">S3</option></select><i data-feather="chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"></i></div>`;
        } else if (lowerTag.includes('alamat') || lowerTag.includes('usaha') || lowerTag.includes('keterangan') || lowerTag.includes('keperluan')) {
            icon = 'align-left';
            component = `<textarea name="${tag}" rows="3" required placeholder="Ketik rincian di sini..." class="${inputClass} resize-y"></textarea>`;
        } else if (lowerTag.includes('tanggal') || lowerTag.includes('tgl')) {
            icon = 'calendar';
            component = `<input type="text" name="${tag}" required placeholder="Misal: 17 Agustus 1945" class="${inputClass}">`;
        } else if (lowerTag.includes('nik') || lowerTag.includes('kk')) {
            icon = 'credit-card';
            component = `<input type="text" name="${tag}" required placeholder="16 digit NIK/KK" maxlength="16" pattern="[0-9]{16}" class="${inputClass}" oninput="this.value=this.value.replace(/[^0-9]/g,'')">`;
        } else if (lowerTag.includes('hp') || lowerTag.includes('telp') || lowerTag.includes('phone')) {
            icon = 'phone';
            component = `<input type="tel" name="${tag}" required placeholder="Contoh: 08123456789" class="${inputClass}">`;
        } else if (lowerTag.includes('nama')) {
            icon = 'user';
            component = `<input type="text" name="${tag}" required placeholder="Nama lengkap sesuai KTP" class="${inputClass}" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()">`;
        } else {
            component = `<input type="text" name="${tag}" required placeholder="Isi ${label}..." class="${inputClass}">`;
        }
        return `<div class="mb-5"><label class="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wider"><i data-feather="${icon}" class="w-3.5 h-3.5 text-blue-500"></i>${label}</label>${component}</div>`;
    }).join('');

    const submitScript = `<script>document.getElementById('formSurat').addEventListener('submit', function(e) { const btn = document.getElementById('btnSubmit'); btn.disabled = true; btn.innerHTML = '<svg class="spinner w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Sedang Memproses...'; });</script>`;

    const content = `
        <div class="flex items-center gap-4 mb-8 animate-slide-up">
            <a href="/templates" class="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-300 transition shadow-sm"><i data-feather="arrow-left" class="w-5 h-5"></i></a>
            <div><h2 class="text-2xl lg:text-3xl font-extrabold text-slate-800 dark:text-slate-100">Buat Surat</h2><p class="text-slate-500 dark:text-slate-400 mt-0.5 text-sm flex items-center gap-1.5"><i data-feather="layers" class="w-3.5 h-3.5"></i> Template: <strong class="text-blue-600 dark:text-blue-400">${template.namaTemplate}</strong><span class="text-slate-300 dark:text-slate-600">•</span><span>${tags.length} field ditemukan</span></p></div>
        </div>
        <div class="max-w-4xl mx-auto">
            <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 mb-6 shadow-sm animate-slide-up">
                <div class="flex items-center gap-3">
                    <div class="flex items-center gap-2 text-blue-600"><div class="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">1</div><span class="text-sm font-bold">Isi Data</span></div>
                    <div class="flex-1 h-0.5 bg-slate-200 dark:bg-slate-700 rounded"></div>
                    <div class="flex items-center gap-2 text-slate-400 dark:text-slate-500"><div class="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold">2</div><span class="text-sm font-medium">Proses</span></div>
                    <div class="flex-1 h-0.5 bg-slate-200 dark:bg-slate-700 rounded"></div>
                    <div class="flex items-center gap-2 text-slate-400 dark:text-slate-500"><div class="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold">3</div><span class="text-sm font-medium">Unduh</span></div>
                </div>
            </div>
            <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden animate-slide-up">
                <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30"><h3 class="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2"><i data-feather="edit-3" class="w-4 h-4 text-blue-600"></i> Formulir Pengisian Data</h3><p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Semua field wajib diisi dengan benar</p></div>
                <form id="formSurat" action="/generate-surat" method="POST" class="p-6">
                    <input type="hidden" name="templateId" value="${template.id}">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8">${formInputs}</div>
                    <div class="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row gap-3 justify-end">
                        <a href="/templates" class="flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition hover:bg-slate-200 dark:hover:bg-slate-600"><i data-feather="x" class="w-4 h-4"></i> Batal</a>
                        <button id="btnSubmit" type="submit" class="flex items-center justify-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-lg shadow-blue-600/30"><i data-feather="printer" class="w-5 h-5"></i> Proses & Buat Surat</button>
                    </div>
                </form>
            </div>
        </div>`;

    res.send(layoutHTML('Buat Surat', content, 'templates', submitScript, `Buat Surat — ${template.namaTemplate}`));
});

// ==========================================
// 9. GENERATE SURAT
// ==========================================
app.post('/generate-surat', async (req, res) => {
    try {
        const db = readDB();
        const template = db.templates.find(t => t.id === req.body.templateId);
        if (!template) return res.status(404).send("Template tidak ditemukan.");
        const suratId = Date.now().toString();
        let docOptions = { paragraphLoop: true, linebreaks: true };
        if (db.settings.gunakanQR) {
            try {
                const ImageModule = require('docxtemplater-image-module-free');
                const qrPath = path.join(DIR_QR, `${suratId}.png`);
                const verifyUrl = `http://localhost:${PORT}/verifikasi/${suratId}`;
                await QRCode.toFile(qrPath, verifyUrl, { width: 150 });
                const imageOpts = { centered: false, getImage: (tagValue) => fs.readFileSync(tagValue), getSize: () => [100, 100] };
                docOptions.modules = [new ImageModule(imageOpts)];
                req.body.QR_CODE = qrPath;
            } catch (err) { console.error("Gagal memproses QR Code:", err); }
        }
        const doc = new Docxtemplater(new PizZip(fs.readFileSync(path.join(DIR_TEMPLATES, template.savedFile), 'binary')), docOptions);
        doc.render(req.body);
        const buffer = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
        let namaPemohon = req.body['NAMA'] || req.body['NAMA_LENGKAP'] || req.body['PEMOHON'] || 'Warga';
        let outputFileName = `Surat_${namaPemohon.replace(/[^a-zA-Z0-9]/g, '_')}_${suratId.slice(-5)}.docx`;
        fs.writeFileSync(path.join(DIR_DOWNLOADS, outputFileName), buffer);
        let nomorSuratInput = Object.keys(req.body).find(k => k.toLowerCase().includes('nomor') && !k.toLowerCase().includes('nik'));
        db.surat.push({ id: suratId, templateId: template.id, jenisSurat: template.namaTemplate, namaPemohon: namaPemohon, nomorSurat: nomorSuratInput ? req.body[nomorSuratInput] : '-', tanggalDibuat: new Date().toLocaleString('id-ID'), filename: outputFileName });
        const tIndex = db.templates.findIndex(t => t.id === template.id);
        if (tIndex > -1) db.templates[tIndex].nomorTerakhir = (db.templates[tIndex].nomorTerakhir || 0) + 1;
        writeDB(db);
        res.redirect('/?success=1');
    } catch (error) {
        res.status(500).send(`<div style="font-family:sans-serif;padding:40px;text-align:center;color:#ef4444;"><h2>⚠️ Terjadi Kesalahan</h2><p style="color:#64748b;max-width:500px;margin:0 auto;">${error.message}</p><a href="javascript:history.back()" style="display:inline-block;margin-top:20px;color:#3b82f6;font-weight:bold;">← Kembali</a></div>`);
    }
});

// ==========================================
// 10. KONVERSI PDF
// ==========================================
app.get('/preview-pdf/:filename', async (req, res) => {
    try {
        const docxPath = path.join(DIR_DOWNLOADS, req.params.filename);
        if (!fs.existsSync(docxPath)) return res.status(404).send("File tidak ditemukan.");
        const fileBuffer = fs.readFileSync(docxPath);
        const pdfBuffer = await libre.convertAsync(fileBuffer, '.pdf', undefined);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${req.params.filename.replace('.docx', '.pdf')}"`);
        res.send(pdfBuffer);
    } catch (error) {
        res.status(500).send(`<div style="font-family:sans-serif;padding:40px;text-align:center;color:#ef4444;"><h2>⚠️ Gagal Membuat PDF</h2><p style="color:#64748b;">Pastikan LibreOffice terinstall di server.</p><p style="color:#94a3b8;font-size:12px;">${error.message}</p></div>`);
    }
});

// ==========================================
// 11. VERIFIKASI QR CODE
// ==========================================
app.get('/verifikasi/:id', (req, res) => {
    const db = readDB();
    const surat = db.surat.find(s => s.id === req.params.id);
    if (!surat) {
        return res.send(`<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verifikasi Gagal</title><script src="https://cdn.tailwindcss.com"></script><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet"><style>body{font-family:'Plus Jakarta Sans',sans-serif;}</style></head><body class="min-h-screen bg-red-50 flex items-center justify-center p-4"><div class="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center"><div class="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div><h2 class="text-xl font-extrabold text-red-600 mb-2">Dokumen Tidak Valid</h2><p class="text-slate-500 text-sm">Dokumen ini tidak terdaftar dalam sistem atau mungkin telah dipalsukan.</p><div class="mt-6 p-3 bg-red-50 rounded-xl border border-red-100"><p class="text-xs text-red-600 font-semibold">⚠️ Harap laporkan ke instansi terkait</p></div></div></body></html>`);
    }
    res.send(`<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verifikasi Surat</title><script src="https://cdn.tailwindcss.com"></script><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet"><style>body{font-family:'Plus Jakarta Sans',sans-serif;}</style></head><body class="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4"><div class="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full"><div class="text-center mb-6"><div class="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div><h2 class="text-xl font-extrabold text-green-700">Dokumen Terverifikasi</h2><p class="text-slate-500 text-sm mt-1">Dokumen ini resmi dan sah</p></div><div class="space-y-3 bg-slate-50 rounded-2xl p-5 border border-slate-100"><div class="flex justify-between items-start gap-3"><span class="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">Jenis Surat</span><span class="text-sm font-bold text-slate-800 text-right">${surat.jenisSurat}</span></div><div class="h-px bg-slate-200"></div><div class="flex justify-between items-start gap-3"><span class="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">Nomor Surat</span><span class="text-sm font-semibold text-slate-700 text-right font-mono">${surat.nomorSurat}</span></div><div class="h-px bg-slate-200"></div><div class="flex justify-between items-start gap-3"><span class="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">Nama Pemohon</span><span class="text-sm font-bold text-slate-800 text-right">${surat.namaPemohon}</span></div><div class="h-px bg-slate-200"></div><div class="flex justify-between items-start gap-3"><span class="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">Diterbitkan</span><span class="text-sm font-semibold text-slate-700 text-right">${surat.tanggalDibuat}</span></div></div><div class="mt-5 p-3 bg-green-50 rounded-xl border border-green-100 text-center"><p class="text-xs text-green-700 font-semibold">✅ Dikeluarkan oleh Sistem Informasi Desa</p></div></div></body></html>`);
});

app.get('/dashboard', (req, res) => res.redirect('/'));

app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════╗
║   🏡 SIDesa Pro v6.0 — Server Aktif     ║
║   🌐 http://localhost:${PORT}              ║
║   ✨ Super Canggih & Full Feature        ║
╚══════════════════════════════════════════╝
    `);
});
