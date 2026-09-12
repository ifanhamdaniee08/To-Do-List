# Software Design Document (SDD)
## Proyek: Fullstack To-Do List Web Application

---

## 1. Ringkasan & Tujuan Sistem (Overview & Objectives)

Dokumen ini mendefinisikan spesifikasi teknis dan perancangan arsitektur untuk aplikasi **To-Do List Web** dengan arsitektur decoupled (terpisah antara Frontend dan Backend).

### Fitur Utama:
1. **Autentikasi Hibrida (Hybrid Auth)**:
   - Registrasi & Login lokal menggunakan Email & Password (diamankan dengan hashing `bcrypt` / `werkzeug.security`).
   - Login sosial menggunakan **Google OAuth 2.0 (Google Identity Services)**.
2. **Isolasi Data Pengguna (Multi-user Data Isolation)**:
   - Setiap pengguna hanya memiliki akses ke daftar tugas (tasks) milik mereka sendiri.
3. **Manajemen Tugas (Task CRUD)**:
   - Menambah, membaca, memperbarui (status selesai/teks), dan menghapus tugas.
   - Filter tugas (Semua, Aktif, Selesai).
4. **Desain Terpisah (Decoupled)**:
   - Backend berupa REST API berbasis Flask.
   - Frontend web statis (HTML, CSS, JS) yang mengonsumsi API menggunakan Fetch API (AJAX).

---

## 2. Arsitektur Sistem & Tech Stack

```
+--------------------------------------------------------------+
|                    FRONTEND (Client-Side)                    |
|   HTML5 + CSS3 (Modern/Responsive) + Vanilla JavaScript (ES6)|
|   - Google Identity Services (GIS SDK)                       |
|   - Fetch API (dengan Authorization Header: Bearer <Token>)  |
+--------------------------------------------------------------+
                               │
                               │ HTTP / JSON (REST API + CORS)
                               ▼
+--------------------------------------------------------------+
|                     BACKEND (Server-Side)                    |
|   Python 3 + Flask                                           |
|   - Flask-CORS (Penanganan lintas domain)                    |
|   - PyJWT / Flask-JWT-Extended (Manajemen sesi token)        |
|   - google-auth (Verifikasi Google ID Token)                 |
|   - SQLAlchemy / Flask-SQLAlchemy (ORM)                      |
|   - Werkzeug / bcrypt (Password Hashing)                     |
+--------------------------------------------------------------+
                               │
                               │ SQL Queries / Connection Pool
                               ▼
+--------------------------------------------------------------+
|                     DATABASE (PostgreSQL)                    |
|   - Tabel `users` (Menampung akun lokal & Google)            |
|   - Tabel `tasks` (Foreign Key ke `users.id`)                |
+--------------------------------------------------------------+
```

### Rincian Teknologi:
- **Backend**: Python 3.10+, Flask, Flask-SQLAlchemy, Flask-CORS, PyJWT, `google-auth`.
- **Database**: PostgreSQL 14+.
- **Frontend**: Semantic HTML5, Modern CSS, Vanilla JavaScript ES6+.
- **Protokol Autentikasi**: JSON Web Token (JWT) & Google OAuth 2.0 ID Token.

---

## 3. Spesifikasi Autentikasi & Otorisasi

### 3.1. Alur Autentikasi Lokal (Email & Password)
1. **Registrasi**:
   - User memasukkan `full_name`, `email`, dan `password`.
   - Backend memvalidasi format email dan password.
   - Password di-hash menggunakan algoritma aman (`generate_password_hash`).
   - Data user disimpan ke tabel `users`.
2. **Login**:
   - User memasukkan `email` dan `password`.
   - Backend mencocokkan email dan memverifikasi hash password.
   - Jika valid, backend menerbitkan **Access Token (JWT)** yang berisi payload `user_id`.
   - Frontend menyimpan token di `localStorage`.

### 3.2. Alur Autentikasi Google (OAuth 2.0 / Google Identity Services)
Pendekatan yang digunakan adalah **Client-Side Token Exchange** (paling modern & direkomendasikan untuk Single Page / Decoupled App):

```
User -> Klik tombol "Sign in with Google" di Frontend
  └─> Pop-up / One Tap Google Identity Services muncul
  └─> User memilih akun Google miliknya
  └─> Google mengembalikan ID Token bertanda tangan (credential) ke Frontend
Frontend -> Mengirim ID Token ke Flask Backend via `POST /api/auth/google`
Backend -> Memverifikasi tanda tangan ID Token via library `google-auth`
  ├─> Jika Tidak Valid: Mengembalikan error 401 Unauthorized
  └─> Jika Valid: Ekstrak email, name, google_id (sub), picture
       ├─> Cek apakah email sudah ada di tabel `users`?
       ├─> JIKA BELUM ADA: Buat user baru (password_hash = NULL, google_id tersimpan)
       └─> JIKA SUDAH ADA: Update informasi / tautkan google_id
Backend -> Terbitkan JWT internal aplikasi (berisi user_id)
Frontend -> Simpan JWT di `localStorage`, beralih ke halaman To-Do List
```

---

## 4. Perancangan Skema Database (Database Schema)

### 4.1. Entity Relationship Diagram (ERD)

```
+--------------------+              +------------------------+
|       users        |              |         tasks          |
+--------------------+              +------------------------+
| id (PK, SERIAL)    | 1          N | id (PK, SERIAL)        |
| email (UNIQUE)     |--------------| user_id (FK -> users.id|
| password_hash      |              | title                  |
| full_name          |              | description            |
| google_id (UNIQUE) |              | is_completed (BOOLEAN) |
| avatar_url         |              | created_at (TIMESTAMP) |
| created_at         |              | updated_at (TIMESTAMP) |
+--------------------+              +------------------------+
```

### 4.2. Definisi Struktur Tabel

#### Tabel: `users`
| Kolom | Tipe Data | Constraint | Deskripsi |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER / SERIAL` | `PRIMARY KEY` | ID unik pengguna |
| `email` | `VARCHAR(255)` | `NOT NULL, UNIQUE` | Email pengguna |
| `password_hash` | `VARCHAR(255)` | `NULLABLE` | Hash password (NULL jika murni login Google) |
| `full_name` | `VARCHAR(150)` | `NOT NULL` | Nama lengkap pengguna |
| `google_id` | `VARCHAR(255)` | `NULLABLE, UNIQUE` | Sub / ID unik dari Google OAuth |
| `avatar_url` | `TEXT` | `NULLABLE` | URL foto profil dari Google / default |
| `created_at` | `TIMESTAMP` | `DEFAULT NOW()` | Waktu pendaftaran akun |

#### Tabel: `tasks`
| Kolom | Tipe Data | Constraint | Deskripsi |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER / SERIAL` | `PRIMARY KEY` | ID unik tugas |
| `user_id` | `INTEGER` | `NOT NULL, FK(users.id) ON DELETE CASCADE` | Relasi pemilik tugas |
| `title` | `VARCHAR(255)` | `NOT NULL` | Judul / nama kegiatan |
| `description` | `TEXT` | `NULLABLE` | Catatan atau rincian tugas |
| `is_completed` | `BOOLEAN` | `NOT NULL, DEFAULT FALSE` | Status pengerjaan tugas |
| `created_at` | `TIMESTAMP` | `DEFAULT NOW()` | Waktu pembuatan tugas |
| `updated_at` | `TIMESTAMP` | `DEFAULT NOW()` | Waktu pembaruan tugas terakhir |

---

## 5. Spesifikasi Antarmuka REST API

Semua request yang membutuhkan proteksi wajib menyertakan header:
`Authorization: Bearer <JWT_ACCESS_TOKEN>`

### 5.1. Authentication Endpoints

#### `POST /api/auth/register`
- **Tujuan**: Mendaftarkan akun lokal baru.
- **Request Body**:
  ```json
  {
    "full_name": "Budi Santoso",
    "email": "budi@example.com",
    "password": "Password123!"
  }
  ```
- **Response Success (201 Created)**:
  ```json
  {
    "message": "Registrasi berhasil.",
    "user": { "id": 1, "email": "budi@example.com", "full_name": "Budi Santoso" }
  }
  ```

#### `POST /api/auth/login`
- **Tujuan**: Login akun lokal dan mendapatkan JWT.
- **Request Body**:
  ```json
  {
    "email": "budi@example.com",
    "password": "Password123!"
  }
  ```
- **Response Success (200 OK)**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5c...",
    "user": { "id": 1, "email": "budi@example.com", "full_name": "Budi Santoso" }
  }
  ```

#### `POST /api/auth/google`
- **Tujuan**: Verifikasi ID Token dari Google Identity Services dan menghasilkan JWT aplikasi.
- **Request Body**:
  ```json
  {
    "credential": "<GOOGLE_ID_TOKEN_JWT>"
  }
  ```
- **Response Success (200 OK)**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5c...",
    "user": {
      "id": 2,
      "email": "user@gmail.com",
      "full_name": "User Google",
      "avatar_url": "https://lh3.googleusercontent.com/..."
    }
  }
  ```

#### `GET /api/auth/me`
- **Proteksi**: Butuh Token (`Bearer <Token>`).
- **Tujuan**: Mengambil info profil user yang sedang login saat halaman dimuat/refresh.
- **Response Success (200 OK)**:
  ```json
  {
    "id": 1,
    "email": "budi@example.com",
    "full_name": "Budi Santoso",
    "avatar_url": null
  }
  ```

---

### 5.2. Task Management Endpoints

Semua endpoint di bawah difilter otomatis berdasarkan `user_id` dari JWT token.

#### `GET /api/tasks`
- **Proteksi**: Butuh Token.
- **Query Params (Opsional)**: `?filter=all` / `?filter=active` / `?filter=completed`
- **Response Success (200 OK)**:
  ```json
  {
    "tasks": [
      {
        "id": 1,
        "title": "Membeli buku pemrograman",
        "description": "Buku Flask & PostgreSQL",
        "is_completed": false,
        "created_at": "2026-09-11T10:00:00Z",
        "updated_at": "2026-09-11T10:00:00Z"
      }
    ]
  }
  ```

#### `POST /api/tasks`
- **Proteksi**: Butuh Token.
- **Request Body**:
  ```json
  {
    "title": "Selesaikan tugas kalkulus",
    "description": "Halaman 20 nomor 1-5"
  }
  ```
- **Response Success (201 Created)**:
  ```json
  {
    "message": "Tugas berhasil dibuat",
    "task": {
      "id": 2,
      "title": "Selesaikan tugas kalkulus",
      "description": "Halaman 20 nomor 1-5",
      "is_completed": false,
      "created_at": "2026-09-11T10:05:00Z"
    }
  }
  ```

#### `PUT /api/tasks/<id>`
- **Proteksi**: Butuh Token.
- **Request Body**:
  ```json
  {
    "title": "Selesaikan tugas kalkulus (Revisi)",
    "description": "Halaman 20-22",
    "is_completed": true
  }
  ```
- **Response Success (200 OK)**:
  ```json
  {
    "message": "Tugas berhasil diperbarui",
    "task": {
      "id": 2,
      "title": "Selesaikan tugas kalkulus (Revisi)",
      "is_completed": true
    }
  }
  ```

#### `DELETE /api/tasks/<id>`
- **Proteksi**: Butuh Token.
- **Response Success (200 OK)**:
  ```json
  {
    "message": "Tugas berhasil dihapus"
  }
  ```

---

## 6. Spesifikasi Frontend & Antarmuka Pengguna

### 6.1. Struktur Layar / Antarmuka
Aplikasi frontend dirancang sebagai Single Page Experience sederhana:
1. **Layar Masuk / Autentikasi (`#auth-view`)**:
   - Tab beralih antara form "Masuk" (Login) dan form "Daftar" (Sign Up).
   - Form input: Nama (khusus register), Email, & Password.
   - Tombol pembagi pemisah: "ATAU".
   - Tombol resmi **Google Sign-In Button** (disediakan oleh Google Identity Services SDK).
2. **Layar Dashboard To-Do (`#app-view`)**:
   - Header: Salam pengguna, foto profil/avatar, dan tombol "Keluar" (Logout).
   - Form input cepat: Tambah tugas baru (Judul & Catatan opsional).
   - Filter bar: Semua (All), Belum Selesai (Active), Selesai (Completed).
   - List tugas: Checkbox toggle status selesai, judul tugas (tercoret jika selesai), dan tombol hapus tugas.
   - State interaktif: Loading spinner & empty state illustration ketika belum ada tugas.

---

## 7. Keamanan & Konfigurasi Lingkungan (.env)

File konfigurasi rahasia disimpan di `.env` (dalam folder `backend/`):
```ini
FLASK_APP=run.py
FLASK_ENV=development
SECRET_KEY=kunci_rahasia_untuk_sesi_anda
JWT_SECRET_KEY=kunci_rahasia_untuk_enkripsi_jwt
DATABASE_URL=postgresql://postgres:password_anda@localhost:5432/todolist_db
GOOGLE_CLIENT_ID=nomor-klien-anda.apps.googleusercontent.com
```

---

## 8. Rencana Implementasi Bertahap (Roadmap)

- [ ] **Fase 1: Persiapan Database & Google Cloud Console**
  - Pembuatan database `todolist_db` di PostgreSQL.
  - Penjelasan cara mendapatkan `GOOGLE_CLIENT_ID` di Google Cloud Console.
  - Setup virtual environment (`venv`) dan file `requirements.txt`.
- [ ] **Fase 2: Backend Autentikasi (Auth Service)**
  - Pembuatan Model `User` dan koneksi database via Flask-SQLAlchemy.
  - Implementasi register & login password (`generate_password_hash` + JWT).
  - Implementasi verifikasi Google ID Token endpoint (`/api/auth/google`).
- [ ] **Fase 3: Backend REST API Tugas (Task Service)**
  - Pembuatan Model `Task` berelasi dengan `User`.
  - Implementasi CRUD endpoint dengan filter otorisasi user (JWT decorator).
  - Pengujian manual endpoint API.
- [ ] **Fase 4: Frontend UI & Autentikasi**
  - Pembuatan struktur HTML & Styling CSS (layout login & dashboard).
  - Integrasi script Google Identity Services SDK di HTML.
  - Integrasi login/register lokal dan Google via JavaScript Fetch API.
- [ ] **Fase 5: Frontend Task Management & Integrasi Penuh**
  - Implementasi render daftar tugas, tambah tugas, centang selesai, dan hapus tugas.
  - Penanganan error, token expired, dan feedback visual bagi pengguna.
