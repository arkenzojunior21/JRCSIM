# JRCSIM — Simulator Latihan Aquaduct Romana

Simulator 3D untuk latihan mandiri nomor **Aquaduct Romana** (Java Robot Contest XIV, kategori SMA).
Anda mengendalikan **Transporter** secara manual sementara **Line Follower** berjalan otomatis,
sehingga urutan misi, ritme waktu, dan koordinasi kedua robot bisa dilatih tanpa memasang trek fisik.

Spesifikasi produk dan aturan resmi yang dipakai ada di [PRD.MD](PRD.MD).

## Kebutuhan

- Windows 10/11 (diuji), Linux/macOS juga bisa.
- Node.js 22 atau lebih baru.
- Chrome/Edge terbaru (dukungan Gamepad API paling lengkap).
- Gamepad PS3/PS4 opsional; keyboard selalu tersedia.

## Menjalankan

```bash
cd "C:/Users/Junior Arkenzo/Documents/GitHub/JRCSIM"
export PATH="$PWD/tools/node-runtime:$PATH"
npm install
npm run assets     # sekali saja: ekstrak aset panitia lalu bangun tekstur trek
npm run assets:robots   # sekali saja: konversi CAD robot di folder "3d file" menjadi GLB
npm run dev
```

Buka `http://127.0.0.1:5173/`. Jika `npm run assets` dilewati, aplikasi tetap jalan tetapi lantai
memakai warna polos dan status bar mengingatkan untuk menjalankan skrip tersebut.

Build statis dan uji offline:

```bash
npm run build
npm run preview   # http://127.0.0.1:4173/
```

Setelah build, service worker (`public/sw.js`) menyimpan aset di cache sehingga halaman tetap
terbuka saat jaringan dimatikan.

## Mode permainan

- **Free Test** — tanpa timer dan skor akhir. Cocok untuk mencoba kontrol, kamera, dan gripper.
  Tekan **Mulai** lalu **Reset** kapan saja.
- **Penyisihan** — hitung mundur 3 detik, timer 240 detik, skor maksimal 130
  (LEX 2×15, LATERES 4×15, finish 10, Transfer Zone 6×5). Retry menambah penalti 5 detik.

Alur misi: buka **CATARACTA 1** → pindahkan 2 LEX dari Area A ke Transfer Zone → LF mengantar ke
Drop LEX di Area B; LF mengambil LATERES Area B/C ke Transfer Zone lalu Transporter membawanya ke
Drop LATERES di Area A; buka **CATARACTA 2** → kedua robot masuk Finish Zone.

## Kontrol bawaan

| Aksi | Keyboard | Gamepad (PS4 standar) |
|---|---|---|
| Maju / mundur | W / Up, S / Down | Stick kiri sumbu Y (1) |
| Belok kiri / kanan | A / Left, D / Right | Stick kiri sumbu X (0) |
| Geser kiri / kanan (mecanum) | Q / E | Stick kanan sumbu X (2) |
| Track kiri / kanan (mode tank) | — | Stick kiri / kanan sumbu Y (1 / 3) |
| Capit | Space | L1 (tombol 4) |
| Angkat lengan | F | R1 (5) |
| Turunkan lengan | C | L2 (6) |
| Line Follower mulai/jeda | L | R2 (7) |
| LF lebih cepat / lambat | ] / [ | D-pad atas / bawah (12 / 13) |
| Reset Transporter ke start | R | Share (8) |
| Retry sesi | T | L3 (10) |
| Jeda simulasi | P | Options (9) |
| Kunci/buka kamera | K | R3 (11) |

Semua tombol dan sumbu bisa diubah di **Pengaturan → Kontrol**: rekam input baru, atur deadzone,
sensitivitas, kurva, invert per sumbu, tukar stick, ekspor/impor profil JSON, dan reset ke default.
Pengaturan tersimpan di `localStorage` per `gamepad.id`. Keyboard memakai mekanisme yang sama.

## Alat bantu

- `http://127.0.0.1:5173/tools/gamepad-check.html` — lihat nama controller, nilai sumbu mentah,
  dan status tombol sebelum melakukan remap.
- `http://127.0.0.1:5173/tools/calibrate.html` — tandai kotak arena dan zona pada denah
  `tools/track-preview.jpg`, lalu salin hasil JSON/TS ke `src/sim/trackLayout.ts`.

## Pengujian

```bash
npm test          # unit test simulasi, skor, input, gate, gripper
npm run typecheck
npm run build
```

## Struktur singkat

```
src/sim/          konstanta, robot, drive mode, objek, gripper, gate, LF agent,
                  misi, skor, tabrakan, world (loop simulasi)
src/render/       arena, kamera isometrik, robot, objek & gate (worldView)
src/input/        binding, profil, gamepad, keyboard, remap
src/ui/           HUD, panel pengaturan
src/state/        penyimpanan kamera, profil, skor terbaik
tests/            unit test
tools/            halaman bantu gamepad & kalibrasi
```

## Model robot dari CAD

Model robot diambil dari folder `3d file/`: Transporter dari
`REVISI ROBOT TEAM 1 v15.step` (OpenCascade) dan Line Follower dari tujuh part STL. Jalankan
`npm run assets:robots`; skrip menghasilkan `public/assets/models/transporter.glb` dan
`line-follower.glb` dalam skala milimeter asli (transporter ±27,6 cm, LF ±19,1 cm). Jika CAD
diperbarui, jalankan ulang perintah itu. Tanpa kedua GLB tersebut, simulator memakai model
prosedural sederhana.

## Memakai model trek resmi (opsional)

`Track SMA.skp` adalah format tertutup SketchUp (26.1.189) dan tidak bisa dibaca browser.
Ekspor dulu dari SketchUp: **File → Export → 3D Model**, format **glTF Binary (.glb)**, simpan ke
`public/assets/track/track.glb`. Saat halaman dimuat, simulator mendeteksi file itu, menampilkan
mesh asli, menyembunyikan arena prosedural, lalu menyesuaikan skala ke 6 m. Jika tidak ada, arena
prosedural tetap dipakai. Bila orientasi model terbalik, ubah `TRACK_MODEL_YAW` (0/90/180/270) di
`src/render/trackModel.ts`.

## Catatan kalibrasi

Koordinat zona di `src/sim/trackLayout.ts` masih perkiraan dari denah resmi (ditandai
`TODO_CALIBRATE`). Setelah menandai arena dan zona lewat `tools/calibrate.html`, ganti nilai
`ZONES`, `SPAWNS`, dan `GATE_PLACES` lalu jalankan ulang `npm test` dan `npm run build`.

## Di luar cakupan MVP

Babak battle/AQVAE, lawan AI, remote robot fisik, multiplayer, kontrol sentuh, dan fisika
rigid-body penuh belum termasuk.
