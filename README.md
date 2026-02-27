# 🏡 SIDesa Pro v6.0

**Sistem Informasi Desa** — Aplikasi manajemen surat desa yang super canggih, kaya fitur, responsif di ponsel, dengan UI/UX modern.

## ✨ Fitur Unggulan

### 🎨 UI/UX Modern
- **Dark Mode** — Toggle gelap/terang dengan animasi smooth, tersimpan di localStorage
- **Glassmorphism Design** — Efek kaca modern dengan backdrop blur
- **Gradient Cards** — Stat cards dengan gradient warna yang indah
- **Animasi Smooth** — Fade-in, slide-up, dan transisi halus di semua elemen
- **Skeleton Loading** — Animasi loading placeholder saat data dimuat

### 📱 Mobile-First Responsive
- **Bottom Navigation** — Navigasi bawah khusus mobile seperti aplikasi native
- **Sidebar Overlay** — Sidebar dengan overlay dan animasi slide untuk mobile
- **Responsive Grid** — Layout adaptif dari 1 kolom (mobile) hingga 4 kolom (desktop)
- **Touch-Friendly** — Tombol dan input berukuran optimal untuk layar sentuh

### 📊 Dashboard Canggih
- **Chart.js Bar Chart** — Grafik batang statistik surat 6 bulan terakhir
- **Donut Chart** — Distribusi jenis surat dalam bentuk donut chart
- **4 Stat Cards** — Total surat, surat bulan ini, template aktif, arsip manual
- **Quick Create** — Shortcut buat surat langsung dari dashboard
- **Aktivitas Terbaru** — 5 surat terakhir dengan aksi hover

### 🔍 Pencarian & Filter
- **Global Search** — Pencarian global dengan shortcut Ctrl+K
- **Real-time Search** — Filter arsip secara real-time tanpa reload
- **Filter by Type** — Filter surat otomatis vs manual
- **Pagination** — Navigasi halaman dengan info jumlah data

### 📁 Manajemen Arsip
- **Hapus Surat** — Hapus surat dengan konfirmasi SweetAlert2
- **Export CSV** — Export semua arsip ke file CSV
- **Upload Arsip Manual** — Upload dokumen .docx langsung ke arsip
- **Drag & Drop Upload** — Upload template dengan drag & drop

### 📝 Pembuatan Surat Cerdas
- **Auto-Generate Form** — Form otomatis berdasarkan tag `{NAMA_TAG}` di template
- **Smart Field Detection** — Deteksi otomatis jenis field (dropdown, textarea, input)
- **Auto Nomor Surat** — Penomoran otomatis per template dengan format kustom
- **Progress Indicator** — Indikator langkah pembuatan surat
- **Loading State** — Tombol submit dengan animasi loading

### ⚙️ Pengaturan Lengkap
- **Identitas Instansi** — Nama, alamat, telepon, website
- **QR Code Verifikasi** — Tanda tangan elektronik dengan QR Code
- **Format Penomoran** — Format nomor surat per template dengan tag `[NOMOR]`, `[BULAN]`, `[TAHUN]`
- **Toggle Switch** — Toggle QR Code dengan animasi smooth

### 🔒 Verifikasi Dokumen
- **Halaman Verifikasi** — Scan QR Code untuk verifikasi keaslian surat
- **Status Valid/Invalid** — Tampilan jelas dokumen sah atau palsu

## 🚀 Cara Menjalankan

### Prasyarat
- Node.js >= 16.0.0
- LibreOffice (untuk konversi PDF)

### Instalasi

```bash
# Clone repository
git clone https://github.com/yazvip/web-surat-nodejs.git
cd web-surat-nodejs

# Install dependencies
npm install

# Jalankan server
npm start
```

Server akan berjalan di `http://localhost:3001`

## 📋 Cara Membuat Template

1. Buat file Word (.docx)
2. Gunakan tag `{NAMA_TAG}` untuk variabel yang akan diisi
3. Contoh tag yang didukung:
   - `{NAMA}` — Input teks (auto uppercase)
   - `{NIK}` — Input angka 16 digit
   - `{ALAMAT}` — Textarea
   - `{JENIS_KELAMIN}` — Dropdown (Laki-laki/Perempuan)
   - `{AGAMA}` — Dropdown agama
   - `{STATUS}` — Dropdown status perkawinan
   - `{PEKERJAAN}` — Dropdown pekerjaan
   - `{PENDIDIKAN}` — Dropdown pendidikan
   - `{TANGGAL}` — Input tanggal
   - `{NOMOR_SURAT}` — Auto-fill nomor surat
4. Upload template di menu **Kelola Template**

## 🛠️ Teknologi

- **Backend**: Node.js + Express.js
- **Template Engine**: Docxtemplater + PizZip
- **PDF Conversion**: LibreOffice Convert
- **QR Code**: qrcode
- **File Upload**: Multer
- **Frontend**: Tailwind CSS (CDN) + Feather Icons + Chart.js + SweetAlert2
- **Font**: Plus Jakarta Sans (Google Fonts)
- **Database**: JSON file (database.json)

## 📁 Struktur Folder

```
web-surat-nodejs/
├── server.js          # Server utama (semua logika)
├── package.json       # Dependencies
├── .gitignore
├── README.md
├── database.json      # Database (auto-generated, tidak di-commit)
├── uploads/
│   ├── templates/     # File template .docx
│   └── qr/           # File QR Code
└── public/
    └── downloads/     # File surat yang sudah dibuat
```

## 📸 Fitur Screenshot

- ✅ Dashboard dengan chart statistik
- ✅ Dark mode toggle
- ✅ Mobile bottom navigation
- ✅ Arsip surat dengan pagination & filter
- ✅ Form pembuatan surat otomatis
- ✅ Upload template drag & drop
- ✅ Pengaturan instansi & penomoran

---

**SIDesa Pro v6.0** — Dibuat dengan ❤️ untuk kemudahan administrasi desa
