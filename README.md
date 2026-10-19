# Math Racer Online (Vercel + Upstash Redis)

Balapan soal matematika 1 lawan 1 yang dikelola **Room Master** lewat **kode lobby 4 karakter**, dengan arsitektur yang sama seperti
War of Kingdoms: server kecil di Vercel yang menyimpan room di Upstash Redis, klien melakukan polling.
Tidak memakai WebRTC/PeerJS lagi, jadi tidak ada masalah NAT/firewall/TURN dan tetap jalan di WiFi
kantor, sekolah, maupun data seluler.

```
Pemain 1 ─┐
          ├─ POST /api/room (sync ±1 dtk) ─ Vercel Function ─ Upstash Redis (room, kursi, presence)
Pemain 2 ─┤
Room Master ┘
```

- **Room Master membuat lobby.** Di menu tekan **🎛 Buat Lobby (Room Master)** → muncul kode 4 karakter. Dua pemain membuka
  game yang sama, memilih mobil, memasukkan kode, lalu **Gabung (Pemain)**. Pemain pertama yang masuk menjadi **Pemain 1**,
  berikutnya **Pemain 2**; orang ketiga ditolak (lobby penuh). Room Master memilih **level**, menekan **▶ Mulai Balapan**
  (aktif setelah kedua pemain siap) dan **▶ Main lagi** untuk ronde berikutnya. Master tidak ikut bermain.
- Sinyal Mulai = presence Room Master (`round`, `seed`, `lvl`). Kedua pemain membangkitkan soal dari seed yang sama,
  lalu hitung mundur 3‑2‑1 sendiri-sendiri. Pemain yang masuk di tengah ronde menunggu ronde berikutnya.
- Layar Room Master terbagi dua (Pemain 1 = cyan, Pemain 2 = oranye): jalan, mobil, soal yang sedang dikerjakan, skor, kecepatan,
  dan banner pemenang. Pemain mengirim posisi/kecepatan/jalur selama master hadir; sync dipercepat (±350 ms) hanya saat balapan.
  Pemain yang keluar di tengah balapan membuat lawannya menang otomatis dan master bisa memulai ronde baru.
- Room Master keluar (**Tutup Lobby**) = lobby ditutup untuk semua. Pemain keluar = kursinya kosong dan bisa diisi pemain lain.
- Mobil lawan **tidak terlihat** dan posisinya tidak memengaruhi balapan. Yang menentukan hasil hanya skor akhir (dikirim sebagai angka final).
- Pemain yang tidak sync 10 detik dianggap keluar. Menutup tab langsung membebaskan kursi.
- Room kedaluwarsa 6 jam setelah dibuat.

## Deploy ke Vercel

1. Taruh folder ini di repo GitHub, lalu **Add New → Project** di Vercel dan impor repo tersebut.
   Framework Preset: **Other**, kosongkan Build Command dan Output Directory (sudah diatur di `vercel.json`).
2. Di proyek Vercel buka **Storage** (atau **Marketplace**) → tambahkan **Upstash Redis** → hubungkan ke proyek.
   **Pilih region Singapore (ap-southeast-1)** supaya dekat dengan pemain di Indonesia.
   Integrasi mengisi otomatis `KV_REST_API_URL` + `KV_REST_API_TOKEN` (atau `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`).
3. **Redeploy** (Deployments → ⋯ → Redeploy). Variabel baru hanya berlaku untuk deployment baru.
4. Room Master membuka situs → **Buat Lobby**, lalu mengirim kode ke dua pemain. Pemain membuka alamat yang sama, memilih mobil, ketik kode, **Gabung (Pemain)**. Room Master menekan **Mulai Balapan**.

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
angka final (skor, jumlah benar, penanda finish), jadi jeda jaringan tidak bisa memengaruhi hasil.

| Kejadian | Poin |
|---|---|
| Jawaban benar | **+100** |
| Jawaban salah | **−50** |

- **Pemenang = skor tertinggi**, dihitung murni dari jawaban benar dan salah. **Waktu/durasi tidak memengaruhi hasil** (tidak ada bonus cepat, dan waktu finish tidak dipakai sebagai penentu seri).
- Skor sama (berarti jumlah benar sama) = **SERI**.
- Pemain teliti tapi lambat (10/10 benar) tetap mengalahkan pemain cepat yang banyak salah.
- Asal tebak tidak menguntungkan: peluang benar 1 dari 3, +100 × 1/3 melawan −50 × 2/3 hampir impas.
- Setelah kamu finish, mobil berhenti dan muncul layar tunggu sampai lawan juga finish. Lawan finish duluan tidak memotong balapanmu.
- Lawan keluar saat balapan: kamu menang otomatis. Lawan tidak finish dalam 90 detik setelah kamu: hasil dihitung dari skor yang sudah masuk.
- Angka aturan ada di bagian atas script `public/index.html`: `PTS_OK`, `PTS_BAD`.

## Cara main

Mobil **jalan sendiri** (gas otomatis). **A/D** atau **←/→** pindah jalur, **S** rem.
**W** (atau **↑**) **ditahan = ngebut** (sampai ±288 km/jam); **dilepas = kembali ke kecepatan normal** (230 km/jam).
Di HP/Android ada tombol **◀ ▲ ▶** di layar: **▲ ditahan = ngebut**, dilepas = normal (atau tap jalur untuk pindah).
Tombol **⛶** membuka layar penuh. Masuk ke jalur dengan jawaban benar untuk NITRO (nitro tetap lebih cepat dari ngebut).
Ngebut tidak mengubah skor: pemenang tetap ditentukan skor, dan ngebut berarti waktu berpikir lebih singkat.
Konstanta `VBOOST` ada di bagian atas script `public/index.html`.

## Menjalankan lokal

```bash
node dev-server.js      # http://localhost:3000 (penyimpanan memori, hanya untuk pengembangan)
npm test                # tes API lobby (master + 2 pemain) + transport, tes render 2D, boost W/▲, dan alur Room Master
```

Buka dua jendela (satu biasa, satu samaran) untuk mencoba dua pemain.

## Biaya & batasan

- Perkiraan: 4 perintah Redis per sync pemain (3 + cek kehadiran master); master ±4 per sync (±1 sync/detik) per pemain, jadi ±200 perintah per menit per pemain. Balapan 2 menit kira-kira 800 perintah untuk dua pemain.
  Free tier Upstash cukup untuk ratusan balapan per bulan; cek batas paketmu.
- Tidak ada login: siapa pun yang tahu kode 4 karakter bisa bergabung selama masih ada kursi pemain kosong.
  Untuk trafik publik besar, tambahkan pembatasan laju (mis. Vercel Firewall).
- Hasil dihitung di kedua sisi dengan rumus yang sama dari data final masing-masing pemain, sehingga keduanya melihat pemenang yang sama.
- Tanpa library eksternal: tampilan memakai Canvas 2D bawaan browser, jadi tidak ada unduhan three.js.
