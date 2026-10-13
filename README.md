# Math Racer 3D Online (Vercel + Upstash Redis)

Balapan soal matematika 1 lawan 1 lewat **kode room 4 karakter**, dengan arsitektur yang sama seperti
War of Kingdoms: server kecil di Vercel yang menyimpan room di Upstash Redis, klien melakukan polling.
Tidak memakai WebRTC/PeerJS lagi, jadi tidak ada masalah NAT/firewall/TURN dan tetap jalan di WiFi
kantor, sekolah, maupun data seluler.

```
Browser A ─┐                                    ┌─ Upstash Redis (room, kursi, presence pemain)
           ├─ POST /api/room (sync ±350 ms) ─ Vercel Function ─┤
Browser B ─┘
```

- Pembuat room = **host**, yang memasukkan kode = **guest**. Host menentukan level dan memulai ronde.
- Satu request `sync` = kirim posisi/kecepatan sendiri + terima milik lawan (satu round-trip Redis).
- Saat balapan polling ±350 ms, di lobi ±900 ms, tab tersembunyi 3 detik. Posisi lawan dihaluskan
  (ekstrapolasi) di klien, jadi gerakannya tetap mulus.
- Pemain yang tidak sync 10 detik dianggap keluar. Menutup tab langsung membebaskan kursi.
- Room kedaluwarsa 6 jam setelah dibuat.

## Deploy ke Vercel

1. Taruh folder ini di repo GitHub, lalu **Add New → Project** di Vercel dan impor repo tersebut.
   Framework Preset: **Other**, kosongkan Build Command dan Output Directory (sudah diatur di `vercel.json`).
2. Di proyek Vercel buka **Storage** (atau **Marketplace**) → tambahkan **Upstash Redis** → hubungkan ke proyek.
   **Pilih region Singapore (ap-southeast-1)** supaya dekat dengan pemain di Indonesia.
   Integrasi mengisi otomatis `KV_REST_API_URL` + `KV_REST_API_TOKEN` (atau `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`).
3. **Redeploy** (Deployments → ⋯ → Redeploy). Variabel baru hanya berlaku untuk deployment baru.
4. Buka situs, pilih mobil, **Buat Room**, kirim kode ke lawan. Lawan membuka alamat yang sama, ketik kode, **Gabung**.

Jika Redis belum terhubung, room gagal dibuat dengan pesan: *"Database belum dikonfigurasi…"*.

`vercel.json` memasang function di region `sin1` (Singapura) agar latensi rendah. Bila Vercel menolak
pengaturan `regions` di paketmu, hapus baris itu; game tetap jalan, hanya sedikit lebih lambat.

## Cara main

**A/D** pindah jalur (atau tap jalur di HP), **W** gas, **S** rem/mundur. Masuk ke jalur dengan jawaban
benar untuk NITRO. Yang sampai finish duluan menang. Host menekan **Main lagi** untuk ronde berikutnya.

## Menjalankan lokal

```bash
node dev-server.js      # http://localhost:3000 (penyimpanan memori, hanya untuk pengembangan)
npm test                # 22 tes: API room + dua klien lewat transport
```

Buka dua jendela (satu biasa, satu samaran) untuk mencoba dua pemain.

## Biaya & batasan

- Perkiraan: 3 perintah Redis per sync, per pemain. Balapan ±90 detik ≈ 1.500 perintah, lobi ≈ 5 perintah/detik.
  Free tier Upstash cukup untuk ratusan balapan per bulan; cek batas paketmu.
- Tidak ada login: siapa pun yang tahu kode 4 karakter bisa bergabung bila kursi guest kosong.
  Untuk trafik publik besar, tambahkan pembatasan laju (mis. Vercel Firewall).
- Latensi lawan sekitar 0,3–0,6 detik; posisi lawan diinterpolasi. Hasil (waktu finish) dibandingkan di kedua sisi.
- Library three.js dimuat dari cdnjs. Mau mandiri penuh? Unduh ke `public/` dan ganti `<script src>`.
