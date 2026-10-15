# Chart ApexCharts, KPI Card Berwarna, dan Dashboard/Laporan yang Dipercantik — Desain

Tanggal: 2026-10-15. Lanjutan Fase 4 migrasi Untitled UI. Frontend saja; tidak ada perubahan backend, route, atau skema data.

## Tujuan

Pengguna SIBIMA banyak yang berusia lanjut dan ingin Dashboard serta Laporan tampak menarik dan berwarna. Pekerjaan ini: (1) mengganti Chart.js dengan ApexCharts, (2) memberi ikon dan warna pada semua KPI card di Dashboard dan tiga laporan, (3) mempercantik Dashboard dan Laporan secara keseluruhan dengan teks lebih besar dan kontras tinggi, (4) membuat tombol pintasan Dashboard jelas berbeda dari KPI card.

## Keputusan (semua dari pengguna)

- Gaya KPI card: **kartu tint warna + ikon besar** (bukan kartu putih beraksen atau gradien solid).
- Pintasan Dashboard: **tombol solid pekat dengan ikon**, bukan ubin.
- Ikut dipercantik: **banner sambutan Dashboard**, **ikon pada judul kartu chart/tabel**, **ukuran teks lebih besar**.
- Dependensi: tambah `apexcharts` dan `react-apexcharts`; cabut `chart.js`, `react-chartjs-2`, `chartjs-plugin-datalabels`. Pengguna sudah membaca ketentuan lisensi (Community License: gratis di bawah US$2 juta pendapatan/anggaran per tahun; badan pemerintah tidak disebut; aplikasi internal bukan OEM) dan memutuskan melanjutkan tanpa menghubungi penjual. Hanya jenis chart gratis (donat, batang, area/garis) yang dipakai.
- Dua tahap bergerbang: **A** chart + dependensi, **B** KPI card, banner, pintasan, hiasan laporan. Tahap B tidak dimulai sebelum pengguna menyatakan Tahap A lolos.

## Global Constraints

- Bahasa UI Indonesia; font Figtree; angka `tabular-nums`; badge `rounded-sm`.
- Warna tombol mengikuti aturan yang sudah ada (panduan UI/UX bagian 9); amber hanya untuk peringatan, bukan dekorasi.
- Kontras teks minimal WCAG AA; label data dan legenda minimal 13px; angka KPI 32px.
- Layar 375 px tanpa scroll horizontal pada halaman; chart lebar boleh menggulir di dalam wadahnya sendiri (seperti `TrenAsetChart` sekarang).
- Setiap chart tetap punya `aria-label`/`role="img"` dan tabel `sr-only` setara (bila sebelumnya ada).
- Tidak ada perubahan data yang dikirim server; props komponen chart dipertahankan agar halaman pemakai hampir tidak berubah.

## Tahap A — Chart

**Komponen** (nama dan props sama dengan sekarang): `DonutChart`, `KategoriAsetChart`, `SebaranUnitChart`, `TrenAktivitasChart`, `TrenAsetChart`, `TrenInsidenChart`, `TrenMutasiChart` di `resources/js/Components/Charts/`.

**Helper bersama** `resources/js/lib/apex.ts`: opsi dasar ApexCharts (font Figtree, warna teks slate-600/700, ukuran label 13px, grid tipis `#E2E8F0`, tanpa toolbar, animasi singkat, `locale` angka Indonesia, tooltip berbahasa Indonesia, `chart.fontFamily`). Dimuat lazy bila perlu (`React.lazy`) agar bundel halaman non-chart tidak membesar; `react-apexcharts` hanya dirender di sisi klien.

**Bentuk per chart**
- Donat: `donut` dengan total di tengah (nama + jumlah, mis. "1.248 aset"), warna dari `KONDISI_COLOR`/`STATUS_COLOR`/`JENIS_COLOR`, tooltip "{label}: {jumlah} {unit} ({persen}%)". Legenda tetap `ChartLegend` buatan sendiri (teks lebih besar), bukan legenda Apex.
- Tren per tahun/bulan (aset, mutasi, insiden, aktivitas): batang dengan sudut atas membulat dan label data di atas batang (aset: "{n} aset" + nilai ringkas via `rupiahRingkas`); tren aktivitas memakai area bergradien lembut dengan titik data. Tooltip memuat rincian yang sama seperti sekarang (jumlah, nilai perolehan, nilai buku).
- Sebaran unit: batang bertumpuk per kondisi, nama unit disingkat ("Kel."/"Kec."), legenda di bawah.
- Kategori aset: padanan Chart.js yang ada (batang horizontal), warna dari skala biru.
- Keadaan kosong ("Belum ada data.") dan pesan khusus Sebaran Unit dipertahankan apa adanya.

**Pembersihan:** setelah semua pindah, hapus `chart.js`, `react-chartjs-2`, `chartjs-plugin-datalabels` dari `package.json`/`package-lock.json`; tak ada impor `chart.js` tersisa. Panduan UI/UX bagian 9 mendapat catatan ringkas tentang ApexCharts dan lisensinya.

**Gerbang A:** Dashboard dan tiga laporan menampilkan semua chart dengan benar (data, warna, tooltip, total tengah donat), teks terbaca, 375 px, tidak ada galat konsol, `tsc` dan build bersih.

## Tahap B — KPI card, Dashboard, Laporan

**`StatCard`** (`Components/StatCard.tsx`): prop baru `icon` (komponen `@untitledui/icons`) dan `tone` (`blue | green | amber | red | violet | teal | slate`). Seluruh kartu berlatar tint lembut + border sewarna (mis. `bg-blue-50 border-blue-100`), ikon 28px dalam lingkaran berwarna pekat berteks putih, label 14px, angka 32px tebal. Prop lama (`label`, `value`, `note`, `badge`) tetap. Peta nada ke kelas Tailwind disimpan di satu tempat (`lib/tone.ts`), dipakai juga oleh banner/pintasan/ikon judul.

**Pemetaan data → ikon + warna** (tepat sesuai makna data):
- Total Aset / Jumlah Aset: biru, `Package`. Total Nilai Aset / Nilai Perolehan: hijau, `Coins`/`Wallet`. Total Nilai Buku: teal, `BarChart`. Aset Kondisi Baik: hijau, `CheckCircle`. Aset Rusak/Hilang dan Nilai Terdampak: merah, `AlertTriangle`.
- Jumlah/Aset Berpindah/Nilai Perolehan Aset Berpindah: ungu, `SwitchHorizontal`. Mutasi/Laporan Disetujui: hijau, `CheckCircle`. Jumlah Mutasi/Laporan: biru, `File`. Rata-rata Lama Proses: teal, `Clock` (amber dicadangkan untuk peringatan).
- Nama ikon tepat ditentukan saat plan terhadap paket `@untitledui/icons` yang terpasang.

**Dashboard** (`Pages/Dashboard.tsx`):
- **Banner sambutan** gradien biru (Sapphire ke biru tua) di atas: sapaan menurut jam ("Selamat pagi/siang/sore/malam, {nama}"), unit, dan tanggal hari ini (`tanggal` dari `lib/format`); tombol "Kotak Persetujuan" untuk approver tetap di banner.
- **Pintasan:** bagian berjudul "Pintasan"; tombol besar solid pekat berikon dan berteks putih tebal, warna bergantian Sapphire, teal, ungu, hijau tua (tidak amber). Izin dan daftar tindakan per role tetap seperti sekarang (`candidateActions`).
- **Antrean pekerjaan:** tiap baris diberi ikon dan lencana jumlah berwarna.
- `ReportCard` mendapat prop opsional `icon`/`tone`: ikon kecil di samping judul dan garis aksen warna 3px di atas kartu; dipakai Dashboard dan tiga laporan.

**Laporan:** KPI card gaya baru; `ReportCard` berikon; chart dari Tahap A. Filter, tabel, ekspor tidak berubah.

**Gerbang B:** KPI card berwarna dan berikon yang sesuai datanya di empat halaman; pintasan jelas berbeda dari KPI; banner; ikon judul kartu; teks lebih besar tetap muat di 375 px; keyboard/fokus; kontras terbaca; `tsc` dan build bersih.

## Review Focus

- Data kosong: laporan tanpa data, tren satu titik, donat total 0 — tidak boleh galat; tampil "Belum ada data.".
- Nama unit/kategori sangat panjang di sumbu chart dan label KPI nilai rupiah besar — terpotong rapi, bukan melebar.
- Chart di layar 375 px dan saat jendela diubah ukurannya — responsif, tanpa meluber ke halaman.
- Pengguna tanpa izin tertentu (mis. tanpa `aset.create`) — daftar pintasan tetap menyesuaikan izin, tidak ada tombol kosong.
- Bundel: halaman non-chart tidak ikut memuat ApexCharts.

## Pengujian

Tidak ada logika backend baru, jadi tidak ada tes Pest baru; tes Dashboard dan Laporan yang ada harus tetap hijau. Verifikasi: `npx tsc --noEmit`, `npm run build`, tes terkait, dan cek runtime headless per halaman (tanpa galat konsol, tanpa scroll horizontal di 375 px). Penilaian visual oleh pengguna di tiap gerbang.

## Di luar cakupan

Mode gelap; perubahan tabel, filter, dan alur ekspor; chart interaktif tambahan (zoom, unduh, toolbar); terjemahan pesan galat Laravel.
