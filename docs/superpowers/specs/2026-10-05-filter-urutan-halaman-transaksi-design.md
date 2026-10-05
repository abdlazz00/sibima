# Desain: Kartu Filter, Pencarian di Tabel, dan Urutan untuk Halaman Transaksi

Status: Menunggu review.
Tanggal: 2026-10-05

Menerapkan pola halaman Data Aset (kartu filter berupa grid dropdown, pencarian di baris atas kartu tabel, dropdown "Urutkan") ke empat halaman daftar transaksi: Penerimaan Aset, Mutasi Aset, Permohonan Aset, dan Lapor Rusak/Hilang. Sekaligus memperbaiki pencarian dan filter jenis di Mutasi Aset yang sekarang tidak berfungsi.

---

## 1. Konteks & Tujuan

Halaman Data Aset sudah memakai kartu filter (grid dropdown rata), pencarian di dalam kartu tabel, dan dropdown Urutkan. Pengguna ingin keempat halaman transaksi seragam dengan pola itu.

Kondisi kode saat ini:
- **Penerimaan Aset** (`PenerimaanAsetController::index`): pencarian, Status, Dari tanggal, Sampai tanggal, dan tautan "Reset filter" melayang tanpa kartu. Urutan tetap: `tanggal_penerimaan` desc lalu `id` desc.
- **Mutasi Aset** (`AssetMutationController::index` dan `AssetMutationRepository::paginateForUser`): halaman memakai kotak pencarian dan deretan tombol pil per jenis alur, **tetapi backend tidak membaca `search` maupun `jenis`** dan tidak mengirim prop `filters`. Akibatnya pencarian dan filter jenis tidak berpengaruh pada hasil. Repositori juga tidak memanggil `withQueryString()`, sehingga pindah halaman membuang parameter apa pun. Urutan tetap: `tanggal_mutasi` desc lalu `id` desc.
- **Permohonan Aset** (`AssetRequestController::index`): pencarian, Status, Jenis, dan tombol "Menunggu Pemenuhan". Urutan tetap `id` desc.
- **Lapor Rusak/Hilang** (`AssetReportController::index`): pencarian, Status, Jenis. Urutan tetap: `tanggal_kejadian` desc lalu `id` desc.
- Tidak ada pengurutan yang dapat dipilih di keempatnya.

Tujuan:
1. Keempat halaman memakai kartu filter yang sama dengan Data Aset, dan pencarian pindah ke baris atas kartu tabel.
2. Setiap halaman mendapat dropdown "Urutkan" dengan opsi Terbaru (default, urutan sekarang) dan Terlama.
3. Pencarian dan filter jenis di Mutasi Aset benar-benar bekerja.
4. Kode komponen tidak berulang di empat halaman.

Di luar cakupan: Data Aset (sudah selesai), halaman menu Laporan (sudah punya pengurutan lewat header kolom), Pegawai, Pengguna, opsi urutan selain terbaru/terlama, dan filter status baru di Mutasi Aset.

---

## 2. Keputusan yang Disepakati

| Topik | Keputusan |
|---|---|
| Pendekatan | Komponen kecil bersama di frontend dan satu kelas pendukung di backend; Data Aset tidak diubah. |
| Opsi urutan | `terbaru` (default, urutan sekarang) dan `terlama`, dengan `id` sebagai pembeda. |
| Mutasi Aset | Tombol pil jenis alur diganti dropdown "Semua Alur" di kartu filter. |
| Kartu filter | Grid 1/2/4 kolom, gaya sama dengan Data Aset. |
| Pencarian | Dipindah ke baris pertama di dalam kartu tabel (`max-w-sm`), seperti Data Aset. |
| Nilai `urut` tak dikenal | Jatuh ke default tanpa error 422. |

---

## 3. Desain Backend

### 3.1 `App\Support\ListSort`

Kelas statis kecil (tanpa state):
- `ListSort::apply(Builder $query, array $sorts, mixed $key): Builder` menerapkan `order` dari `$sorts[$key]`; bila `$key` bukan string, kosong, atau tak ada di daftar, memakai kunci pertama (`terbaru`).
- `ListSort::options(array $sorts): array` mengembalikan `[{value, label}]`.

Format `$sorts` sama dengan `Asset::SORTS`: `kunci => ['label' => string, 'order' => list<[kolom, arah]>]`. Karena `apply` hanya mencocokkan `$key` sebagai kunci array dan kolom berasal dari daftar tetap, nilai dari request tidak pernah menjadi nama kolom.

### 3.2 Daftar urutan per halaman

Setiap controller mendefinisikan konstanta `SORTS` sendiri dengan dua kunci:

| Halaman | `terbaru` | `terlama` |
|---|---|---|
| Penerimaan (`BeritaAcaraPenerimaan`) | `tanggal_penerimaan` desc, `id` desc | `tanggal_penerimaan` asc, `id` asc |
| Mutasi (`AssetMutation`) | `tanggal_mutasi` desc, `id` desc | `tanggal_mutasi` asc, `id` asc |
| Permohonan (`AssetRequest`) | `id` desc | `id` asc |
| Lapor (`AssetReport`) | `tanggal_kejadian` desc, `id` desc | `tanggal_kejadian` asc, `id` asc |

Label: "Terbaru" dan "Terlama". Permohonan memakai `id` karena tidak ada kolom tanggal pengurut yang lebih tepat; `id` mengikuti urutan dibuat.

### 3.3 Perubahan controller

- Di setiap `index`, pemanggilan `->latest(...)->latest('id')` diganti `ListSort::apply($query, self::SORTS, $request->input('urut'))`, `'urut'` ditambah ke daftar `$request->only(...)` untuk prop `filters`, dan `sortOptions` dikirim ke halaman.
- **Mutasi Aset** (perbaikan fungsional): `AssetMutationController::index` membaca `search`, `jenis`, dan `urut` lalu meneruskannya ke `AssetMutationRepository::paginateForUser(User $user, array $filters, int $perPage = 15)`:
  - `search` mencocokkan `nomor_mutasi`, nama aset pada item (`items.asset.nama_aset`), serta nama unit asal dan tujuan (`like`, sesuai placeholder halaman "Cari no. mutasi, nama aset, atau unit...").
  - `jenis` memfilter `jenis_mutasi`.
  - Hasil dipaginasi dengan `->withQueryString()` agar filter dan urutan bertahan antar halaman.
  - Controller mengirim prop `filters` (`search`, `jenis`, `urut`).
- Hak akses (`accessibleUnitIds`, aturan per peran) dan semua filter lain di keempat controller tidak berubah.

---

## 4. Desain Frontend

### 4.1 Komponen bersama

Satu berkas `resources/js/Components/ListFilters.tsx` dengan tiga ekspor:
- `FilterCard`: kartu `rounded-xl border border-slate-200 bg-white p-4 shadow-sm` berisi grid `grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4`.
- `FilterSelect`: `<select>` dengan ikon `ChevronDown`, gaya dan kelas sama dengan dropdown di Data Aset; menerima `value`, `onChange`, `ariaLabel`, dan `children` (opsi).
- `TableSearch`: form pencarian untuk baris atas kartu tabel (ikon `Search`, input, tombol `X` penghapus), `max-w-sm`, `aria-label` pada input; menerima `value`, `onChange`, `onSubmit`, `onClear`, `placeholder`.

Data Aset tidak dimigrasikan ke komponen ini dalam pekerjaan ini.

### 4.2 Per halaman

- **Penerimaan:** kartu berisi Status, Dari tanggal, Sampai tanggal (keduanya input `type="date"` berlabel kecil di atas), dan Urutkan; tautan "Reset filter" tetap tampil di kartu bila ada filter aktif. Pencarian pindah ke kartu tabel.
- **Mutasi:** kartu berisi Jenis Alur (dropdown "Semua Alur" ditambah lima jenis) dan Urutkan; tombol pil dihapus. Pencarian pindah ke kartu tabel. State lokal `selectedType` dihapus; nilai berasal dari `filters.jenis`.
- **Permohonan:** kartu berisi Status, Jenis, Urutkan, dan pengalih "Menunggu Pemenuhan" (tombol yang sama, kini di dalam grid). Pencarian pindah ke kartu tabel.
- **Lapor Rusak/Hilang:** kartu berisi Status, Jenis, Urutkan. Pencarian pindah ke kartu tabel.
- Mengubah kontrol memuat ulang ke halaman 1 dan menyimpan pilihan di URL; pencarian tetap tertunda 400 ms di halaman yang sudah memakainya (perilaku tiap halaman dipertahankan).
- Dropdown Urutkan berlabel "Urutkan: {label}" dengan `aria-label="Urutkan"`, nilai awal dari `filters.urut ?? 'terbaru'`; memilih `terbaru` menghapus `urut` dari URL.

---

## 5. Pengujian

Pest (SQLite `:memory:`), test ditulis lebih dulu:
- `ListSort` (unit): menerapkan urutan yang benar, kunci tak dikenal/kosong/array jatuh ke default, `options` mengembalikan label.
- Tiap halaman (Feature): `terbaru` dan `terlama` mengurutkan benar dengan pembeda `id` saat tanggal sama; `urut` bertahan di halaman 2 (`next_page_url`); cakupan unit/peran tidak berubah.
- Mutasi Aset: `search` menemukan berdasarkan nomor mutasi, nama aset, dan nama unit; `jenis` menyaring; filter dan `urut` bertahan antar halaman; pengguna tetap hanya melihat mutasi unitnya.
- Frontend: `npx tsc --noEmit` dan `npm run build`. Cek visual menunggu perintah pengguna.

---

## 6. Risiko & Catatan

- Pencarian dan filter jenis di Mutasi Aset yang sebelumnya tidak berfungsi kini aktif; ini perubahan perilaku yang disengaja (perbaikan bug), bukan hanya tampilan.
- Pencarian Mutasi menggabung `like` pada relasi item dan unit; tabel mutasi kecil dan sudah dibatasi cakupan unit, sehingga biayanya wajar.
- Dropdown Jenis Alur menggantikan tombol pil: semua jenis tetap dapat dipilih, hanya tidak lagi tampil sekaligus.
- Menambah opsi urutan di masa depan cukup menambah baris pada `SORTS` halaman terkait.
