# Tombol Solid Berwarna di Seluruh Aplikasi — Desain

Tanggal: 2026-10-15. Lanjutan tampilan Dashboard/Laporan berwarna. Frontend saja; tidak ada perubahan backend, route, atau data.

## Tujuan

Pengguna SIBIMA banyak yang berusia lanjut dan ingin tampilan yang berwarna dan mudah dikenali. Tombol pintasan Dashboard yang solid berwarna dinilai berhasil. Semua tombol aksi di halaman Index, Show, form, Profil, Import, dan Laporan kini dibuat solid berwarna dengan satu warna per makna aksi, kecuali Batal dan tombol netral.

## Keputusan (semua dari pengguna)

- Cakupan: **semua tombol aksi solid**, termasuk tombol per baris tabel (pengguna memilih ini setelah diperingatkan bahwa tabel padat bisa terasa ramai; mundur dimungkinkan karena warna dikendalikan satu tempat).
- Peta warna disetujui: aksi utama biru Sapphire; Lihat/Detail biru langit; Ubah hijau; Hapus/Tolak merah; Cetak ungu; Unduh/Impor/Ekspor teal.
- **Batal dan tombol netral tetap abu-abu polos** (`secondary`).
- Dua tahap bergerbang; Tahap 2 tidak dimulai sebelum pengguna menyatakan Tahap 1 lolos.

## Global Constraints

- Bahasa UI Indonesia; font Figtree; kontras teks putih pada warna solid minimal WCAG AA (sky-700, emerald-700, teal-700, violet-700, red memenuhi).
- Hanya Tailwind palette bawaan; tidak ada dependensi baru.
- Tombol per baris tabel memakai ukuran `sm` (yang sudah dipakai sekarang); tidak membesarkan ukuran.
- Amber tetap hanya untuk peringatan; tidak dipakai sebagai warna tombol aksi (override amber pada tombol Cetak label saat melebihi batas dipertahankan).
- Tombol ikon-saja tetap wajib `aria-label`.

## Peta warna (satu makna = satu varian)

| Makna | Varian `Button` | Warna |
|---|---|---|
| Aksi utama (Tambah, Catat, Simpan, Kirim, Setujui, Buat) | `primary` (sudah ada) | Sapphire |
| Lihat, Detail, Tinjau, Cari, Terapkan filter, Tambah (inline), Pilih aset, Buat akun, Simpan Draft | `primary-sky` (baru) | sky-700 |
| Ubah / Edit | `primary-green` (baru) | emerald-700 |
| Hapus, Tolak, Batalkan Pengajuan, Tutup Permohonan, Keluarkan | `primary-destructive` (sudah ada) | red |
| Cetak, Alihkan Approver | `primary-violet` (baru) | violet-700 |
| Unduh, Impor, Ekspor, Pilih berkas/foto, Ganti foto | `primary-teal` (baru) | teal-700 |
| Batal, Kembali, Hapus semua filter, Pilih/Batal Semua, Kembalikan ke Default, Tutup kamera | `secondary` (tetap) | abu-abu |

Varian baru berstruktur sama dengan `primary` (teks putih, bayangan tipis, garis dalam, fokus jelas, ikon putih). Varian lama `secondary-brand`, `secondary-green`, `secondary-violet` (dan `secondary-destructive` bila tak lagi dipakai) dihapus setelah semua pemakaian dimigrasi, agar tidak ada kode mati.

## Tahap

- **Tahap 1:** varian baru + komponen bersama (Impor/Ekspor) + Aset, Pegawai, Kategori Aset, Penerimaan, Profil, dan tombol Detail di Dashboard.
- **Tahap 2:** Mutasi, Permohonan, Lapor Rusak/Hilang, Persetujuan, Pengguna, Role, Pengaturan Alur, Import, filter laporan dan tombol Unduh di tiga Laporan; hapus varian lama; perbarui panduan UI/UX bagian 9 (aturan warna tombol).

## Review Focus

- Tombol Cetak label di Aset (`overLimit`) memakai override amber: tetap terbaca dan berbeda dari varian ungu normal.
- Tombol ikon-saja (Lihat/Hapus per baris) tetap punya `aria-label` dan target ketuk memadai di 375 px.
- Tombol `isDisabled` dan `isLoading` pada varian baru tampil jelas (opacity/spinner) dan tidak terlihat aktif.
- Baris tabel dengan tiga tombol solid tidak meluber di 375 px (kartu mobile) dan tidak membuat kolom Aksi terlalu lebar di desktop.
- Tidak ada pemakaian varian lama tersisa setelah migrasi (grep kosong) dan `tsc` bersih (tipe `color` diturunkan dari daftar varian).

## Pengujian

Tidak ada logika baru, jadi tidak ada tes Pest baru; tes yang ada harus tetap hijau. Verifikasi: `npx tsc --noEmit`, `npm run build`, grep varian lama, dan cek runtime headless per halaman (tanpa galat konsol, tanpa scroll horizontal di 375 px). Penilaian visual oleh pengguna di tiap gerbang.

## Di luar cakupan

Badge, tab, tautan (`link-color`), tombol `tertiary`, dialog selain warna tombolnya, mode gelap.
