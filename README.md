# Math Racer Online (Vercel + Upstash Redis)

Balapan soal matematika 1 lawan 1 lewat **kode room 4 karakter**, dengan arsitektur yang sama seperti
War of Kingdoms: server kecil di Vercel yang menyimpan room di Upstash Redis, klien melakukan polling.
Tidak memakai WebRTC/PeerJS lagi, jadi tidak ada masalah NAT/firewall/TURN dan tetap jalan di WiFi
kantor, sekolah, maupun data seluler.

```
Browser A ─┐                                    ┌─ Upstash Redis (room, kursi, presence pemain)
           ├─ POST /api/room (sync ±1 dtk) ─ Vercel Function ─┤
Browser B ─┘
```

- Pembuat room = **host**, yang memasukkan kode = **guest**. Host menentukan level dan memulai ronde.
- Satu request `sync` = kirim posisi/kecepatan sendiri + terima milik lawan (satu round-trip Redis).
- Mobil lawan **tidak terlihat** dan posisi tidak dikirim, jadi jeda jaringan tidak memengaruhi balapan.
  Yang dikirim hanya jumlah soal yang sudah dijawab, skor, jumlah benar, dan waktu finish. Polling ±900 ms
  (±350 ms sebentar saat menunggu lawan di lobi), tab tersembunyi 3 detik.
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

## Tampilan 2D (ringan)

Game dilihat dari atas dengan Canvas 2D: jalan 3 jalur yang bergulir, gerbang jawaban di tiap jalur,
mobil (Lamborghini / Porsche / Ferrari) dengan api nitro dan lampu rem. Tidak butuh WebGL maupun
three.js (±600 KB lebih kecil), jadi jalan mulus di HP lama dan laptop tanpa GPU. Resolusi canvas dibatasi
1,5x dan teks HUD hanya diperbarui saat nilainya berubah. Di HP layar dibuat tegak (portrait).

## Fisika balapan

- Kecepatan maksimum 230 km/jam, nitro sampai 345 km/jam. Tenaga mesin menurun mendekati batas, rem kuat, dan melepas gas membuat mobil melambat bertahap.
- Jawaban benar memberi **nitro 2,4 detik** (dorongan otomatis); jawaban salah memotong kecepatan sampai 36 km/jam.
- Jarak antar gerbang 700 m (10 gerbang, finish di 7.200 m). Balapan sempurna sekitar 100 detik.
- Pratinjau jawaban gerbang berikutnya selalu tampil di atas jalan, sehingga cukup waktu menghitung walau mobil ngebut.
- Konstanta ada di bagian atas script `public/index.html`: `GAP`, `VMAX`, `VNIT`.

## Aturan pemenang (adil, bebas jeda jaringan)

Kedua pemain menjawab **soal yang sama** dan balapan sendiri-sendiri (mobil lawan tidak terlihat).
Skor dihitung **lokal di perangkat masing-masing** dengan jam sendiri. Yang dikirim ke lawan hanya
angka final (skor, jumlah benar, waktu finish), jadi jeda jaringan tidak bisa memengaruhi hasil.

| Kejadian | Poin |
|---|---|
| Jawaban benar | **+100** |
| Bonus cepat (hanya jika benar) | **+0 sampai +60**, penuh bila waktu antar gerbang ≤ 9 detik, nol bila ≥ 30 detik |
| Jawaban salah | **−50** |

- **Pemenang = skor tertinggi.** Seri skor: jawaban benar terbanyak, lalu waktu finish tercepat; selisih di bawah 0,05 detik dianggap seri.
- Pemain teliti tapi lambat (10/10 benar) tetap mengalahkan penebak cepat. Penebak cepat dengan 8 benar & 2 salah bisa mengalahkan pemain teliti yang sangat lambat.
- Asal tebak tidak menguntungkan: peluang benar 1 dari 3, +100 × 1/3 melawan −50 × 2/3 hampir impas.
- Setelah kamu finish, mobil berhenti dan muncul layar tunggu sampai lawan juga finish. Lawan finish duluan tidak memotong balapanmu.
- Lawan keluar saat balapan: kamu menang otomatis. Lawan tidak finish dalam 90 detik setelah kamu: hasil dihitung dari skor yang sudah masuk.
- Angka aturan ada di bagian atas script `public/index.html`: `PTS_OK`, `PTS_BAD`, `SPD_BONUS`, `FAST_T`, `SLOW_T`.

## Cara main

**A/D** pindah jalur (atau tap jalur di HP), **W** gas, **S** rem/mundur. Masuk ke jalur dengan jawaban
benar untuk NITRO. Yang sampai finish duluan menang. Host menekan **Main lagi** untuk ronde berikutnya.

## Menjalankan lokal

```bash
node dev-server.js      # http://localhost:3000 (penyimpanan memori, hanya untuk pengembangan)
npm test                # 22 tes API room + transport, plus tes render 2D (DOM/canvas tiruan)
```

Buka dua jendela (satu biasa, satu samaran) untuk mencoba dua pemain.

## Biaya & batasan

- Perkiraan: 3 perintah Redis per sync (±1 sync/detik) per pemain, jadi ±200 perintah per menit per pemain. Balapan 2 menit kira-kira 800 perintah untuk dua pemain.
  Free tier Upstash cukup untuk ratusan balapan per bulan; cek batas paketmu.
- Tidak ada login: siapa pun yang tahu kode 4 karakter bisa bergabung bila kursi guest kosong.
  Untuk trafik publik besar, tambahkan pembatasan laju (mis. Vercel Firewall).
- Hasil dihitung di kedua sisi dengan rumus yang sama dari data final masing-masing pemain, sehingga keduanya melihat pemenang yang sama.
- Tanpa library eksternal: tampilan memakai Canvas 2D bawaan browser, jadi tidak ada unduhan three.js.
