# PRD — Simulator Latihan Aquaduct Romana

| Field | Nilai |
|---|---|
| Produk | JRCSIM — Simulator Latihan Aquaduct Romana |
| Kompetisi | Java Robot Contest XIV, kategori SMA |
| Versi dokumen | 1.0 |
| Tanggal | 14 November 2026 |
| Status | Draft untuk review |
| Pemilik | Tim Aquaduct Romana |
| Platform | Web 3D, Chrome/Edge desktop, dapat berjalan offline |
| Dokumen terkait | `GUIDEBOOK_AQUADUCT ROMANA _SMA.pdf`, `Track and Regulation/` |

## 1. Ringkasan

JRCSIM adalah simulator latihan berbasis browser yang merekonstruksi arena **Aquaduct Romana** dalam bentuk 3D. Pengguna mengendalikan **Robot Transporter** menggunakan gamepad PS3/PS4, sementara **Robot Line Follower Transporter** bergerak otomatis mengikuti jalur dengan kecepatan yang dapat disetel. Simulator menyediakan mode **Free Test** untuk eksplorasi bebas dan mode **Penyisihan** dengan waktu 240 detik, skor resmi, serta penalti.

Tujuan produk bukan menggantikan robot fisik, melainkan mempercepat pengenalan trek, urutan misi, ritme waktu, dan koordinasi antara operator Transporter dan Line Follower sebelum latihan di arena asli.

**Definisi sukses:** satu tim dapat menyelesaikan sesi Penyisihan dengan skor minimal 100 dalam tiga percobaan berturut-turut, memahami urutan misi tanpa dibimbing, dan mengenali posisi seluruh zona serta gate pada trek.

## 2. Latar Belakang

### 2.1 Kompetisi

Java Robot Contest XIV diselenggarakan oleh Himpunan Mahasiswa Teknik Elektronika PENS dengan tema *The Gladiator at Ancient Roman Times*. Nomor lomba **Aquaduct Romana** untuk kategori SMA/SMK/MA menuntut kerja sama dua robot:

- **Robot Transporter** — dikendalikan operator melalui joystick wireless. Bertugas membuka jalur, mengambil dan memindahkan objek, membuka gate CATARACTA, serta menyambungkan tanjakan.
- **Robot Line Follower Transporter** — berjalan otomatis mengikuti garis. Bertugas membawa dan menyerahkan objek di titik-titik yang ditentukan.

Arena berukuran 4 m × 6 m, terbagi menjadi Area A (Transporter), Area B (Line Follower), dan Area C (bersama). Pertandingan berlangsung 240 detik.

### 2.2 Jadwal kompetisi

| Tanggal | Agenda |
|---|---|
| 12 Desember 2026 | Technical Meeting |
| 18 Desember 2026 | Open Track dan Opening Ceremony |
| 19–20 Desember 2026 | Competition |
| 20 Desember 2026 | Awarding |

Jika simulator ditujukan untuk edisi ini, versi minimum harus siap sebelum **12 Desember 2026**. Rencana jalur cepat 4 minggu tersedia di Bagian 12.

### 2.3 Masalah

Latihan di trek fisik terbatas oleh waktu pemasangan, ketersediaan arena, dan jumlah pengulangan. Operator juga sulit melatih sinkronisasi tempo dengan Line Follower karena setiap percobaan membutuhkan persiapan ulang. Akibatnya, kesalahan urutan misi dan kehabisan waktu baru terlihat saat pertandingan.

Simulator memberi pengulangan tanpa batas, mencatat skor dan waktu, serta memungkinkan pengaturan ulang dalam hitungan detik.

## 3. Pengguna dan Kebutuhan

| Pengguna | Kebutuhan utama | Rasa sakit yang diselesaikan |
|---|---|---|
| Operator Transporter | Mengemudi, membuka gate, mengambil dan menaruh objek dengan kontrol yang sudah disesuaikan | Tidak perlu memasang trek untuk latihan rute dan kontrol |
| Operator Line Follower | Menguji tempo dan urutan penyerahan objek | Bisa mengatur kecepatan LF dan melihat dampaknya pada sesi |
| Pelatih / anggota tim | Mengukur kemajuan secara objektif | Skor, waktu, penalti, dan riwayat sesi tersimpan |
| Tim (3 orang) | Berlatih pembagian tugas | Satu sesi dapat diulang cepat dengan kondisi awal identik |

## 4. Ruang Lingkup

### 4.1 Termasuk dalam MVP

- Arena 3D 4 × 6 m hasil rekonstruksi aset panitia.
- Kendali Transporter: 3 mode penggerak (diferensial/tank, arcade, mecanum).
- Gripper dua tombol: capit/lepas dan angkat/turun.
- Gamepad PS3/PS4 dengan remap penuh, profil, deadzone, sensitivitas, kurva, dan invert.
- Keyboard sebagai cadangan, juga dapat di-remap.
- Line Follower otomatis dengan slider kecepatan dan tombol mulai/jeda.
- Kamera isometrik tetap dan mode atur-lalu-kunci.
- Mode Free Test dan Penyisihan (240 detik, skor 130).
- Objek LEX dan LATERES sesuai jumlah resmi (2 LEX + 4 LATERES per tim).
- Gate CATARACTA 1 dan 2, gate invisible, polisi tidur, dinding, zona start/finish/transfer/pick/drop.
- Timer, skor, penalti utama, retry, HUD, dan layar hasil.
- Penyimpanan pengaturan dan skor terbaik di perangkat.
- Build statis yang dapat dijalankan offline.

### 4.2 Tidak termasuk dalam MVP

- Babak battle 16 besar, objek AQVAE, dan lawan otomatis.
- Kendali jarak jauh untuk robot fisik (Wi-Fi/Bluetooth).
- Multiplayer online.
- Kontrol sentuh untuk ponsel/tablet.
- Fisika rigid-body penuh, gripper berartikulasi, dan simulasi kabel.
- Animasi penyambungan tanjakan dan penyusunan balok pada tabung; tanjakan tampil statis pada MVP.
- Ekspor video replay.

### 4.3 Kriteria penerimaan utama

| ID | Kriteria | Cara membuktikan |
|---|---|---|
| F-01 | Arena dan zona tampil sesuai dimensi resmi | Kalibrasi terhadap `Full Track.jpg`, cek daftar konstanta |
| F-02 | Kamera isometrik tetap; posisi dapat diatur lalu dikunci | Sesi dimulai, kamera tidak bergerak; pengaturan bertahan setelah reload |
| F-03 | Transporter dapat dikemudikan pada 3 mode | Uji maju, mundur, putar, dan geser samping |
| F-04 | Semua tombol/stick/trigger dapat di-remap | Remap satu aksi, simpan, reload, aksi tetap berfungsi |
| F-05 | Gripper mencengkeram dan mengangkat objek | Angkat LEX, pindahkan, lepas di zona |
| F-06 | LF berjalan otomatis dan berhenti di gate tertutup | Slider mengubah tempo; LF berhenti lalu lanjut setelah gate dibuka |
| F-07 | Misi Penyisihan berakhir sesuai aturan | Semua objek di drop zone benar + finish, atau waktu habis |
| F-08 | Skor maksimal 130 | Sesi sempurna menghasilkan 130 |
| F-09 | Free Test tidak memakai timer/skor | HUD tidak menampilkan hitung mundur; reset kapan saja |
| F-10 | Aplikasi berjalan offline | Build lalu preview dengan jaringan dimatikan |

## 5. Aturan yang Disimulasikan

### 5.1 Arena dan zona

| Elemen | Ukuran | Catatan |
|---|---|---|
| Arena | 6,0 m × 4,0 m | Area A, B, C; origin di tengah arena |
| Dinding arena | Tebal 8 mm, tinggi 10 cm | Membatasi seluruh sisi |
| Start Zone Transporter | 35 × 35 cm | Robot harus 100% di dalam saat start |
| Start Zone Line Follower | 25 × 25 cm | Robot harus 100% di dalam saat start |
| Finish Zone | 35 × 55 cm | Kedua robot harus finish |
| Pick Zone LEX | 20 × 20 cm | Berada di Area A |
| Pick Zone LATERES | 8 × 8 cm | Berada di Area B |
| Drop Zone LATERES | 20 × 20 cm | Berada di Area A |
| Drop Zone LEX | 8 × 8 cm | Berada di Area B; LEX sah jika 25% masuk |
| Transfer Zone | 40 × 16 cm | Transporter tidak boleh melewatinya; LF boleh melewati sampai gripper |
| Panggung | Tinggi 10 cm | Area panggung AQVAE; tidak aktif di MVP |

Koordinat pasti setiap zona ditentukan melalui proses kalibrasi terhadap gambar trek resmi dan disimpan di `src/sim/trackLayout.ts` beserta catatan sumber.

### 5.2 Objek

| Objek | Ukuran | Berat estimasi | Jumlah per tim | Kegunaan MVP |
|---|---|---|---|---|
| LEX | 5,3 × 5,3 × 5,0 cm | ±40 g | 2 | Ya |
| LATERES | 5,2 × 5,2 × 5,0 cm | ±40 g | 4 | Ya |
| AQVAE | 10 × 10 × 17,8 cm | ±100 g | 1 (battle) | Tidak |

Sebaran awal: Area A berisi 2 LEX, Area B berisi 2 LATERES, Area C berisi 2 LATERES.

### 5.3 Rintangan dan gate

| Elemen | Dimensi | Perilaku |
|---|---|---|
| Polisi tidur 40 cm | 40 × 2 × 2 cm | Menghambat laju Transporter; jarak antar-polisi tidur 3 cm |
| Polisi tidur 45 cm | 45 × 2 × 2 cm | Sama, versi lebih panjang |
| CATARACTA 1 | 7,5 × 4 × 40 cm, ±200 g | Menutup jalur LF; dibuka Transporter |
| CATARACTA 2 | 7,5 × 4 × 24 cm, ±110 g | Menutup jalur LF menuju finish; dibuka Transporter |
| Tuas capit gate | 6,2 cm | Bagian yang dicengkeram robot |
| Gate invisible | Tidak berwujud | LF hanya boleh lewat setelah 1 LEX + 2 LATERES dipindahkan |

CATARACTA dapat ditarik atau diangkat, tetapi tidak boleh dirusak. Gate dinyatakan terbuka pada sudut buka minimal 70°.

### 5.4 Alur misi Penyisihan

State utama: `SETUP(60 dtk) → ARMED(3-2-1) → RUNNING → COMPLETE / TIME_UP / DISQUALIFIED`, dengan sub-state `RETRY`.

1. **Setup:** kedua robot berada di zona start; objek muncul sesuai sebaran. Pengguna dapat mengatur kamera dan kontroler.
2. **Mulai:** hitung mundur 3 detik, lalu timer 240 detik berjalan.
3. **Buka CATARACTA 1:** Transporter mencengkeram tuas dan menarik/mengangkat gate. LF terhalang sampai gate terbuka.
4. **Transfer LEX:** Transporter mengambil 2 LEX di Pick Zone LEX (Area A) dan menaruhnya di Transfer Zone. LF mengambil dan mengantarnya ke Drop Zone LEX (Area B).
5. **Transfer LATERES:** LF mengambil LATERES di Area B dan Area C, menyerahkannya di Transfer Zone. Transporter membawanya ke Drop Zone LATERES (Area A).
6. **Buka CATARACTA 2:** membebaskan jalur LF menuju Area C/finish.
7. **Gate invisible:** LF baru boleh melewati setelah 1 LEX dan 2 LATERES berhasil dipindahkan.
8. **Finish:** kedua robot masuk Finish Zone; misi dinyatakan selesai jika seluruh objek berada di drop zone yang benar dan kedua robot finish.
9. **Akhir sesi:** `COMPLETE` jika seluruh syarat terpenuhi; `TIME_UP` jika timer habis; `DISQUALIFIED` jika terjadi pelanggaran berat.

### 5.5 Penilaian Penyisihan

| Komponen | Poin | Jumlah | Subtotal |
|---|---|---|---|
| LEX di drop zone | 15 per objek | 2 | 30 |
| LATERES di drop zone | 15 per objek | 4 | 60 |
| Mencapai Finish Zone | 10 | 1 | 10 |
| Objek sah di Transfer Zone | 5 per objek | 6 | 30 |
| **Total maksimal** | | | **130** |

Catatan: tabel guidebook pada bagian penentuan nilai terbaca tidak berurutan saat diekstrak. Angka di atas adalah interpretasi yang konsisten dengan total resmi 130. Babak battle menambahkan AQVAE 30 poin (menang mutlak) sehingga total 160; keduanya di luar MVP.

### 5.6 Penalti MVP

| Pelanggaran | Sanksi |
|---|---|
| Start sebelum aba-aba wasit | Penalti 5 detik |
| Retry tidak sesuai prosedur | Penalti 5 detik |
| Robot tidak berada di posisi start saat setup/trial berakhir | Penalti 5 detik |
| Robot melebihi start zone | Pengurangan 5 poin |
| LF melewati gate invisible sebelum syarat | Pengurangan 15 poin dan retry kedua robot |
| Menyentuh robot/objek saat pertandingan (tombol dev) | Pengurangan 5 poin dan retry |
| Merusak arena, robot lawan, atau memakai robot tidak terdaftar | Diskualifikasi |

Daftar lengkap pelanggaran mengikuti guidebook Bagian III.H. Sanksi yang tidak memiliki padanan virtual tidak diaktifkan dalam permainan normal.

### 5.7 Retry

- Retry dapat diminta selama waktu pertandingan masih tersisa.
- Kedua robot kembali ke posisi start.
- Objek kembali ke lokasi asal pengambilan, kecuali objek yang sudah sah berada di Drop Zone.
- Objek yang sudah sah di Transfer Zone mengikuti aturan guidebook: objek yang di-retry kembali ke asal dan poin Transfer Zone gugur, atau objek kembali ke Transfer Zone dan objek baru dianggap tidak sah.
- Perhitungan waktu terus berjalan selama retry.

### 5.8 Asumsi dan ambiguitas aturan

| Ambiguitas | Default yang dipakai | Dapat diubah |
|---|---|---|
| Arti “1 LEX + 2 LATERES dipindahkan” | Sah berada di Drop Zone | Ya, alternatif: cukup di Transfer Zone |
| Batas 25% LEX | 25% luas objek di dalam zona | Ya |
| Kriteria finish | Titik tengah robot di dalam zona | Ya, alternatif: seluruh badan di dalam |
| Penalti waktu | Mengurangi sisa waktu | Ya |
| Poin Transfer Zone | Sekali per objek pada penempatan sah pertama | Ya |
| Objek saat retry | Kembali ke asal; objek yang sudah sah di Drop Zone dipertahankan | Ya |
| “Menyentuh robot” | Tidak ada padanan virtual; hanya tombol dev | Ya |
| Koordinat zona | Hasil kalibrasi gambar trek | Ya |

Semua default disimpan di `src/rules/rulesConfig.ts` dan ditampilkan di panel Aturan agar tim tahu interpretasi yang sedang dipakai. Interpretasi final mengikuti Technical Meeting 12 Desember 2026 dan adendum resmi.

## 6. Mode Permainan

| Aspek | Free Test | Penyisihan |
|---|---|---|
| Tujuan | Eksplorasi trek dan kontrol | Simulasi pertandingan resmi |
| Timer | Tidak ada | 240 detik |
| Skor | Tidak ada | Skor 130 dan penalti |
| Retry | Reset bebas kapan saja | Sesuai prosedur retry |
| Gate | Dapat dibuka/diulang bebas | Sesuai syarat misi |
| Objek | Semua objek MVP tersedia | 2 LEX + 4 LATERES |
| Akhir sesi | Kapan saja oleh pengguna | Semua misi selesai atau waktu habis |
| Hasil | Tidak disimpan | Rincian skor, waktu, penalti, rekor |

## 7. Kontrol

### 7.1 Aksi yang dapat dipetakan

- Throttle (maju/mundur)
- Steer (belok kiri/kanan)
- Strafe kiri/kanan (khusus mecanum)
- Capit/lepas
- Angkat/turun gripper
- Line Follower mulai/jeda
- Line Follower lebih cepat/lambat
- Reset
- Jeda
- Retry
- Kunci/buka kamera

### 7.2 Preset default

| Mode penggerak | Stick kiri | Stick kanan |
|---|---|---|
| Diferensial/tank | Track kiri (Y) | Track kanan (Y) |
| Arcade 1 stick | Throttle (Y) dan steer (X) | Tidak dipakai |
| Mecanum | Translasi (X/Y) | Rotasi (X) |

Tombol default: Cross = capit/lepas, Square = angkat/turun, Options = jeda, Share = reset, L1/R1 = kecepatan LF, R2 = LF mulai/jeda. Seluruh tombol dapat diubah karena pemetaan PS3 dan PS4 berbeda di setiap sistem operasi.

### 7.3 Pengaturan kontroler

- Deteksi otomatis gamepad dan status koneksi.
- Perekam input: pengguna menekan tombol/stick/trigger untuk mengikat aksi.
- Deadzone 0–0,5; sensitivitas 0,5–2; kurva linear/eksponensial; invert per sumbu; tukar stick; ambang trigger.
- Profil per controller, preset PS3 dan PS4, profil kustom, ekspor/impor JSON, reset ke default.
- Peringatan konflik jika satu input dipakai dua aksi.
- Indikator input langsung untuk menguji tanpa masuk arena.
- Keyboard dapat di-remap dengan mekanisme yang sama.
- Semua pengaturan disimpan di `localStorage` dan bertahan setelah halaman dimuat ulang.

### 7.4 Keyboard default

WASD/panah untuk gerak, Space untuk capit, E untuk angkat/turun, R untuk reset, P untuk jeda, F untuk kunci kamera.

## 8. Kamera

- Default: kamera isometrik tetap ±45° dari sisi arena, seluruh arena terlihat, tidak bergerak selama sesi.
- Mode “atur lalu kunci”: pengguna dapat memutar, menggeser, dan memperbesar sebelum sesi; setelah dikunci, kamera tidak bergerak.
- Posisi kamera disimpan per pengguna dan dapat direset.
- Saat bermain, kamera tidak mengikuti robot agar pengguna melatih penilaian posisi dari sudut tetap.

## 9. Line Follower Otomatis

- Mengikuti jalur waypoint yang telah ditentukan pada trek.
- Kecepatan dapat diatur dengan slider 0,05–0,35 m/s.
- Tombol mulai/jeda menghentikan dan melanjutkan pergerakan.
- Berhenti otomatis di gate CATARACTA yang masih tertutup, di titik pengambilan/penyerahan objek, dan di gate invisible yang belum terbuka.
- Melanjutkan perjalanan setelah syarat gate terpenuhi.
- Membawa objek sesuai urutan misi; objek tidak berpindah tanpa aksi yang sah.
- Jika LF menabrak dinding atau keluar jalur, sesi menampilkan peringatan dan menyediakan reset/retry.

## 10. Kebutuhan Non-Fungsional

| Aspek | Target |
|---|---|
| Platform | Chrome dan Edge desktop di Windows 10/11 |
| Grafis | WebGL2, target 60 fps pada GPU terintegrasi, resolusi 1080p |
| Waktu muat | Kurang dari 10 detik pada penyajian lokal |
| Keterlambatan input | Kurang dari 50 ms dari gamepad ke gerakan |
| Offline | Build statis dapat dibuka tanpa jaringan |
| Penyimpanan | `localStorage` untuk pengaturan, profil, rekor |
| Tanpa backend | Tidak ada server, akun, atau pengiriman data keluar |
| Privasi | Tidak ada telemetri; data tetap di perangkat |
| Bahasa | Antarmuka Indonesia |
| Aksesibilitas | Semua aksi tersedia lewat keyboard |
| Aset | Menggunakan aset resmi panitia untuk keperluan latihan tim |

## 11. Metrik Keberhasilan

**Metrik produk**

- 60 fps stabil pada laptop dengan GPU terintegrasi.
- Tidak ada error di konsol selama sesi 240 detik.
- Pengaturan kontroler bertahan setelah reload.
- Build offline berjalan tanpa permintaan jaringan.

**Metrik latihan**

- Tiga sesi berturut-turut dengan skor minimal 100.
- Waktu menyelesaikan seluruh misi di bawah 180 detik.
- Nol penalti pada dua sesi berturut-turut.
- Membuka CATARACTA tanpa menabrak dinding tiga kali berturut-turut.
- Operator dapat menjelaskan urutan misi tanpa melihat catatan.

## 12. Roadmap dan Estimasi

### 12.1 Fase pengerjaan

| Fase | Hasil | Jam |
|---|---|---|
| 0 | `PRD.MD`, scaffold Vite/TypeScript, skrip aset | 6 |
| 1 | Arena statis: lantai, dinding, zona, alat kalibrasi | 10 |
| 2 | Kamera isometrik, atur-lalu-kunci, persistensi | 6 |
| 3 | Kendaraan dan 3 mode penggerak, keyboard | 10 |
| 4 | Gamepad, remap penuh, profil, halaman uji input | 10 |
| 5 | Tabrakan, objek, gripper capit/angkat/bawa | 14 |
| 6 | CATARACTA, gate invisible, polisi tidur, tanjakan statis | 10 |
| 7 | Line Follower otomatis, slider, jeda | 10 |
| 8 | State machine misi, timer, skor, penalti, retry | 12 |
| 9 | HUD, hasil, Free Test, persistensi | 8 |
| 10 | Unit test, uji gamepad, PWA, dokumentasi | 10 |
| **Total** | | **106 jam** |

### 12.2 Perbandingan 2D dan 3D

Asumsi: satu orang, 6–10 jam per minggu. Jika dikerjakan tiga orang secara paralel, waktu kalender dapat turun 40–60%.

| Varian | Jam kerja | Kalender (6–10 jam/minggu) | Risiko | Nilai latihan |
|---|---|---|---|---|
| 2D top-down | 40–60 | 6–10 minggu | Rendah | Kurang: tanpa perspektif, tinggi gripper, dan geometri gate |
| **3D sederhana (dipilih)** | **90–120** | **12–18 minggu** | Sedang | Baik: tata letak, sudut pandang, gate, dan transfer terasa nyata |
| 3D fisika penuh | 200–300 | 25–40 minggu | Tinggi | Marjinal: tuning lama, skor tidak deterministik, tanpa CAD robot |

### 12.3 Jalur cepat menuju 12 Desember 2026

Jika target adalah kompetisi edisi ini, bagi pekerjaan ke tiga alur paralel:

| Minggu | Alur A: aset dan arena | Alur B: robot dan input | Alur C: aturan dan UI |
|---|---|---|---|
| 1 | Fase 0–1: scaffold, ekstrak aset, lantai, dinding, zona | Fase 3: kendaraan dan keyboard | Fase 8 awal: konstanta misi dan skor |
| 2 | Fase 2: kamera | Fase 4: gamepad dan remap | Fase 7: Line Follower otomatis |
| 3 | Fase 6: gate dan rintangan | Fase 5: tabrakan, objek, gripper | Fase 8: state machine, timer, skor |
| 4 | Integrasi dan perbaikan | Uji gamepad dan remap | Fase 9–10: HUD, hasil, unit test |
| 5 | Penyangga: perbaikan bug dan uji offline | | |

Jika waktu tidak cukup, tunda: mecanum, tanjakan interaktif, ekspor hasil, dan animasi detail. Prioritas MVP: arena, kemudi, gripper, gate, LF, timer, skor.

## 13. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| PS3/PS4 tidak terbaca atau mapping berbeda | Pengguna tidak bisa bermain | Halaman uji gamepad, remap penuh, profil per controller, keyboard cadangan |
| Ambiguitas aturan dan koordinat zona | Simulasi tidak sesuai arena asli | Panel Aturan, `rulesConfig.ts`, kalibrasi gambar trek, verifikasi saat Technical Meeting |
| Aset STL tidak lengkap atau kotor | Model objek rusak | Sanitasi mesh, objek pengganti prosedural, hanya LEX/LATERES yang memakai STL |
| Tekstur trek berukuran besar | Muat lambat, fps turun | Konversi ke WebP, batas 8192 px, kompresi kualitas 82 |
| Lingkup melebar ke battle/AQVAE | MVP tidak selesai | Battle dan AQVAE ditandai di luar MVP; fitur di balik konfigurasi |
| Waktu pengerjaan mepet kompetisi | Tidak siap sebelum Technical Meeting | Jalur cepat 4 minggu, prioritas fitur, pengujian mingguan |
| Perbedaan performa laptop anggota | Pengalaman tidak seragam | Target 60 fps di GPU terintegrasi, opsi kualitas grafis |

## 14. Glosarium

| Istilah | Arti |
|---|---|
| LEX | Kotak objek berornamen neraca, 5,3 × 5,3 × 5 cm |
| LATERES | Kotak objek berornamen batu bata, 5,2 × 5,2 × 5 cm |
| AQVAE | Objek battle 10 × 10 × 17,8 cm, hanya babak 16 besar ke atas |
| CATARACTA | Gate yang menutup jalur Line Follower dan harus dibuka Transporter |
| Transfer Zone | Area pertukaran objek antara Transporter dan Line Follower |
| Gate invisible | Batas tak berwujud yang baru boleh dilewati LF setelah syarat objek terpenuhi |
| Polisi tidur | Rintangan rendah pada jalur Transporter |
| Retry | Permintaan mengulang dengan robot kembali ke start |
| TF | Transfer Zone |
| Free Test | Mode latihan tanpa timer dan skor |
| Penyisihan | Mode simulasi pertandingan resmi dengan skor 130 |

## 15. Lampiran

### 15.1 Referensi aturan

- `GUIDEBOOK_AQUADUCT ROMANA _SMA.pdf`, Bagian III.A (spesifikasi robot), III.C (arena), III.D (objek), III.E (alur lomba), III.G (penilaian), III.H (pelanggaran dan sanksi).
- `Full Track (6 m × 4 m)` untuk tata letak arena.
- `Track Banner LF (2,53m × 2,468m)` untuk jalur Line Follower.
- `STL/` untuk model LEX, LATERES, dan AQVAE.
- `SIMULASI VIDEO.mp4` untuk referensi gerak dan urutan permainan.

### 15.2 Berkas yang akan dibuat

- `PRD.MD` — dokumen ini.
- `src/sim/constants.ts` — dimensi arena, zona, objek, skor.
- `src/sim/trackLayout.ts` — koordinat zona hasil kalibrasi.
- `src/sim/mission.ts` — state machine dan akhir sesi.
- `src/sim/world.ts` — loop simulasi.
- `src/rules/rulesConfig.ts` — asumsi aturan yang dapat diubah.
- `src/input/profiles.ts` — profil controller dan remap.
- `src/render/cameraRig.ts` — kamera isometrik dan kunci.
- `scripts/build-assets.mjs` — pipeline aset.

### 15.3 Checklist verifikasi

1. Angka arena, zona, objek, dan skor cocok dengan guidebook.
2. `npm run dev` berjalan dan arena tampil.
3. Gamepad PS3/PS4 terbaca; remap, deadzone, invert, dan profil bertahan setelah reload.
4. Sesi sempurna menghasilkan skor 130.
5. Hanya 1 LEX + 2 LATERES menghasilkan 45.
6. Gate invisible yang dilewati terlalu awal menghasilkan penalti 15.
7. Start sebelum aba-aba menghasilkan sisa waktu 235 detik.
8. Overlap LEX 24,9% gagal dan 25,1% sah.
9. Free Test dapat direset kapan saja.
10. Penyisihan berakhir saat seluruh objek di drop zone benar dan kedua robot finish, atau waktu habis.
11. Kamera terkunci selama sesi berjalan.
12. Build offline berjalan tanpa jaringan.
