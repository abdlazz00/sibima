# Tombol Solid Berwarna Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (eksekusi native, satu sesi). Steps use checkbox (`- [ ]`) syntax. Dua Task = dua tahap bergerbang; **berhenti di akhir tiap Task dan tunggu pengguna menyatakan lolos**.

**Goal:** Semua tombol aksi di aplikasi menjadi solid berwarna sesuai makna aksi (peta di spec), kecuali Batal/netral yang tetap abu-abu.

**Architecture:** Empat varian solid baru di `Components/ui/base/buttons/button.tsx` (`primary-sky|green|violet|teal`); pemakaian `secondary-brand|green|violet|destructive` dan tombol aksi `secondary` dimigrasi per berkas sesuai tabel di bawah; varian lama dihapus di akhir.

**Tech Stack:** React 19, Tailwind 4, Untitled UI Button (React Aria).

**Spec:** `docs/superpowers/specs/2026-10-15-tombol-solid-design.md`

## Global Constraints

- Peta warna dan aturan di spec berlaku; Batal/Kembali/Hapus semua filter/Pilih Semua/Batal Semua/Kembalikan ke Default/Tutup kamera tetap `secondary`.
- Hanya ubah prop `color` (dan `size` bila disebut); jangan menyentuh logika, `onPress`, `href`, atau `aria-label`. Nomor baris di tabel adalah petunjuk; cocokkan lewat teks tombol/`aria-label` di sekitarnya.
- Jangan jalankan Prettier pada berkas halaman (kode proyek tidak diformat Prettier; diff harus hanya perubahan `color`).
- Commit tanpa Co-Authored-By/atribusi Claude, path eksplisit, di `main`, tanpa push.

## Review Focus

- Cetak label Aset saat `overLimit` (override amber) masih terbaca setelah varian jadi `primary-violet`.
- Tombol ikon-saja per baris tetap ber-`aria-label` dan muat di kartu mobile 375 px.
- Tombol disabled/loading pada varian baru jelas (opacity 50% dari kelas umum; spinner mengikuti warna teks).
- Kolom Aksi tabel dengan tiga tombol solid tidak meluber.
- Makna aksi tidak bergantung pada warna saja (penuaan lensa mata mempersulit biru/teal/ungu): tiap aksi punya ikon konsisten (Lihat mata, Ubah pensil, Hapus tong sampah, Cetak printer, Unduh unduh); tombol berlabel teks diberi ikon bila belum.
- `primary-sky` cukup berbeda dari `primary` (Sapphire) saat berdampingan (mis. Cari di samping Tambah); bila tidak, ganti `primary-sky` ke cyan-700/800 (satu baris).
- Semua tombol Hapus solid merah memicu dialog konfirmasi (tidak ada hapus langsung).
- Target ketuk tombol per baris `sm` di layar 375 px memadai; bila sulit ditekan, naikkan ke `md` hanya di kartu mobile.

---

### Task 1 (Tahap 1 – Varian baru + Aset, Pegawai, Kategori, Penerimaan, Profil)

**Files:**
- Modify: `resources/js/Components/ui/base/buttons/button.tsx`, `resources/js/Components/ImportExportButtons.tsx`, `resources/js/Pages/Assets/{Index,Show}.tsx`, `resources/js/Pages/Pegawai/{Index,Show}.tsx`, `resources/js/Pages/Pegawai/Partials/PegawaiForm.tsx`, `resources/js/Pages/AssetCategories/Index.tsx`, `resources/js/Pages/Penerimaan/{Index,Show,PenerimaanForm}.tsx`, `resources/js/Pages/Profile/Partials/{ProfileDetails,ProfilePhoto,ChangePhotoDialog,SessionsCard}.tsx`, `resources/js/Pages/Dashboard.tsx`

**Interfaces:**
- Produces: nilai `color` baru `"primary-sky" | "primary-green" | "primary-violet" | "primary-teal"` (tipe `color` diturunkan otomatis dari `styles.colors`).

- [ ] **Step 1: Tambah varian di `button.tsx`**

Di atas objek `styles`, tambahkan konstanta bersama (kelas ditulis utuh; jangan disusun dari potongan dinamis):
```ts
const SOLID = [
    "text-white shadow-xs-skeuomorphic ring-1 ring-transparent ring-inset",
    // Inner border gradient
    "before:absolute before:inset-px before:border before:border-white/12 before:mask-b-from-0%",
    // Icon styles
    "*:data-icon:text-white",
].join(" ");
```
Lalu di objek `colors`, setelah entri `primary`, tambahkan:
```ts
        "primary-sky": { root: `${SOLID} bg-sky-700 outline-sky-700 hover:bg-sky-800 data-loading:bg-sky-800` },
        "primary-green": { root: `${SOLID} bg-emerald-700 outline-emerald-700 hover:bg-emerald-800 data-loading:bg-emerald-800` },
        "primary-violet": { root: `${SOLID} bg-violet-700 outline-violet-700 hover:bg-violet-800 data-loading:bg-violet-800` },
        "primary-teal": { root: `${SOLID} bg-teal-700 outline-teal-700 hover:bg-teal-800 data-loading:bg-teal-800` },
```
Biarkan varian lama (`secondary-brand|green|violet|destructive`) untuk sementara (dihapus di Task 2).

- [ ] **Step 2: Migrasi per berkas (hanya ubah `color`)**

| Berkas (teks tombol) | Ke |
|---|---|
| `Components/ImportExportButtons.tsx` — Impor (L21), Ekspor (L27) | `primary-teal` |
| `Pages/Assets/Index.tsx` — Cetak label (L142, `overLimit`), Cetak per baris (L337) | `primary-violet` |
| `Pages/Assets/Index.tsx` — Lihat (L316) | `primary-sky` |
| `Pages/Assets/Index.tsx` — Ubah (L326) | `primary-green` |
| `Pages/Assets/Show.tsx` — Cetak (L78) | `primary-violet` |
| `Pages/Assets/Show.tsx` — Ubah (L82) | `primary-green` |
| `Pages/Pegawai/Index.tsx` — Lihat (L256) | `primary-sky` |
| `Pages/Pegawai/Index.tsx` — Ubah (L266) | `primary-green` |
| `Pages/Pegawai/Index.tsx` — Hapus (L276) | `primary-destructive` |
| `Pages/Pegawai/Show.tsx` — Buat akun (L101) | `primary-sky` |
| `Pages/Pegawai/Show.tsx` — Ubah (L112) | `primary-green` |
| `Pages/Pegawai/Partials/PegawaiForm.tsx` — Ganti Foto (L129) | `primary-teal` |
| `Pages/AssetCategories/Index.tsx` — Tambah subkategori (L144) | `primary-sky` |
| `Pages/AssetCategories/Index.tsx` — Ubah (L191) | `primary-green` |
| `Pages/AssetCategories/Index.tsx` — Hapus (L202) | `primary-destructive` |
| `Pages/Penerimaan/Index.tsx` — Cari (L137), Lihat (L186) | `primary-sky` |
| `Pages/Penerimaan/PenerimaanForm.tsx` — Hapus aset (L156) | `primary-destructive` |
| `Pages/Penerimaan/PenerimaanForm.tsx` — Tambah item (L233), Simpan Draft (L313) | `primary-sky` |
| `Pages/Penerimaan/Show.tsx` — Hapus (L66), Tolak (L87), Batalkan Pengajuan (L77) | `primary-destructive` |
| `Pages/Penerimaan/Show.tsx` — Ubah (L71) | `primary-green` |
| `Pages/Penerimaan/Show.tsx` — Alihkan Approver (L82) | `primary-violet` |
| `Pages/Profile/Partials/ProfileDetails.tsx` — Ubah (L44) | `primary-green` |
| `Pages/Profile/Partials/ProfilePhoto.tsx` — Ganti foto (L38) | `primary-teal` |
| `Pages/Profile/Partials/ProfilePhoto.tsx` — Hapus foto (L41) | `primary-destructive` |
| `Pages/Profile/Partials/ChangePhotoDialog.tsx` — Pilih foto (L45) | `primary-teal` |
| `Pages/Profile/Partials/SessionsCard.tsx` — Keluarkan (L21, L46) | `primary-destructive` |
| `Pages/Dashboard.tsx` — Detail (L336) | `primary-sky` |

Tombol yang tidak disebut (Batal, Hapus semua filter, Kembali, dst.) tidak diubah. Cara aman: tiap baris dikerjakan dengan Edit yang memuat teks tombol/`aria-label` sekitarnya, bukan penggantian global.

- [ ] **Step 3: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -3
git diff --stat
```
Expected: bersih; diff hanya perubahan `color` dan penambahan varian. Cek runtime headless (Playwright; pindahkan `public/hot` sementara ke `public/hot.bak` agar memakai bundel build, lalu kembalikan): Data Aset, Data Pegawai, Kategori, Penerimaan, Profil, dan satu halaman Show; tanpa galat konsol, tanpa scroll horizontal di 375 px, tombol per baris tidak meluber. Lalu:
```bash
git add resources/js/Components/ui/base/buttons/button.tsx resources/js/Components/ImportExportButtons.tsx resources/js/Pages/Assets resources/js/Pages/Pegawai resources/js/Pages/AssetCategories resources/js/Pages/Penerimaan resources/js/Pages/Profile resources/js/Pages/Dashboard.tsx
git commit -m "feat(ui): solid colored action buttons for assets, pegawai, categories, penerimaan, and profile"
```

- [ ] **Step 4: GERBANG TAHAP 1 — berhenti**

Laporkan hasil verifikasi dan minta pengguna menilai: warna per makna aksi, apakah tabel terasa ramai, keterbacaan, 375 px, keyboard/fokus, serta tiga titik dari Review Focus (sky vs Sapphire, ikon pendamping, target ketuk). Bila terlalu ramai, opsi mundur: tombol per baris kembali tint (ubah satu peta). Setelah lolos baru Task 2.

---

### Task 2 (Tahap 2 – Sisa halaman, hapus varian lama, panduan)

**Files:**
- Modify: `resources/js/Pages/AssetMutations/{Index,Show,Create}.tsx`, `resources/js/Pages/AssetReports/{Index,Show,Create}.tsx`, `resources/js/Pages/AssetRequests/{Index,Show}.tsx`, `resources/js/Pages/Persetujuan/Index.tsx`, `resources/js/Pages/Users/{Index,Show,Edit}.tsx`, `resources/js/Pages/Roles/Index.tsx`, `resources/js/Pages/WorkflowSettings/{Index,Edit}.tsx`, `resources/js/Pages/Import/Index.tsx`, `resources/js/Components/ReportFilterBar.tsx`, `resources/js/Pages/Laporan*/Index.tsx` (hanya bila tombol Unduh bukan `primary-teal`), `resources/js/Components/ui/base/buttons/button.tsx`, `docs/PANDUAN_DESAIN_UI_UX_SIBIMA.md`

- [ ] **Step 1: Migrasi per berkas (hanya ubah `color`)**

| Berkas (teks tombol) | Ke |
|---|---|
| `AssetMutations/Index.tsx` — Cari (L109), Lihat (L187) | `primary-sky` |
| `AssetMutations/Create.tsx` — Pilih aset (L340) | `primary-sky` |
| `AssetMutations/Create.tsx` — Hapus item (L421) | `primary-destructive` |
| `AssetMutations/Show.tsx` — Cetak (L76) | `primary-violet` |
| `AssetMutations/Show.tsx` — Tolak (L91), Batalkan Pengajuan (L81) | `primary-destructive` |
| `AssetMutations/Show.tsx` — Alihkan Approver (L86) | `primary-violet` |
| `AssetReports/Index.tsx` — Cari (L124), Lihat (L167) | `primary-sky` |
| `AssetReports/Create.tsx` — Pilih aset (L116) | `primary-sky` |
| `AssetReports/Show.tsx` — Tolak (L76), Batalkan Pengajuan (L66) | `primary-destructive` |
| `AssetReports/Show.tsx` — Alihkan Approver (L71) | `primary-violet` |
| `AssetRequests/Index.tsx` — Cari (L133), Lihat (L172) | `primary-sky` |
| `AssetRequests/Show.tsx` — Tolak (L119), Hapus pilihan (L229), Batalkan Pengajuan (L104), Tutup Permohonan (L114) | `primary-destructive` |
| `AssetRequests/Show.tsx` — Alihkan Approver (L109) | `primary-violet` |
| `Persetujuan/Index.tsx` — Tinjau (L49) | `primary-sky` |
| `Users/Index.tsx` — Cari (L226), Buka Data Pegawai (L183), Lihat (L388) | `primary-sky` |
| `Users/Index.tsx` — Ubah (L398) | `primary-green` |
| `Users/Show.tsx` — Ubah (L117) | `primary-green` |
| `Users/Edit.tsx` — Hapus (L436) | `primary-destructive` |
| `Roles/Index.tsx` — Ubah (L125) | `primary-green` |
| `Roles/Index.tsx` — Hapus (L134) | `primary-destructive` |
| `WorkflowSettings/Index.tsx` — Ubah (L47) | `primary-green` |
| `WorkflowSettings/Edit.tsx` — Hapus langkah (L184) | `primary-destructive` |
| `WorkflowSettings/Edit.tsx` — Tambah (L281) | `primary-sky` |
| `Import/Index.tsx` — Pilih berkas (L121), Unduh template (L134), Unduh laporan error (L225) | `primary-teal` |
| `Components/ReportFilterBar.tsx` — Terapkan filter (L78) | `primary-sky` |
| Tombol "Unduh Excel" di tiga halaman `Laporan*/Index.tsx` (cari lewat `grep -rn "Unduh" resources/js/Pages/Laporan*`) | `primary-teal` |

- [ ] **Step 2: Pastikan tak ada varian lama tersisa, lalu hapus dari `button.tsx`**

```bash
grep -rn 'secondary-brand\|secondary-green\|secondary-violet\|secondary-destructive' resources/js --include=*.tsx --include=*.ts
```
Hasil di luar `button.tsx` harus kosong (jika ada, migrasikan sesuai peta spec atau, bila tombol itu memang netral, ke `secondary`). Lalu hapus entri `"secondary-brand"`, `"secondary-green"`, `"secondary-violet"`, dan `"secondary-destructive"` dari `colors` di `button.tsx`.

- [ ] **Step 3: Panduan UI/UX** — di `docs/PANDUAN_DESAIN_UI_UX_SIBIMA.md` bagian 9 ganti butir **Warna tombol** dengan: "**Warna tombol (solid, satu warna per makna)**: aksi utama `primary` (Sapphire); Lihat/Detail/Tinjau/Cari/Terapkan filter/Tambah inline `primary-sky`; Ubah `primary-green`; Hapus/Tolak/Batalkan Pengajuan/Keluarkan `primary-destructive`; Cetak/Alihkan Approver `primary-violet`; Unduh/Impor/Ekspor/Pilih berkas `primary-teal`; Batal/Kembali/netral `secondary` (abu-abu). Amber hanya untuk peringatan. Badge: `Badge type=\"color\" size=\"sm\" className=\"rounded-sm\"`."

- [ ] **Step 4: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -3
php artisan test --compact --filter='Persetujuan|Mutasi|AssetRequest|AssetReport|Users|Role|Workflow|Import|Laporan'
```
Expected: bersih; hijau. Cek runtime headless seperti Task 1 untuk halaman-halaman di atas. Lalu:
```bash
git add resources/js/Pages resources/js/Components docs/PANDUAN_DESAIN_UI_UX_SIBIMA.md
git commit -m "feat(ui): solid colored action buttons across the remaining pages and drop the old tinted variants"
```

- [ ] **Step 5: Suite penuh dan GERBANG TAHAP 2 — berhenti**

Jalankan suite penuh di latar belakang (`php artisan test --compact`, ±12 menit) dan laporkan. Minta pengguna menilai semua halaman. Setelah lolos: perbarui memori proyek bila perlu dan tanyakan persetujuan sebelum push.

---

## Catatan Self-Review

- Cakupan spec: peta warna (Step 2 kedua Task), varian baru (Task 1 Step 1), hapus varian lama dan panduan (Task 2), Review Focus punya langkah cek runtime.
- Konsistensi: nama varian sama di spec, tabel, dan kode; tipe `color` mengikuti `styles.colors`.
- Risiko: nomor baris bergeser — instruksi mencocokkan lewat teks tombol; override amber pada Cetak label dicek di gerbang.

## Catatan Review (ponytail + impeccable, sudah diterapkan)

- Ponytail: empat varian berbagi konstanta `SOLID` (tanpa salinan enam baris); tabel pemetaan dan dua tahap dipertahankan.
- Impeccable (Operate, pengguna lansia): makna aksi didampingi ikon agar tidak bergantung warna saja; sky vs Sapphire dicek berdampingan; Hapus solid wajib lewat konfirmasi; target ketuk `sm` dicek di 375 px dengan jalan mundur ke `md`.
