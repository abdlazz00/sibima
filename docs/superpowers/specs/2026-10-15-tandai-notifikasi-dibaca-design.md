# Tandai Notifikasi Telah Dibaca dan Halaman Notifikasi — Desain

Tanggal: 2026-10-15. Fitur baru di atas sistem notifikasi database yang sudah ada (`ApprovalStepNotification`, lonceng di `AuthenticatedLayout`, rute `notifications.read`).

## Tujuan

Pengguna kini hanya bisa menandai notifikasi terbaca dengan mengklik item di lonceng (yang sekaligus membuka dokumen), dan notifikasi yang sudah dibaca langsung hilang tanpa riwayat. Fitur ini menambah: tandai semua dibaca, tandai per item tanpa membuka dokumen, tandai kembali sebagai belum dibaca, dan halaman riwayat lengkap.

## Keputusan (semua dari pengguna)

- Cakupan: **dropdown lonceng + halaman Notifikasi** (bukan hanya tombol tandai semua).
- Dropdown tetap hanya menampilkan notifikasi **belum dibaca** (maksimal 5); riwayat lengkap hanya di halaman `/notifikasi`.
- Halaman Notifikasi **hanya ditautkan dari dropdown lonceng**, tanpa menu baru di sidebar.
- **Satu tahap** (fitur kecil): backend + dropdown + halaman, lalu pengguna menilai.

## Global Constraints

- Bahasa UI Indonesia; font Figtree; kontras dan ukuran teks untuk pengguna usia lanjut (teks isi notifikasi minimal 14px).
- Pemilik data: semua query dibatasi ke notifikasi milik pengguna yang login; ID milik pengguna lain menghasilkan 404.
- Warna tombol mengikuti aturan yang ada: aksi positif "Tandai dibaca" `primary-green`; "Buka" `primary-sky`; "Tandai belum dibaca" (membatalkan) `secondary` abu-abu.
- Pagination memakai `PaginationCardMinimal` dan `PerPage` (daftar putih 10/15/25/50/100, bawaan 15).
- Tidak ada dependensi baru, tidak ada migrasi (memakai kolom `read_at` bawaan tabel `notifications`).

## Backend

`NotificationController` (rute di grup `auth`):

- `GET /notifikasi` → `notifications.index`: halaman Inertia `Notifikasi/Index`. Query `filter` (`semua` | `belum`, bawaan `semua`) dan `per_page`/`page`. Mengirim `items` (paginator dengan baris `{ id, message, url, dibaca, waktu (ISO), relatif }`) dan `filters` (`{ filter, per_page }`).
- `POST /notifications/read-all` → `notifications.read-all`: menandai semua notifikasi belum dibaca milik pengguna sebagai terbaca; `back()` dengan flash sukses.
- `POST /notifications/{notification}/mark` → `notifications.mark`: isian `dibaca` (boolean, wajib); menandai dibaca atau belum dibaca; `back()` tanpa redirect ke dokumen; 404 bila bukan milik pengguna.
- Rute lama `notifications.read` (tandai + buka dokumen) **tidak berubah**.

## Frontend

- **Dropdown lonceng** (`AuthenticatedLayout.tsx`): header memuat tombol "Tandai semua dibaca" (hanya bila ada belum dibaca); tiap item punya tombol kecil berikon centang "Tandai dibaca" (`aria-label` memuat isi notifikasi) di samping isi yang masih bisa diklik untuk membuka dokumen; footer berisi tautan "Lihat semua notifikasi". Lebar popover dan teks sedikit diperbesar (teks isi 14px).
- **Halaman `/notifikasi`** (`Pages/Notifikasi/Index.tsx`): `PageHeader` (breadcrumb + judul + tombol "Tandai semua dibaca"), tab filter Semua / Belum dibaca (mengubah query `filter`), daftar item (belum dibaca: titik biru dan teks tebal; sudah dibaca: redup), tiap item menampilkan pesan, waktu relatif dan tanggal lengkap, tombol "Buka" (bila ada tautan; sekaligus menandai dibaca lewat rute lama) dan "Tandai dibaca" atau "Tandai belum dibaca", keadaan kosong tertulis, dan `PaginationCardMinimal` dengan pemilih per halaman.
- Tipe baru `NotificationRow` di `types/index.d.ts`.

## Review Focus

- Notifikasi milik pengguna lain tidak bisa ditandai/dilihat (404 / tidak muncul di daftar).
- "Tandai semua dibaca" hanya memengaruhi notifikasi pengguna sendiri dan tidak menyentuh yang sudah dibaca.
- Menandai dibaca di dropdown tidak berpindah halaman dan memperbarui hitungan lonceng.
- Notifikasi tanpa `url` (null) tidak menampilkan tombol Buka dan tidak galat.
- Filter "Belum dibaca" dan pagination tetap konsisten setelah menandai (halaman tidak kosong bila item terakhir di halaman ditandai: tetap bisa ditangani oleh pindah ke halaman 1 atau tampilan kosong yang jelas).
- 375 px: tombol per item tidak meluber; popover tidak melebihi lebar layar.

## Pengujian

Tes fitur Pest: halaman memuat milik sendiri saja (semua/belum dibaca, pagination `per_page`), tandai dibaca dan belum dibaca, tandai semua hanya milik sendiri, 404 untuk milik orang lain, validasi `dibaca`. Frontend: `tsc`, build, cek runtime headless; penilaian visual oleh pengguna.

## Di luar cakupan

Menghapus notifikasi, notifikasi real-time/polling, pengaturan preferensi notifikasi, menu sidebar baru, email notifikasi.
