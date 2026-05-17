# Smart Jemuran IoT System

Sistem jemuran pintar berbasis Internet of Things (IoT) yang dapat memonitor cuaca, mendeteksi pergerakan (sistem keamanan), dan mengontrol posisi jemuran secara otomatis maupun manual melalui aplikasi web/mobile

## Alur Komunikasi MQTT (Data Flow)

```mermaid
sequenceDiagram
    autonumber

    participant ESP32 as ESP32 Hardware
    participant Broker as HiveMQ Broker
    participant Backend as Node.js Backend
    participant DB as PostgreSQL
    participant App as Frontend App

    rect rgb(230, 245, 255)
        Note over ESP32,App: Alur 1 - Pembacaan Sensor (Tiap 3 Detik)

        ESP32->>Broker: Publish JSON ke 'jemuran/sensor'
        Broker->>Backend: Forward message
        Backend->>Backend: Evaluasi status (Cuaca/Keamanan)
        Backend->>DB: Insert ke tabel SensorLog
        Backend-->>App: Emit Socket.io ('sensorUpdate')
    end

    rect rgb(230, 255, 240)
        Note over App,ESP32: Alur 2 - Kontrol Pengguna

        App->>Backend: POST /api/device/:id/control
        Backend->>DB: Update posisiJemuran
        Backend->>Broker: Publish ke 'jemuran/control/{SN}'
        Broker->>ESP32: Forward command
        ESP32->>ESP32: Gerakkan servo
        ESP32->>ESP32: Update LCD
    end
```

## Tech Stack

- Backend: Node.js, Express.js, Socket.io (Real-time)
- Database & ORM: PostgreSQL, Prisma ORM
- Validation & Testing: Zod, Vitest
- Cloud Storage: Supabase (Avatar Storage)
- IoT Protocol: MQTT (HiveMQ Cloud)
- Hardware: ESP32-S3, Servo Motor, Sensor Hujan, Sensor LDR (Cahaya), Sensor PIR (Gerak), Buzzer, LCD I2C 16x2.

## Arsitektur & Koneksi MQTT

Sistem menggunakan arsitektur Publish-Subscribe dengan dua jalur topik utama:

## 1. Jalur Sensor (ESP32 ➔ Backend)

Perangkat ESP32 membaca data lingkungan setiap 3 detik dan memublikasikannya ke broker MQTT. Backend Node.js subscribe (mendengarkan) topik ini untuk menyimpan log ke database dan meneruskan data secara real-time ke Frontend via Socket.io.

### Topik MQTT

```txt
jemuran/sensor
```

### Format Payload (JSON)

```json
{
  "deviceId": "SN-1010",
  "cuaca": "Cerah",
  "keamanan": "Aman",
  "hujanADC": 4095,
  "ldrADC": 0,
  "pirStatus": 0,
  "posisiJemuran": "KELUAR",
  "isAutoMode": true
}
```

### Logika Backend

Jika backend mendeteksi perubahan status, misalnya:

- Cuaca berubah dari `"Cerah"` menjadi `"Hujan"`
- Ada deteksi pergerakan dari sensor PIR

Maka backend akan otomatis:

- Membuat notification
- Menyimpan data ke tabel `SensorLog`

## 2. Jalur Kontrol (Backend ➜ ESP32)

Saat pengguna menekan tombol di aplikasi frontend, backend akan menerima request HTTP API lalu mempublikasikan perintah kontrol ke broker MQTT berdasarkan `device ID`.

ESP32 melakukan subscribe ke topik miliknya sendiri untuk mengeksekusi perintah.

### Topik MQTT

```txt
jemuran/control/{serialNumber}
```

Contoh:

```txt
jemuran/control/SN-1010
```

### Format Payload (JSON)

```json
{
  "action": "MASUK"
}
```

### Daftar Action Valid

| Action      | Deskripsi                   |
| ----------- | --------------------------- |
| `MASUK`     | Menggerakkan jemuran masuk  |
| `KELUAR`    | Menggerakkan jemuran keluar |
| `AUTO_ON`   | Mengaktifkan mode otomatis  |
| `AUTO_OFF`  | Menonaktifkan mode otomatis |
| `NIGHT_ON`  | Mengaktifkan mode malam     |
| `NIGHT_OFF` | Menonaktifkan mode malam    |

---

# Kebijakan Retensi Data & Optimasi (Cron Job)

Untuk menjaga performa database agar tetap optimal dan menghindari **database bloating** akibat arus data sensor IoT yang terus berjalan secara realtime, sistem ini menerapkan dua lapis optimasi data.

## 1. API Limit / Pagination

Endpoint log sensor dan notifikasi dikonfigurasi untuk hanya mengembalikan:

```txt
20 data terbaru
```

Tujuan optimasi ini:

- Mempercepat response API
- Mengurangi beban query database
- Menjaga performa frontend tetap ringan
- Mengurangi penggunaan bandwidth

### Endpoint yang Dioptimasi

| Endpoint                              | Limit           |
| ------------------------------------- | --------------- |
| `/api/device/:deviceId/logs`          | 20 data terbaru |
| `/api/device/:deviceId/notifications` | 20 data terbaru |

## 2. Automated Database Cleanup (Cron Job)

Sistem memiliki background task berupa **Cron Job** yang berjalan otomatis setiap hari pada pukul:

```txt
0 0 * * *
```

**(SETIAP TENGAH MALAM)** -> Cron Job ini bertugas melakukan pembersihan data lama secara otomatis.

### Data yang Dibersihkan

- `SensorLog`
- `Notification`

### Aturan Retensi Data

Data yang berumur lebih dari:

```txt
7 hari
```

akan dihapus permanen dari database.

# API Collection (REST API)

Semua endpoint menggunakan format response standar:

```json
{
  "success": true,
  "message": "Pesan deskriptif",
  "data": {}
}
```

Jika gagal:

```json
{
  "success": false,
  "message": "Terjadi kesalahan",
  "error": {}
}
```

---

# Otentikasi (`/api/auth`)

| Method | Endpoint            | Deskripsi              | Headers      | Payload                    |
| ------ | ------------------- | ---------------------- | ------------ | -------------------------- |
| POST   | `/register`         | Registrasi akun baru   | -            | `name, email, password`    |
| POST   | `/login`            | Login akun             | -            | `email, password`          |
| GET    | `/profile`          | Mengambil data profil  | Bearer Token | -                          |
| PUT    | `/profile`          | Mengubah nama pengguna | Bearer Token | `name`                     |
| PUT    | `/profile/password` | Mengubah password      | Bearer Token | `oldPassword, newPassword` |
| POST   | `/profile/avatar`   | Upload/update avatar   | Bearer Token | `form-data: avatar`        |

---

# Manajemen Alat (`/api/device`)

> Semua endpoint device membutuhkan authorization Bearer Token.

| Method | Endpoint                 | Deskripsi                        | Payload                            |
| ------ | ------------------------ | -------------------------------- | ---------------------------------- |
| GET    | `/`                      | Mendapatkan daftar alat user     | -                                  |
| POST   | `/claim`                 | Klaim/registrasi alat baru       | `serialNumber, name, locationCity` |
| GET    | `/:deviceId/logs`        | Mengambil 20 log sensor terakhir | -                                  |
| DELETE | `/:deviceId/logs/:logId` | Menghapus log tertentu           | -                                  |
| GET    | `/:deviceId/weather`     | Mengambil data cuaca realtime    | -                                  |

---

# Notifikasi (`/api/device`)

| Method | Endpoint                                 | Deskripsi                      |
| ------ | ---------------------------------------- | ------------------------------ |
| GET    | `/:deviceId/notifications`               | Mengambil daftar notifikasi    |
| PUT    | `/:deviceId/notifications/read`          | Tandai semua notifikasi dibaca |
| PUT    | `/:deviceId/notifications/:notifId/read` | Tandai satu notifikasi dibaca  |

---

# Kontrol Perangkat (`/api/device`)

| Method | Endpoint               | Deskripsi                           | Payload            |
| ------ | ---------------------- | ----------------------------------- | ------------------ |
| POST   | `/:deviceId/control`   | Mengirim command MQTT               | `command`          |
| PUT    | `/:deviceId/nightmode` | Mengaktifkan/nonaktifkan mode malam | `nightModeEnabled` |

### Command yang Didukung

```txt
MASUK
KELUAR
AUTO_ON
AUTO_OFF
```

# Instalasi & Cara Menjalankan

## 1. Clone Repository

```bash
git clone https://github.com/asepjamaludinn/jsystem.git
cd jsystem/backend
```

## 2. Install Dependencies

```bash
npm install
```

## 3. Konfigurasi Environment

Buat file `.env` pada root project:

```env
PORT=5000

DATABASE_URL="postgresql://user:pass@host:port/db?schema=public"
DIRECT_URL="postgresql://user:pass@host:port/db?schema=public"

JWT_SECRET="rahasia_super_aman"

SUPABASE_URL="https://[PROJECT-ID].supabase.co"
SUPABASE_KEY="anon_key_anda"

OPENWEATHER_API_KEY="api_key_openweather_anda"

MQTT_BROKER_URL="mqtts://[ID].s1.eu.hivemq.cloud:8883"
MQTT_USERNAME="jemuran_miot"
MQTT_PASSWORD="Jemuran123!"
```

## 4. Migrasi Database

```bash
npx prisma migrate dev
```

## 5. Jalankan Development Server

```bash
npm run dev
```

## 6. Jalankan Unit Test

```bash
npm run test
```

# Fitur Utama

- Monitoring Cuaca Real-time terintegrasi dengan API OpenWeather.
- Sistem Keamanan Pintar (Night Mode) berbasis PIR sensor
- Kontrol Fleksibel (Otomatis berdasarkan sensor atau Manual via web/mobile)
- Komunikasi Dua Arah Cepat dengan protokol MQTT & Socket.io
- Anti-Bloat Database dengan Node-cron auto-cleanup 7 hari.
- Notification system
- Clean Architecture & Validasi Solid menggunakan Zod dan penanganan Error terpusat
- Cloud Storage Integration (Supabase) untuk foto profil pengguna

---
