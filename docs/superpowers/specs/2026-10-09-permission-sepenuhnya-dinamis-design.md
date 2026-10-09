# Desain: Semua Hak Akses Dikelola dari Menu Pengaturan Role

Status: Menunggu review.
Tanggal: 2026-10-09

Menutup celah antara apa yang ditampilkan menu Pengaturan Role dan apa yang benar-benar ditegakkan kode: menghapus permission "hantu", menegakkan yang bermakna, mengganti nama role yang tertanam di aturan bisnis dengan permission atau penanda di role, dan memastikan seeder tidak menimpa perubahan dari menu Role.

---

## 1. Konteks & Tujuan

Hasil audit kode (2026-10-09) menemukan:

1. **Permission hantu** (ada di katalog dan menu Role, tetapi tidak ditegakkan): `penerimaan.delete` (policy `delete()` hanya memanggil `update()`), `penerimaan.submit` (tidak ada cek; pengiriman otomatis saat simpan), `permohonan.close` (aksi `close` memakai policy `fulfill`), `pengaturan.user` (tidak dipakai), `user.reset-password` (ganti password pengguna lain ikut `user.manage-access`), dan `persetujuan.act` (hanya petunjuk tampilan di Dashboard; hak menyetujui ditentukan langkah alur).
2. **Nama role tertanam di aturan bisnis:**
   - `ApprovalWorkflowService::canReassign` hanya mengizinkan role `kasubag`.
   - Langkah "Atasan Unit" (`allowsAtasanUnit`, `atasanRole`) memakai role `camat` untuk unit kecamatan dan `lurah` untuk kelurahan.
   - Perlindungan terkunci keluar memakai nama `kasubag`: `UserController` (tiga tempat) dan `UpdateRoleRequest`.
3. **Seeder menimpa pengaturan dari menu Role:** `PermissionSeeder` memanggil `syncPermissions` untuk lima role sistem pada setiap eksekusi; `RoleSeeder` menimpa `display_name`, `unit_scope`, `description`. `docs/ops/queue-setup.md` menyuruh menjalankan `PermissionSeeder` pada setiap deploy.
4. **Label permission di modal Role** tidak lengkap: `user.view`, `user.manage-access`, `user.toggle-status`, `user.delete`, `user.reset-password` belum punya label.

Yang sudah benar dan tidak diubah: menu sidebar sepenuhnya berbasis permission; semua policy berbasis permission; semua rute fungsional memiliki pemeriksaan hak akses (satu-satunya rute tanpa cek adalah layanan mandiri: login, lupa/reset password, profil, tandai notifikasi dibaca); cek impor/ekspor dinamis `import-{modul}`/`export-{modul}`; cakupan unit per role (`unit_scope`); approver alur dapat berupa role apa pun.

Tujuan:
1. Setiap permission di katalog memang ditegakkan; tidak ada hak yang bisa dicentang tetapi tidak berefek.
2. Tidak ada nama role bawaan yang tertanam di kode aturan bisnis; semuanya dapat diatur dari menu Role.
3. Seeder dan deploy tidak menimpa perubahan dari menu Role.
4. Perilaku yang berjalan sekarang tidak berubah untuk lingkungan yang sudah ada (migrasi data menjaga hak yang efektif).

Di luar cakupan: nama role bawaan di `WorkflowDefaults` (tersimpan di database dan dapat diubah di Pengaturan Alur), label tampilan `formatRole()` dan tipe `Role` di `navigation.ts`, tampilan nama role di Dashboard, dan mengubah daftar peran bawaan.

---

## 2. Keputusan yang Disepakati

| Topik | Keputusan |
|---|---|
| `persetujuan.act` | Ditegakkan sebagai syarat tambahan: menyetujui/menolak membutuhkan langkah alur yang menunjuk pengguna **dan** permission ini. |
| Permission hantu lain | Tegakkan `penerimaan.delete`, `permohonan.close`, `user.reset-password`; hapus `penerimaan.submit` dan `pengaturan.user`. |
| Alih tugas persetujuan | Permission baru `persetujuan.reassign`, menggantikan pengecekan role `kasubag`. |
| Atasan unit | Kolom baru `roles.unit_head_of` (kosong/`kecamatan`/`kelurahan`) yang diatur di modal Role. |
| Terkunci keluar | Invarian umum, bukan nama role: selalu ada minimal satu pengguna aktif yang memegang `pengaturan.role` dan `user.manage-access`. |
| Seeder | Hanya mengisi default pada role yang baru dibuat atau belum punya permission; tidak pernah menimpa. |
| Lingkungan yang ada | Satu migrasi data aditif dan idempoten menjaga hak efektif saat ini. |

---

## 3. Desain Backend

### 3.1 Katalog permission

`PermissionSeeder::PERMISSION_GROUPS` tetap menjadi sumber tunggal:
- Dihapus: `penerimaan.submit` (grup Penerimaan Aset), `pengaturan.user` (grup Pengaturan).
- Ditambah: `persetujuan.reassign` (grup Persetujuan).
- Grup lain tidak berubah.

### 3.2 Penegakan per permission

| Permission | Penegakan |
|---|---|
| `penerimaan.delete` | `BeritaAcaraPenerimaanPolicy::delete` = `can('penerimaan.delete')` **dan** aturan kepemilikan yang sama dengan `update` (draf milik unit pembuat). Tidak lagi memanggil `update()`. |
| `permohonan.close` | Policy baru `AssetRequestPolicy::close` memakai `AssetRequestService::canClose` = `can('permohonan.close')` **dan** aturan cakupan yang sama dengan `canFulfill` (bukan permission `fulfill`). `ClosePermohonanRequest::authorize` memanggil `close`; `AssetRequestService::close` dan prop `can.close` pada halaman detail memakai `canClose`. |
| `user.reset-password` | `UpdateUserRequest` menolak (error validasi pada `password`) bila `password` diisi tetapi pelaku tidak memegang `user.reset-password`; form edit pengguna menyembunyikan kolom kata sandi tanpa izin ini (prop dari `UserController`). |
| `persetujuan.act` | `ApprovalWorkflowService::stepAllows` mensyaratkan `$user->can('persetujuan.act')` untuk ketiga tipe approver (`role`, `user`, `atasan_unit`). `canAct`, daftar approver (`candidates`), dan notifikasi memakai pemeriksaan yang sama. Pengaturan Alur menampilkan **peringatan** (bukan penolakan) saat menyimpan langkah yang role-nya tidak memegang izin ini. |
| `persetujuan.reassign` | `canReassign` = `can('persetujuan.reassign')` dan status pending. Daftar penerima alih tugas tidak berubah. |

### 3.3 Pimpinan unit (`roles.unit_head_of`)

- Migrasi menambah `roles.unit_head_of` (`string`, nullable, nilai `kecamatan` atau `kelurahan`); `Role` model memuatnya.
- `StoreRoleRequest` dan `UpdateRoleRequest` memvalidasi `unit_head_of` (`nullable|in:kecamatan,kelurahan`) dan `RoleController` menyimpan serta mengirimnya ke halaman.
- `ApprovalWorkflowService`: `allowsAtasanUnit` benar bila pengguna memegang role dengan `unit_head_of` sama dengan jenis unit pengaju **dan** `canAccessUnit($unit)`. `atasanRole` diganti pencarian pengguna lewat role bertanda yang sesuai (menggantikan `User::role('camat'|'lurah')`).
- `RoleSeeder` mengisi `unit_head_of` untuk `camat` (`kecamatan`) dan `lurah` (`kelurahan`) hanya saat role dibuat.

### 3.4 Invarian terkunci keluar

Kelas pendukung kecil (`App\Support\AccessGuard`) menyediakan satu pertanyaan: "apakah setelah perubahan ini masih ada pengguna aktif yang memegang `pengaturan.role` dan `user.manage-access`?". Dipakai oleh:
- `UserController::toggleStatus` dan `destroy`: menolak bila target adalah pemegang terakhir.
- `UserController::update`: menolak bila perubahan role target (termasuk diri sendiri) melucuti pemegang terakhir.
- `UpdateRoleRequest`: menolak bila pengubahan izin role membuat tidak ada lagi pengguna aktif pemegang kedua izin itu.

Menggantikan seluruh pengecekan nama `kasubag` dan aturan "kasubag harus bercakupan semua unit". Perlindungan "tidak boleh menonaktifkan/menghapus akun sendiri" dan `is_system` (role sistem tidak dihapus/diganti nama) tetap.

### 3.5 Seeder

- `PermissionSeeder::run`: membuat semua permission katalog; untuk setiap role sistem hanya memanggil `syncPermissions(default)` bila role itu **belum punya permission sama sekali**; tidak pernah menimpa role yang sudah memiliki permission. `kasubag` pada instalasi baru tetap mendapat seluruh permission.
- `RoleSeeder::run`: `display_name`, `unit_scope`, `description`, `unit_head_of` hanya diisi saat role dibuat; `is_system` selalu true.
- `docs/ops/queue-setup.md`: langkah deploy tidak lagi menjalankan `PermissionSeeder`; ditambahkan catatan bahwa permission baru dikirim lewat migrasi data.

### 3.6 Migrasi data (menjaga perilaku efektif)

Satu migrasi, aditif dan idempoten (aman dijalankan ulang, tidak melepas permission yang sudah ada kecuali dua yang dihapus):
1. Hapus permission `penerimaan.submit` dan `pengaturan.user` (beserta keterkaitannya dengan role/pengguna).
2. Buat `persetujuan.reassign`; berikan ke role `kasubag`.
3. Berikan `persetujuan.act` ke setiap role yang dirujuk langkah alur sebagai approver (kolom `approver_role` pada definisi dan snapshot langkah) dan ke role pemegang pengguna yang ditunjuk sebagai approver bertipe `user`; ini mencakup admin kecamatan dan admin kelurahan sehingga langkah "Konfirmasi" tetap berjalan.
4. Berikan `permohonan.close` ke role yang memegang `permohonan.fulfill`, `penerimaan.delete` ke role yang memegang `penerimaan.update`, dan `user.reset-password` ke role yang memegang `user.manage-access`.
5. Isi `unit_head_of` untuk `camat` (`kecamatan`) dan `lurah` (`kelurahan`) bila kolom masih kosong.
6. Setiap perubahan permission diikuti `app(PermissionRegistrar::class)->forgetCachedPermissions()`.

---

## 4. Desain Frontend

- `Roles/RoleModal.tsx`: tambah isian "Pimpinan unit" (Bukan / Kecamatan / Kelurahan) yang dikirim sebagai `unit_head_of`; tambah label untuk `user.view`, `user.manage-access`, `user.toggle-status`, `user.delete`, `user.reset-password`, dan `persetujuan.reassign`; hapus label `penerimaan.submit` dan `pengaturan.user`. Halaman Role menampilkan lencana "Pimpinan Kecamatan/Kelurahan" pada role bertanda.
- `Users/Edit` (halaman edit pengguna): kolom kata sandi hanya tampil bila pelaku memegang `user.reset-password`.
- `WorkflowSettings/Edit.tsx`: tampilkan peringatan inline pada langkah yang role approver-nya tidak memegang `persetujuan.act` (data dikirim controller); tidak memblokir penyimpanan.
- Halaman detail Permohonan: `can.close` mengikuti `canClose`.

---

## 5. Pengujian

Pest (SQLite `:memory:`), test ditulis lebih dulu:
- **Penjaga katalog:** satu test memetakan setiap permission di `PERMISSION_GROUPS` ke minimal satu rujukan di `app/` atau `resources/js/` di luar seeder dan peta label (kecuali `import-*` dan `export-*` yang dinamis), sehingga permission hantu tidak muncul lagi.
- **Penegakan:** `penerimaan.delete`, `permohonan.close`, `user.reset-password`, `persetujuan.reassign` masing-masing diuji dengan hak (berhasil) dan tanpa hak (403 atau aksi tak tersedia), termasuk bahwa `penerimaan.update` saja tidak lagi cukup untuk menghapus dan `permohonan.fulfill` saja tidak cukup untuk menutup.
- **`persetujuan.act`:** pengguna yang ditunjuk langkah tetapi tanpa izin tidak bisa menyetujui/menolak; dengan izin berhasil; berlaku untuk tipe role, user, dan atasan unit; peringatan Pengaturan Alur muncul untuk role tanpa izin.
- **Pimpinan unit:** role kustom bertanda `kecamatan`/`kelurahan` menjadi atasan unit yang benar; role `camat` yang tandanya dicabut tidak lagi menjadi atasan; pimpinan di luar cakupan unit tidak sah.
- **Terkunci keluar:** menonaktifkan/menghapus/mencabut role dari pemegang terakhir ditolak, dan diizinkan bila masih ada pemegang lain; mencabut `pengaturan.role` dari satu-satunya role pemegang ditolak; tidak ada lagi bergantung pada nama `kasubag`.
- **Seeder:** menjalankan `PermissionSeeder` dan `RoleSeeder` pada role yang sudah dikustom tidak mengubah permission, cakupan, atau nama tampilannya; pada instalasi baru semua default terisi.
- **Migrasi data:** pada kondisi awal yang meniru produksi saat ini, hak efektif sebelum dan sesudah migrasi sama (admin kecamatan/kelurahan tetap dapat menyetujui, pemegang `fulfill` tetap dapat menutup, dan seterusnya); menjalankannya dua kali tidak mengubah hasil.
- Frontend: `npx tsc --noEmit` dan `npm run build`. Cek visual modal Role dan Pengaturan Alur menunggu perintah pengguna.

---

## 6. Risiko & Catatan

- **Hak menyetujui kini butuh dua syarat.** Role kustom yang ditunjuk sebagai approver tanpa `persetujuan.act` tidak akan bisa menyetujui; itu sebabnya migrasi data memberi izin ke semua role approver yang ada dan Pengaturan Alur memberi peringatan.
- **Menghapus permission** (`penerimaan.submit`, `pengaturan.user`) menghilangkannya dari role yang memilikinya; karena tidak pernah ditegakkan, tidak ada hak efektif yang hilang.
- **Cache permission** Spatie harus dibersihkan pada migrasi data dan pada deploy (`php artisan permission:cache-reset` atau lewat registrar); hal ini dicatat di runbook.
- **Invarian terkunci keluar** memeriksa pemegang efektif (lewat role dan izin langsung); pada instalasi baru tanpa pengguna, invarian tidak diberlakukan sampai ada pengguna pertama.
- Menambah permission di masa depan: tambahkan ke katalog, label, dan migrasi data aditif untuk lingkungan yang sudah ada; test penjaga katalog memastikan permission itu dirujuk di kode.
