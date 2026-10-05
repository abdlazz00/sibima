# Desain: Pencarian di Dalam Kartu Tabel Data Aset

Status: Menunggu review.
Tanggal: 2026-10-05

Memindahkan kotak pencarian halaman Data Aset (`/assets`) dari kartu filter ke baris atas kartu tabel, sehingga kartu filter fokus ke filter dan pengurutan. Perubahan tampilan murni.

---

## 1. Konteks & Tujuan

Saat ini `Assets/Index.tsx` menaruh pencarian, tiga filter, dan dropdown Urutkan dalam satu kartu "Filter Toolbar" di atas tabel. Pengguna meminta pencarian digabung ke tabel (seperti pola tabel dengan kotak pencarian di header kartu) agar bagian atas fokus ke filter dan pengurutan.

Tujuan:
1. Kotak pencarian berada di dalam kartu tabel, di atas header kolom.
2. Kartu filter hanya berisi Kategori, Unit, Kondisi, dan Urutkan.
3. Perilaku pencarian tidak berubah.

Di luar cakupan: halaman daftar lain (Pegawai, Penerimaan, Mutasi, Permohonan, Lapor Rusak/Hilang, Pengguna), komponen bersama untuk pola ini, perubahan backend, route, atau test PHP.

---

## 2. Keputusan yang Disepakati

| Topik | Keputusan |
|---|---|
| Cakupan | Hanya halaman Data Aset; halaman lain menyusul bila hasilnya disukai. |
| Letak pencarian | Baris pertama di dalam kartu tabel, sebelum `<thead>`, lebar maksimal sekitar 384px, dengan garis pemisah ke header kolom. |
| Kartu filter | Grid rata: 1 kolom di ponsel, 2 di tablet (`sm`), 4 di layar lebar (`lg`); setiap dropdown selebar kolomnya. |
| Tombol Cetak Label, Impor, Ekspor, Tambah Aset | Tidak berubah, tetap di pojok kanan atas halaman. |

---

## 3. Desain

Semua perubahan di `resources/js/Pages/Assets/Index.tsx`:

- Blok `<form onSubmit={submitSearch}>` (ikon `Search`, input, tombol `X`) dipindah apa adanya dari "Filter Toolbar" ke dalam kartu `Data Table`, sebagai baris pertama sebelum `overflow-x-auto`. Pembungkusnya `border-b border-slate-200 p-4`, dan form diberi `max-w-sm` agar tidak melebar. Isi form tidak berubah.
- State `search`, efek tertunda 400 ms, `submitSearch`, dan pembersihan lewat `X` tidak diubah; `search` tetap ikut `filters` dan URL.
- "Filter Toolbar" menjadi `grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4`. Pembungkus `flex flex-wrap` dan `min-w-[...]` pada tiap dropdown diganti selebar kolom (`w-full`), tanpa mengubah gaya `<select>`.
- Pesan "tidak ada data" di tabel tidak berubah, jadi pencarian tanpa hasil tetap tampil di dalam tabel.

Atribut aksesibilitas input pencarian (tipe, placeholder "Cari nama barang, kode BMD, atau dokumen...") dipertahankan; ditambah `aria-label="Cari aset"` karena tidak ada label teks terlihat.

---

## 4. Pengujian

- `npx tsc --noEmit` dan `npm run build` bersih.
- Tidak ada test PHP baru: tidak ada perubahan backend; pengurutan, filter, dan paginasi sudah diuji di `AssetSortTest` dan `AssetBrowseTest`.
- Pengecekan visual (lebar penuh, tablet, ponsel, dan pencarian aktif dengan tombol X) menunggu perintah pengguna.

---

## 5. Risiko & Catatan

- Tinggi kartu tabel bertambah satu baris; tidak berpengaruh ke fungsi.
- Pada layar sempit input pencarian mengisi lebar kartu (batas `max-w-sm` hanya berlaku di layar lebar).
- Kartu filter tetap tampil walau pencarian aktif; filter dan pencarian saling melengkapi seperti sebelumnya.
