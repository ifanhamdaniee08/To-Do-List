# 📋 TaskMaster — Modern Productivity & To-Do Dashboard

<div align="center">

![TaskMaster Banner](frontend/assets/images/logo.svg)

### Aplikasi Manajemen Produktivitas Full-Stack dengan Desain Responsif, Kalender Harian Interaktif, & Analitik Produktivitas

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue?logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0.3-black?logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6%2B-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![CSS3](https://img.shields.io/badge/CSS3-Modern%20Responsive-1572B6?logo=css3&logoColor=white)](https://www.w3.org/Style/CSS/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## 🌟 Tentang Proyek (Overview)

**TaskMaster** adalah aplikasi manajemen tugas dan produktivitas harian full-stack dengan arsitektur *decoupled* (Frontend dan Backend terpisah). Aplikasi ini menggabungkan kenyamanan pengelolaan tabel tugas bergaya **Notion**, integrasi jadwal harian visual mirip **Google Calendar**, papan proyek dinamis, editor catatan cepat dengan fitur konversi tugas instan, serta ringkasan analitik statistik kerja berbasis ikon **Retro Pixel-Art**.

Didesain secara khusus agar **100% responsif di semua ukuran layar** (Desktop, Tablet/iPad, dan Smartphone) tanpa mengurangi kerapian tata letak dan kenyamanan visual pengguna.

---

## ✨ Fitur-Fitur Unggulan

### 1. 🔐 Autentikasi Hibrida & Isolasi Data (Multi-User)
- **Registrasi & Login Lokal**: Dilindungi dengan enkripsi kata sandi kuat menggunakan `bcrypt` / `werkzeug.security`.
- **Google OAuth 2.0 (Google Identity Services)**: Login instan sekali klik menggunakan akun Google resmi.
- **Sesi Aman berbasis JWT**: Token JSON Web Token (JWT) disimpan di `localStorage` dengan otorisasi Bearer Token di setiap request API.
- **Isolasi Penuh**: Setiap pengguna hanya dapat melihat, menambah, mengubah, dan menghapus tugas mereka masing-masing.

### 2. 📋 Tabel To-Do List Bergaya Notion
- **Grup Tugas Aktif & Selesai**: Dilengkapi animasi penutupan/pembukaan accordion yang sangat halus (*smooth slide & cubic-bezier easing*).
- **Inline Quick Add**: Tambah tugas baru secara cepat langsung dari baris bawah tabel tanpa harus membuka modal popup.
- **Status & Priority Badges**: Visualisasi status (*To-do, In Progress, Completed*) dan tag prioritas (*Low, Medium, High*).
- **Filter & Pencarian Instan**: Cari tugas berdasarkan judul atau filter cepat (*Semua, Aktif, Selesai*).

### 3. 📅 Kalender 7 Hari & Timeline Harian 24 Jam
- **Grid Kalender Bulanan**: Penanda tanggal hari ini, titik kategori tugas berwarna, dan indikator persentase penyelesaian per hari.
- **Timeline Harian Interaktif (01.00 – 23.00)**: Buka timeline hari tertentu untuk melihat distribusi jam kerja.
- **Live Real-Time Red Line**: Garis merah pelacak waktu nyata (*live tracking*) dengan jam digital lokal (format 24 jam Indonesia, misal: `14.30`).
- **All-Day Tasks Drawer**: Bagian khusus untuk tugas harian tanpa jam spesifik yang dapat disembunyikan/ditampilkan.
- **Quick Schedule on Click**: Klik langsung pada slot jam kosong untuk menjadwalkan tugas pada jam tersebut.

### 4. 📁 Manajemen Proyek (Project Goals)
- **Kartu Proyek Interaktif**: Ringkasan jumlah tugas per proyek, persentase kemajuan (*progress bar* dinamis), dan penghitung tugas selesai.
- **Kategori / List Fleksibel**: Tambah proyek/kategori baru melalui modal popup terpusat.
- **Daftar List Kolapsibel di Sidebar**: Dilengkapi tombol panah atas/bawah dengan animasi smooth, serta penyimpanan status terakhir di browser (`localStorage`).

### 5. 📝 Catatan Cepat (Quick Notes) & Konverter Tugas
- **Scratchpad Editor**: Tulis catatan, ide, atau draft teks dengan auto-save otomatis ke `localStorage`.
- **Konversi Baris Catatan ke To-Do List**: Pilih baris tertentu di catatan, lalu konversi menjadi tugas to-do list resmi hanya dengan satu klik!
- **Tautkan Catatan ke Proyek**: Hubungkan catatan dengan kategori proyek yang relevan.

### 6. 📊 Statistik & Ringkasan Produktivitas (Productivity Analytics)
- **4 Kartu Metrik Utama**:
  - ⚠️ **Tugas Terlambat (Overdue Tasks)**: Peringatan visual jika ada tugas aktif melewati batas tenggat hari ini.
  - ✅ **Tugas Selesai & Completion Rate**: Penghitung tugas selesai lengkap dengan persentase keberhasilan.
  - ⚡ **Hari Paling Produktif (Peak Day)**: Analisis hari tersibuk dan paling produktif dalam seminggu.
  - 📅 **Bulan Rekor (Peak Month)**: Rekor bulan dengan penyelesaian tugas terbanyak.
- **Mini Weekly Activity Bar Chart**: Grafik batang interaktif 7 hari ke belakang dengan penanda khusus hari ini (*TODAY*).
- **🔥 Daily Streak**: Pelacak konsistensi penyelesaian tugas harian berturut-turut.
- **🎯 Skor Tepat Waktu**: Persentase tugas yang berhasil diselesaikan sebelum/pada tenggat waktu.

### 7. 👾 Estetika Retro Pixel-Art & Tipografi Crisp
- **Ikon Pixel SVG Kustom**: Ikon *pixel gear*, *pixel flame*, *pixel calendar*, *pixel check*, dan *pixel lightning* yang dibuat dengan koordinat tajam (`crispEdges`).
- **Pixel Operator Typography**: Nuansa visual unik, profesional, dan menyenangkan tanpa mengorbankan keterbacaan modern.

### 8. 📱 Desain Responsif Multi-Device
- **Laptop / Desktop (> 1024px)**: Tata letak penuh presisi dan lapang.
- **Tablet / iPad (≤ 1024px)**: Panel timeline harian berubah menjadi *slide-over drawer* dengan backdrop redup. Grid proyek dan statistik otomatis 2 kolom.
- **Smartphone (≤ 768px & ≤ 440px)**:
  - Sidebar desktop bertransformasi menjadi **Off-Canvas Drawer** dengan tombol hamburger (☰).
  - Tab navigasi atas dapat di-swipe secara horizontal (*touch scroll*).
  - Tabel tugas aman dari pemotongan teks menggunakan pembungkus scroll sentuh halus (`min-width: 560px`).
  - Mendukung unit `100dvh` agar tidak terpotong oleh browser address bar di iOS Safari & Android Chrome.

---

## 🏗️ Arsitektur & Tech Stack

```
+--------------------------------------------------------------+
|                    FRONTEND (Client-Side)                    |
|   HTML5 + Modern CSS3 + Vanilla JavaScript (ES6+ Modular)    |
|   - app.js       : Logika utama dashboard, auth, kalender    |
|   - analytics.js : Engine kalkulasi & visualisasi statistik  |
|   - settings.js  : Penanganan modal dialog pengaturan        |
|   - Google Identity Services (GIS SDK)                       |
+--------------------------------------------------------------+
                               │
                               │ HTTP / JSON (REST API + JWT Bearer)
                               ▼
+--------------------------------------------------------------+
|                     BACKEND (Server-Side)                    |
|   Python 3.10+ & Flask                                       |
|   - Flask-SQLAlchemy (ORM)                                   |
|   - Flask-CORS (Cross-Origin Resource Sharing)               |
|   - PyJWT (Token-based Authentication)                       |
|   - google-auth (Verifikasi Google OAuth 2.0)                |
|   - Blueprint Routes: auth, task, analytics, settings        |
+--------------------------------------------------------------+
                               │
                               │ SQL Queries / Connection Pool
                               ▼
+--------------------------------------------------------------+
|                     DATABASE (PostgreSQL)                    |
|   - Tabel `users` (Data akun pengguna lokal & Google)        |
|   - Tabel `tasks` (Data tugas dengan relasi user_id)         |
+--------------------------------------------------------------+
```

---

## 📁 Struktur Direktori Proyek

```bash
To-Do-List/
├── .gitignore                   # Aturan pengabaian berkas git (venv, .env, __pycache__)
├── README.md                    # Dokumentasi lengkap proyek
├── SDD.md                       # Software Design Document (spesifikasi teknis & arsitektur)
│
├── backend/                     # Server Flask REST API
│   ├── app.py                   # Entry point aplikasi Flask & registrasi blueprint
│   ├── config.py                # Konfigurasi aplikasi & database
│   ├── models.py                # Model database SQLAlchemy (User, Task)
│   ├── requirements.txt         # Daftar dependensi library Python
│   ├── .env.example             # Template konfigurasi environment variable
│   └── routes/                  # Modular route controllers (Blueprint)
│       ├── __init__.py
│       ├── auth_routes.py       # Endpoint login, register, Google OAuth
│       ├── task_routes.py       # Endpoint CRUD tugas to-do
│       ├── analytics_routes.py  # Endpoint agregasi data analitik statistik
│       └── settings_routes.py   # Endpoint preferensi & konfigurasi pengguna
│
└── frontend/                    # Antarmuka Pengguna (Web Client)
    ├── index.html               # Struktur HTML utama antarmuka
    ├── style.css                # Desain visual, animasi, dan media queries responsif
    ├── app.js                   # State manajemen, CRUD, kalender, timeline, dan catatan
    ├── analytics.js             # Modul kalkulasi statistik & render grafik batang
    ├── settings.js              # Modul kontrol modal dialog pengaturan
    └── assets/                  # Aset statis pendukung
        ├── images/              # Logo aplikasi dan ikon grafis
        └── pixel_operator/      # File font Retro Pixel Operator
```

---

## 🚀 Panduan Instalasi & Menjalankan Aplikasi

### 1. Prasyarat Sistem
- **Python** versi 3.10 atau yang lebih baru.
- **PostgreSQL** versi 14 atau yang lebih baru (pastikan service database aktif).
- **Web Browser** modern (Chrome, Edge, Firefox, Safari).
- Ekstensi **Live Server** di VS Code (atau Python HTTP server).

---

### 2. Setup Backend (Flask)

1. Buka terminal dan arahkan ke folder `backend`:
   ```bash
   cd backend
   ```

2. Buat dan aktifkan *Virtual Environment*:
   - **Windows (PowerShell)**:
     ```powershell
     python -m venv venv
     .\venv\Scripts\Activate.ps1
     ```
   - **Windows (Command Prompt)**:
     ```cmd
     python -m venv venv
     venv\Scripts\activate.bat
     ```
   - **macOS / Linux**:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. Pasang seluruh dependensi pustaka:
   ```bash
   pip install -r requirements.txt
   ```

4. Buat berkas konfigurasi `.env`:
   Salin dari berkas `.env.example`:
   ```bash
   cp .env.example .env
   # Atau di Windows: copy .env.example .env
   ```

5. Buka berkas `.env` dan sesuaikan kredensial database PostgreSQL Anda:
   ```env
   SECRET_KEY=kunci_rahasia_bebas_diisi_apa_saja_12345
   JWT_SECRET_KEY=kunci_rahasia_jwt_bebas_diisi_apa_saja_67890
   DATABASE_URL=postgresql://postgres:password_anda@localhost:5432/todolist_db
   GOOGLE_CLIENT_ID=client_id_google_anda_disini.apps.googleusercontent.com
   ```
   *(Pastikan database `todolist_db` sudah dibuat sebelumnya di pgAdmin / psql).*

6. Jalankan server Flask:
   ```bash
   python app.py
   ```
   Server REST API akan berjalan di: `http://127.0.0.1:5000`

---

### 3. Setup Frontend (Client)

1. Buka terminal baru dan arahkan ke folder `frontend`:
   ```bash
   cd frontend
   ```

2. Jalankan server lokal:
   - **Cara A (VS Code Live Server)**: Klik kanan pada file `index.html` lalu pilih **Open with Live Server**.
   - **Cara B (Python HTTP Server)**:
     ```bash
     python -m http.server 5500
     ```
3. Buka browser dan kunjungi:
   ```
   http://127.0.0.1:5500
   ```

---

## 📡 Ringkasan REST API Endpoints

| Metode | Endpoint | Deskripsi | Autentikasi |
| :---: | :--- | :--- | :---: |
| `POST` | `/api/auth/register` | Mendaftarkan akun lokal baru | Publik |
| `POST` | `/api/auth/login` | Masuk dengan email & password (mengembalikan JWT) | Publik |
| `POST` | `/api/auth/google` | Autentikasi via token Google OAuth 2.0 | Publik |
| `GET` | `/api/tasks` | Mengambil seluruh tugas milik pengguna aktif | Diperlukan (JWT) |
| `POST` | `/api/tasks` | Membuat tugas baru | Diperlukan (JWT) |
| `PUT` | `/api/tasks/<id>` | Memperbarui detail / status tugas | Diperlukan (JWT) |
| `DELETE` | `/api/tasks/<id>` | Menghapus tugas | Diperlukan (JWT) |
| `GET` | `/api/analytics/summary` | Mendapatkan agregasi metrik statistik produktivitas | Diperlukan (JWT) |
| `GET` | `/api/settings` | Mendapatkan konfigurasi preferensi pengguna | Diperlukan (JWT) |
| `PUT` | `/api/settings` | Memperbarui preferensi pengguna | Diperlukan (JWT) |

---

## 🛡️ Keamanan & Praktik Terbaik

- **Password Hashing**: Menggunakan algoritma hash adaptif satu arah (`bcrypt`/`werkzeug.security`).
- **Perlindungan CORS**: Mengatur izin akses lintas origin hanya untuk domain client yang sah.
- **Pencegahan XSS**: Menggunakan sanitasi teks (*HTML entity encoding*) sebelum rendering ke DOM.
- **Git Security**: Berkas sensitif seperti kredensial `.env`, virtual environment `venv/`, cache Python, dan database lokal secara ketat dikecualikan dari Git melalui `.gitignore`.

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah lisensi **MIT**. Silakan gunakan, pelajari, dan kembangkan sesuai kebutuhan Anda.

<div align="center">
Dibuat dengan ❤️ untuk meningkatkan produktivitas harian Anda.
</div>
