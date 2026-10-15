# Pagination Card Minimal Rata Kanan dengan Pemilih Per Halaman — Desain

Tanggal: 2026-10-15. Lanjutan pembaruan tampilan aplikasi. Backend kecil (parameter `per_page`) + frontend.

## Tujuan

Mengganti tampilan pagination di halaman daftar dan laporan ke format `PaginationCardMinimal` rata kanan seperti contoh Untitled UI yang dilampirkan pengguna: di kiri "Halaman X dari Y" dan pemilih "N per halaman", di kanan tombol Sebelumnya/Berikutnya. Semua teks berbahasa Indonesia.

## Keputusan (semua dari pengguna)

- Pakai `PaginationCardMinimal`, tata letak rata kanan; **pemilih jumlah per halaman ikut dipasang** (backend menerima `per_page`).
- Keterangan jumlah total ("· 148 aset") menggantikan baris "Menampilkan x-y dari N" yang sekarang ada.
- Tombol Sebelumnya/Berikutnya tetap **abu-abu polos** (`secondary`), seperti contoh dan aturan bahwa tombol netral tidak solid berwarna.
- Dua tahap bergerbang; Tahap 2 tidak dimulai sebelum pengguna menyatakan Tahap 1 lolos.

## Global Constraints

- Bahasa UI Indonesia; font Figtree; angka `tabular-nums` bila menampilkan jumlah.
- Pilihan per halaman server-side: daftar putih **10, 15, 25, 50, 100**; nilai lain jatuh ke bawaan halaman (15 untuk daftar, 25 untuk laporan). Tidak ada dependensi baru.
- `per_page` tidak boleh mengubah data yang diekspor (unduhan Excel tetap memakai filter tanpa `per_page`).
- Tombol navigasi: ukuran `md`, `isDisabled` pada halaman pertama/terakhir, `aria-label` jelas di mobile.
- Modal Pilih Aset tidak diubah (tetap `PaginationPageDefault`).

## Komponen

`PaginationCardMinimal` (`Components/ui/application/pagination/pagination.tsx`) ditulis ulang:

- Props: `page`, `total` (jumlah halaman), `pageSize`, `pageSizes?: number[]` (pemilih hanya tampil bila ada), `totalItems?: number`, `itemLabel?: string`, `onPageChange`, `onPageSizeChange`, `className`. Prop `align` dihapus (selalu: info kiri, tombol kanan).
- Desktop: `Halaman {page} dari {total}` + (`· {totalItems} {itemLabel}`) + pemilih "N per halaman" di kiri; Sebelumnya/Berikutnya di kanan.
- Mobile (<md): baris tombol panah + "Halaman X dari Y", lalu baris kecil jumlah total + pemilih.
- Perbaikan bug bawaan: batas halaman 1..total (bukan 0), `onPress` (bukan `onClick`), `isDisabled` saat di batas.
- `MobilePagination` ikut diterjemahkan.
- Kartu tetap tampil walau hanya satu halaman selama ada data (agar jumlah per halaman bisa diganti); halaman memutuskan kapan menyembunyikannya (data kosong).

## Backend

- `App\Support\PerPage::resolve(Request $request, int $default = 15): int` dengan `PerPage::OPTIONS = [10, 15, 25, 50, 100]`.
- Dipakai di: Aset (`AssetController` → repository), Mutasi (`AssetMutationController` → repository), Lapor Rusak/Hilang, Permohonan, Penerimaan, Pengguna (bawaan 15), dan tiga Laporan (`LaporanAset|Mutasi|RusakHilang`, bawaan 25 = `PER_PAGE` yang ada).
- Untuk halaman daftar, `per_page` yang sudah divalidasi ikut dalam `filters` yang dikirim ke klien (supaya terbawa saat mencari/memfilter/pindah halaman). Untuk laporan, `per_page` dibaca dari `paginator.per_page` dan dibawa oleh `useLaporanFilters` (tidak masuk `filters` agar tidak masuk unduhan).

## Pemasangan

- Server-side dengan pemilih: Aset, Mutasi, Lapor Rusak/Hilang, Permohonan, Penerimaan, Pengguna, dan tabel rinci di tiga Laporan (`ReportDetailTable` bersama).
- Client-side: **Pegawai** (pemilih 6/12/24/48 yang ada dipindah ke komponen; kartu foto), **Kategori Aset** (tanpa pemilih; 5 kategori induk per halaman), **Tab Aktivitas Profil** (tanpa pemilih; 15 per halaman tetap).
- Baris "Menampilkan x-y dari N" di footer tiap tabel dihapus (informasi pindah ke keterangan total).

## Tahap

- **Tahap 1:** backend (helper + semua controller + tes), komponen baru, dan halaman Aset sebagai percontohan.
- **Tahap 2:** Mutasi, Lapor Rusak/Hilang, Permohonan, Penerimaan, Pengguna, tiga Laporan, Pegawai, Kategori Aset, tab Aktivitas Profil.

## Review Focus

- `per_page` di luar daftar putih (`7`, `-1`, `abc`, `1000`) jatuh ke bawaan tanpa error.
- Mengganti jumlah per halaman kembali ke halaman 1 dan mempertahankan pencarian/filter/urutan.
- Pindah halaman setelah ganti jumlah per halaman mempertahankan `per_page`.
- Halaman terakhir kosong/data kosong: kartu tidak tampil untuk data kosong; tombol Berikutnya nonaktif di halaman terakhir.
- Unduhan Excel laporan tidak ikut membawa `per_page`.
- 375 px: pemilih dan tombol tidak meluber; kartu mobile tetap bisa dipakai.

## Pengujian

Tes unit untuk `PerPage` (bawaan, daftar putih, nilai tak valid, string angka) dan tes fitur untuk Aset dan Laporan Aset (per_page sah berlaku, tak sah jatuh ke bawaan, `filters.per_page` terkirim). Tes lama harus tetap hijau. Frontend: `tsc`, build, dan cek runtime headless per halaman; penilaian visual oleh pengguna di tiap gerbang.

## Di luar cakupan

Modal Pilih Aset, mengubah daftar putih per halaman per halaman, menyimpan pilihan per halaman per pengguna, pagination tampil di atas tabel.
