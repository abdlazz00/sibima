# Desain: Scan QR Aset

Status: Menunggu review.
Tanggal: 2026-10-03

---

## 1. Konteks & Tujuan

Label PDF aset sudah memuat QR yang berisi URL detail aset (`assets.show`, di balik login). Belum ada halaman untuk memindainya, dan memindai dengan kamera bawaan HP langsung membuka detail lengkap.

Tujuan: pengguna dapat memindai QR aset dari smartphone (atau desktop) dan melihat **ringkasan aman** aset, bukan seluruh data. Detail lengkap hanya dapat dibuka oleh pengguna yang berhak atas unit aset tersebut.

Cakupan: scan lalu ringkasan. Opname/stock-take dan input manual kode tidak termasuk.

## 2. Keputusan yang Sudah Disepakati

| Topik | Keputusan |
|---|---|
| Hasil scan | Kartu ringkasan di halaman scan, bukan lompat ke detail aset. |
| Siapa melihat | Semua pengguna yang login melihat ringkasan, termasuk aset unit lain. Tombol "Lihat detail lengkap" hanya bila `AssetPolicy::view` mengizinkan. |
| Field ringkasan | Nama aset, kode barang, nomor register, merk/tipe, kategori, unit, kondisi, status, pemegang (nama), satu foto utama. Tanpa nilai buku, dokumen, tanggal perolehan, dan riwayat. |
| Isi QR | URL `/scan/{id}` (halaman ringkasan). QR di label PDF diubah ke route ini. Label lama (`/assets/{id}`) tetap dikenali oleh halaman scan di aplikasi. |
| Perangkat | Mobile-first, dipakai dari smartphone. Di desktop tampil di `AuthenticatedLayout` seperti halaman lain, tanpa layout terpisah. |
| Pemindai | Library `jsQR` dengan loop video/canvas sendiri. Tanpa wasm atau CDN, berjalan di iOS dan Android. |
| Akses | Menu "Scan QR" untuk semua role yang login. |

## 3. Backend

### 3.1 Route (grup `auth`)
- `GET /scan` -> `scan.index`: halaman scan dengan kamera, tanpa hasil.
- `GET /scan/{asset}` -> `scan.show`: halaman scan yang sama, dengan ringkasan aset terisi. Ini juga URL yang tertanam di QR, sehingga pemindaian dengan kamera bawaan HP berujung di ringkasan; pengguna yang belum login diarahkan ke login lalu kembali ke URL ini.

### 3.2 `ScanController`
- `index`: render `Scan/Index` dengan `summary = null`.
- `show(int $id)`: render `Scan/Index` dengan `summary` dan `canViewDetail`. Tidak memakai `Gate::authorize('view')` karena ringkasan boleh dilihat semua yang login. `canViewDetail = $user->can('view', $asset)`.
- Id yang tidak ada: tetap merender `Scan/Index` dengan `summary = null` dan `notFound = true`, berstatus HTTP 404 (bukan halaman error bawaan, supaya Inertia tidak menampilkan modal error).

### 3.3 `AssetScanSummary`
Satu kelas kecil dengan satu metode `for(Asset): array`, mengembalikan **daftar field eksplisit** (bukan `toArray()` model), sehingga field sensitif tidak mungkin ikut bocor saat tabel `assets` bertambah kolom:

`id`, `nama_aset`, `kode_barang`, `nomor_register`, `merk_type`, `kategori` (nama subkategori), `unit` (nama), `kondisi`, `status`, `pemegang` (nama atau null), `foto` (URL satu foto utama atau null).

### 3.4 QR label
`QrCodeService::forAsset` memakai `route('scan.show', $asset)` menggantikan `assets.show`. Tidak ada migrasi data; label lama tetap berlaku karena halaman scan mengenali kedua format (bagian 4.2).

## 4. Frontend (Inertia + React)

### 4.1 `Pages/Scan/Index.tsx`
Memakai `AuthenticatedLayout`, breadcrumb dan judul seperti halaman lain. Props: `summary: AssetSummary | null`, `canViewDetail: boolean`, `notFound: boolean`.
- **HP:** kamera di atas dengan bingkai pemindai, kartu ringkasan di bawahnya, tombol "Scan lagi" lebar penuh.
- **Desktop:** dua kolom (kamera kiri, kartu kanan) di dalam layout biasa.
- Kamera menyala saat halaman `/scan` dibuka tanpa ringkasan, memakai kamera belakang (`facingMode: environment`), dimatikan saat QR terbaca atau komponen dilepas.
- Saat halaman dibuka dengan ringkasan (`/scan/{id}`), kamera tidak otomatis menyala; ada tombol "Scan aset lain".
- Kartu ringkasan menampilkan field bagian 3.3, memakai label kondisi/status yang sudah ada, dan tombol "Lihat detail lengkap" ke `assets.show` hanya bila `canViewDetail`.

### 4.2 `lib/qr.ts`
Fungsi murni `assetIdFromQr(text: string): number | null`. Menerima URL yang path-nya cocok `/scan/{id}` atau `/assets/{id}` (host diabaikan; id hanya dicari di server). Selain itu `null`.

### 4.3 Alur dan keadaan galat
1. Loop `requestAnimationFrame` menggambar frame video ke canvas kecil lalu menjalankan `jsQR`.
2. Teks terbaca -> `assetIdFromQr`. `null` -> pesan "QR ini bukan label aset SIBIMA", kamera tetap menyala.
3. Id ditemukan -> `router.get(route('scan.show', id))`. Bila server menjawab `notFound`, kartu menampilkan "Aset tidak ditemukan" dengan tombol "Scan lagi".
4. Kondisi lain, masing-masing dengan teks jelas dan tombol coba lagi: izin kamera ditolak (dengan petunjuk mengizinkan kamera dan catatan bahwa halaman harus HTTPS), tidak ada kamera, kamera dipakai aplikasi lain.

### 4.4 Navigasi
Item "Scan QR" di `navigation.ts` untuk semua role, href `/scan`.

## 5. Dependensi
Tambah `jsqr` (npm). Tidak ada dependensi PHP baru (`bacon/bacon-qr-code` sudah ada).

## 6. Pengujian (Pest)
- `scan.show` untuk aset di cakupan unit: ringkasan hanya berisi field bagian 3.3, `canViewDetail = true`.
- `scan.show` untuk aset unit lain: ringkasan tampil, `canViewDetail = false`, tidak ada `nilai_buku`, `no_dokumen`, `tanggal_perolehan`, atau `histories` di props.
- Setiap role login (kasubag, camat, admin, lurah) dapat membuka `/scan`; tanpa login diarahkan ke login.
- Id tidak ada -> status 404 dengan `notFound = true` dan `summary = null`.
- `AssetScanSummary` mengembalikan tepat kumpulan kunci yang diizinkan (guard terhadap kebocoran field baru).
- `QrCodeService::forAsset` menghasilkan QR untuk `scan.show` (data URI valid), dan test label PDF yang ada tetap hijau.
- Frontend: `tsc` dan build, plus cek manual di browser desktop dan HP (HTTPS atau tunnel): scan QR label baru, scan label lama (`/assets/{id}`), QR asing, aset unit lain, kamera ditolak.

## 7. Di Luar Cakupan
Opname/stock-take, input manual kode atau nomor register, scan massal, pemindaian QR yang bukan URL, mode offline/PWA, dan pencetakan ulang label lama.
