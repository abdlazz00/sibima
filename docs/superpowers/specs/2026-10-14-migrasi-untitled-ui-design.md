# Desain: Migrasi Pustaka UI ke Untitled UI (versi gratis)

Status: Menunggu review.
Tanggal: 2026-10-14

Memindahkan lapisan tampilan SIBIMA dari komponen buatan sendiri (scaffold Breeze + utilitas Tailwind) ke komponen Untitled UI React yang gratis (MIT), secara bertahap dengan pilot di halaman Daftar Aset.

---

## 1. Konteks & Tujuan

**Kondisi sekarang** (diverifikasi 2026-10-14):
- Frontend: Inertia 2 + React 18 + TypeScript, Tailwind **3.4.19**, ±16 ribu baris TSX.
- Preline terpasang (paket, plugin Tailwind, `autoInit()` di `app.tsx` dan `AuthenticatedLayout`) tetapi **tidak ada satu pun class `hs-*` / `data-hs-*`** yang dipakai; tidak berfungsi.
- Komponen UI: `resources/js/Components/` (sisa Breeze: `Modal`, `Dropdown`, `TextInput`, `PrimaryButton`, `NavLink`, dan lain-lain; `Modal` dan `Dropdown` memakai Headless UI) dan styling utilitas langsung di halaman (17 halaman berisi `<table>`, 33 berkas berisi `<input>`/`<select>`).
- Tema kustom hanya satu warna `primary` (Sapphire `#1E40AF`, hover `#1D4ED8`, dark `#172554`) dan font Figtree. `app.css` 16 baris.
- `@tailwindcss/vite` ^4 ada di `package.json` tetapi tidak dipakai.
- Tidak ada test frontend; verifikasi hanya `tsc` dan `npm run build`.

**Fakta Untitled UI React** (dokumentasi resmi, via Context7):
- Dibangun di atas **Tailwind v4** dan **React Aria Components**; starter kit memakai React 19.
- Komponen **disalin ke proyek lewat CLI** (`npx untitledui@latest add button input ...`), bukan paket yang diimpor; kode menjadi milik proyek.
- Komponen dasar, UI aplikasi, dan seksi marketing gratis (MIT, boleh komersial); PRO berbayar. **Proyek ini hanya memakai versi gratis.**
- Ikon dari paket `@untitledui/icons`.

**Tujuan** (alasan pengguna):
1. Tampilan lebih modern dan rapi.
2. Pengembangan fitur berikutnya lebih cepat lewat komponen siap pakai.
3. Konsistensi dan aksesibilitas (React Aria: keyboard, fokus, screen reader).

**Kriteria berhasil:**
- Setiap halaman yang dimigrasi hanya memakai `resources/js/Components/ui/`.
- `npx tsc --noEmit` dan `npm run build` bersih di setiap task.
- 715 test backend tetap hijau.
- Tampilan lolos cek visual pengguna di setiap gerbang.
- Pada penutupan tidak tersisa komponen Breeze, `Icons.tsx`, Preline, atau Headless UI yang tak terpakai.

**Di luar cakupan:** mode gelap, komponen PRO, mengubah struktur menu atau isi halaman, mengganti Chart.js (komponen chart Untitled UI adalah PRO), mengganti font Figtree, menambah fitur baru, kerangka uji frontend.

---

## 2. Keputusan yang Disepakati

| Topik | Keputusan |
|---|---|
| Motivasi | Tampilan modern, kecepatan pengembangan, konsistensi dan aksesibilitas |
| Lisensi | Hanya versi gratis |
| Pendekatan | Bertahap per lapisan (bukan sekali ganti, bukan berhenti di komponen dasar) |
| Pilot | Satu halaman: `Assets/Index` (Daftar Aset). Shell (sidebar/header) tetap lama selama pilot |
| React | Coba tetap React 18 di Fase 0/2; naik ke 19 hanya bila terbukti perlu, dilaporkan dan disetujui pengguna dulu |
| Konflik desain | Panduan UI/UX menang untuk identitas; Untitled UI menang untuk struktur dan perilaku |
| Urutan Fase 4 | Shell lebih dulu setelah pilot disetujui |
| Git | Commit per task langsung di `main`, tanpa push dan tanpa merge ke `production` tanpa perintah pengguna |
| Uji visual | Dilakukan pengguna di browser pada setiap gerbang; agen tidak menguji lewat browser |

---

## 3. Desain

### 3.1 Fase 0: fondasi (tampilan harus identik)

1. **Tailwind v3.4 → v4** dengan alat resmi `@tailwindcss/upgrade`, lalu perapian manual class yang berganti nama (`shadow-sm`→`shadow-xs`, `rounded-sm`, `ring`, `outline-none`, dan sejenisnya).
   - `tailwind.config.js` dan `postcss.config.js` diganti `@import "tailwindcss"` di `resources/css/app.css` dan plugin `@tailwindcss/vite` di `vite.config.js`.
   - `@tailwindcss/forms` dipertahankan lewat `@plugin`.
   - Warna `primary` dan font Figtree dipindah ke `@theme`.
2. **Hapus Preline**: paket, plugin Tailwind, `import 'preline/preline'`, `content` yang menunjuk `node_modules/preline`, tipe `preline.d.ts`, dan dua pemanggilan `HSStaticMethods.autoInit()`.
3. **React**: tetap 18. Bila Fase 2 membuktikan komponen butuh React 19, naikkan setelah persetujuan pengguna (periksa `@inertiajs/react`, `@headlessui/react`, `react-chartjs-2`, `@types/react`).
4. **Gerbang**: build dan `tsc` bersih, test halaman terkait hijau, suite penuh hijau, pengguna memastikan tampilan **identik**.

### 3.2 Fase 1: token

- Tambah `resources/css/theme.css` dari dokumentasi Untitled UI (skala teks, radius, breakpoint) dan impor di `app.css`, bersama plugin `tailwindcss-animate` dan `tailwindcss-react-aria-components` (dependensi baru, gratis).
- Skala warna `brand` dibangun dari palet blue Tailwind. Sapphire `#1E40AF` = blue-800, `#1D4ED8` = blue-700, `#172554` = blue-950; `#1E40AF` menjadi warna tombol utama.
- Hover mengikuti Untitled UI (lebih gelap), berbeda dari panduan lama yang membuat hover lebih terang.
- Tanpa mode gelap (variant `dark` tidak diaktifkan).
- Figtree tetap sebagai `--font-body`.

### 3.3 Fase 2: lapisan komponen

- CLI dijalankan per komponen; hasil ditaruh di `resources/js/Components/ui/` (subfolder di dalam `Components` yang sudah ada). Impor memakai alias `@/Components/ui/...`.
- Komponen yang ditambah hanya yang dibutuhkan pilot: **button, input, select, combobox, tooltip, badge, tabel, paginasi, modal/dialog** (diperbarui 2026-10-14 setelah review plan: `checkbox` ikut `tabel`, `dropdown` dan `radio` tidak dibutuhkan pilot; `combobox` dan `tooltip` ditambah). Sisanya ditambah saat halamannya tiba.
- `@untitledui/icons` ditambahkan sebagai dependensi baru. `Components/Icons.tsx` dipertahankan sampai halaman terakhir pindah.
- **Integrasi Inertia:** `RouterProvider` React Aria dipasang di `app.tsx` dan diarahkan ke `router.visit` Inertia, supaya `href` pada komponen tidak memicu reload penuh dan prefetch Inertia tetap bekerja.
- Komponen Breeze lama **tidak dibungkus** dengan adaptor; tetap dipakai halaman yang belum dimigrasi dan dihapus di pembersihan akhir.
- Aturan: halaman yang sudah dimigrasi hanya memakai `Components/ui/`, tidak mencampur komponen Breeze.
- Hasil CLI (nama berkas, struktur impor, ketergantungan antar komponen) baru dipastikan setelah dijalankan; diff dicek sebelum commit dan detailnya dituliskan di plan.

### 3.4 Fase 3: pilot `Assets/Index`

| Sekarang | Menjadi |
|---|---|
| Tombol (Tambah Aset, Cetak Label) | `Button` primary/secondary; tautan lewat `href` |
| Kolom cari + debounce 400 ms | `Input` dengan ikon cari; logika debounce dan `router.get` tidak berubah |
| Filter kategori/unit/kondisi + urutan | `Select` |
| Tabel + checkbox pilih baris | `Table` + `Checkbox`; aksi lihat/ubah menjadi tombol ikon |
| Badge kondisi (`KONDISI_STYLE`) | `Badge` (success/warning/error/gray), radius 4px sesuai panduan |
| Paginasi (`pageNumbersWithGaps`) | `Pagination` |
| `PrintLabelModal` | `Modal` dari `ui/` |
| `ImportExportButtons` | `Button`/`Dropdown` dari `ui/` |

- Logika bisnis halaman (filter, pilih baris lintas halaman, cetak label, `can.*`) tidak berubah; yang diganti hanya elemen tampilan.
- `PrintLabelModal` dan `ImportExportButtons` dimigrasi bersama konsumen pertamanya; karena `ImportExportButtons` juga dipakai halaman Pegawai dan Kategori, tampilannya di sana ikut berubah dan itu diterima.
- Aturan konflik desain: Panduan UI/UX menang untuk identitas (Sapphire, tabular-nums, kartu `rounded-lg` tanpa bayangan, badge 4px, tanpa kartu di dalam kartu); Untitled UI menang untuk semantik, aksesibilitas, keyboard, fokus, dan state.
- `lib/pagination.ts` dan `Icons.tsx` tidak diubah (masih dipakai halaman lain).
- **Gerbang pilot**: setelah build bersih, agen berhenti. Pengguna menilai di browser lalu memutuskan lanjut, revisi, atau berhenti di titik "hanya komponen dasar".

### 3.5 Fase 4: rollout (garis besar; dirinci per kelompok saat tiba)

1. **Shell** (`AuthenticatedLayout`: sidebar, header, notifikasi, badge persetujuan, menu per permission).
2. Master data: Kategori Aset, Role, Pegawai.
3. Transaksi: Penerimaan, Mutasi, Permohonan, Lapor Rusak/Hilang, Kotak Persetujuan.
4. Pengaturan: Pengguna, Alur Persetujuan.
5. Laporan (3 halaman), Dashboard (Chart.js dengan warna dari token), Import, Scan QR, Auth, Profil.
6. Pembersihan: hapus komponen Breeze lama, `Icons.tsx`, `lib/pagination`, dan dependensi Headless UI bila tak lagi dipakai.

Tiap kelompok adalah siklus kecil sendiri: plan ringkas, satu commit per halaman, gerbang cek visual pengguna.

---

## 4. Pengujian & Verifikasi

- Setiap task: `npx tsc --noEmit` dan `npm run build` bersih sebelum commit.
- Nama berkas halaman dan props Inertia tidak berubah, sehingga test backend tidak tersentuh. Test halaman terkait (mis. `AssetBrowseTest`, `AssetVisibilityTest`) dijalankan di akhir Fase 0, akhir pilot, dan akhir tiap kelompok; suite penuh di akhir Fase 0 dan penutupan.
- Gerbang visual oleh pengguna dengan daftar periksa pendek: fokus dan keyboard (Tab/Enter/Esc pada filter, tabel, modal), lebar 375 px dan tabel yang meluap, angka tabular, warna badge kondisi, alur cetak label dan impor/ekspor.
- Tidak ada test frontend baru.

---

## 5. Risiko & Catatan

| Risiko | Penanganan |
|---|---|
| Upgrade Tailwind v4 menggeser tampilan | Fase 0 dibuat identik dan dicek pengguna sebelum komponen diganti |
| React 18 tidak cocok dengan komponen | Diuji di Fase 0/2; naik ke 19 hanya setelah dilaporkan dan disetujui |
| Navigasi komponen memicu reload penuh | `RouterProvider` React Aria diarahkan ke `router.visit` Inertia |
| Dua gaya UI hidup berdampingan lama | Rollout dibagi kelompok kecil; shell dikerjakan tepat setelah pilot |
| CLI menambah atau menimpa berkas tak terduga | Dijalankan per komponen, diff dicek sebelum commit |
| Tema Untitled UI mengganti skala teks dan radius | Dibandingkan dengan halaman yang ada di Fase 1; selisih dicatat |
| Grafik: komponen chart Untitled UI adalah PRO | Chart.js tetap; warna diselaraskan dengan token |
| Tanpa test frontend, regresi visual hanya terlihat oleh pengguna | Gerbang cek visual di tiap fase; commit kecil agar mudah di-revert |

- Dependensi yang akan berubah (butuh persetujuan per instruksi proyek; persetujuan spec ini oleh pengguna dihitung sebagai persetujuannya): tambah `@untitledui/icons`, `tailwindcss-animate`, `tailwindcss-react-aria-components`, `react-aria-components` dan paket React Aria/Stately yang dibutuhkan komponen; naik `tailwindcss` ke v4; hapus `preline`, dan nanti `@headlessui/react`. Naik React ke 19 tidak termasuk dan perlu persetujuan terpisah.
- Dokumen yang diperbarui di akhir: `docs/PANDUAN_DESAIN_UI_UX_SIBIMA.md` (token, komponen, aturan konflik), `README.md` (stack frontend dan cara menambah komponen), dan catatan memori proyek.
