# ARSITEKTUR & DETAIL RBAC SIBIMA
## Sistem Informasi Barang Milik Daerah — Kecamatan Sagulung, Kota Batam

Dokumen ini menjelaskan otorisasi SIBIMA sebagaimana berjalan di kode (per 14 Oktober 2026). Seluruh hak akses dikelola dari menu **Pengaturan Role** dan **Pengaturan Pengguna**; tidak ada nama role bawaan yang tertanam di aturan bisnis. Rancangan rinci: `docs/superpowers/specs/2026-10-09-rbac-v2-dynamic-roles-design.md` dan `...-permission-sepenuhnya-dinamis-design.md`.

---

## 1. Prinsip: dua syarat sekaligus

```
Otorisasi = Permission (apa yang boleh)  AND  Cakupan unit (di unit mana)
```

- **Permission** (Spatie): nama bertitik seperti `aset.view`, `mutasi.create`, `persetujuan.act`. Katalog tunggal: `PermissionSeeder::PERMISSION_GROUPS`. Semua policy murni `can('x.y')` ditambah pemeriksaan cakupan; tidak ada fallback ke nama role.
- **Cakupan unit**: `User::accessibleUnitIds()` mengembalikan `null` (semua unit) atau daftar id unit.

| `unit_scope` | Arti |
|---|---|
| `all` | Semua unit |
| `binaan` | Unit sendiri + unit anak (kecamatan → kelurahan binaan) |
| `own` | Hanya unit sendiri |

Nilai diambil dari `roles.unit_scope`, kecuali user punya `users.unit_scope_override`. User tanpa role atau tanpa unit (selain scope `all`) tidak punya cakupan.

---

## 2. Unit dan role

Unit (`units`) bertingkat: 1 Kecamatan Sagulung dan 6 kelurahan binaan (Sagulung Kota, Sungai Binti, Sungai Langkai, Sungai Lekop, Sungai Pelunggut, Tembesi). Kelurahan wajib punya parent kecamatan.

Role sistem (`is_system = true`, tidak bisa dihapus atau diganti namanya). Isi permission dan cakupannya hanya default awal; boleh diubah dari menu Role dan tidak ditimpa seeder.

| Role | Cakupan | Default |
|---|---|---|
| `super-admin` | all | Seluruh permission, termasuk menu Pengaturan |
| `kasubag` | all | Seluruh modul operasional, tanpa menu Pengaturan |
| `camat` | binaan | Lihat, setujui, laporan; pimpinan kecamatan |
| `admin_kecamatan` | own | Operator aset, penerimaan, mutasi, permohonan, laporan insiden |
| `admin_kelurahan` | own | Seperti admin kecamatan, tanpa penerimaan |
| `lurah` | own | Lihat, setujui, laporan; pimpinan kelurahan |

Satu pengguna memegang satu role: form pembuatan akun dan edit akses memakai `syncRoles([$role])`, dan kode yang membaca role tunggal memakai `roles->first()`. Kebutuhan hak tambahan dipenuhi lewat izin langsung per user. Memberi dua role lewat tinker atau migrasi tidak didukung (izin akan tergabung, tetapi UI hanya menampilkan role pertama).

Role kustom bisa dibuat dari UI. Kolom `roles.unit_head_of` (`kecamatan`/`kelurahan`) menandai role sebagai pimpinan unit; dipakai langkah persetujuan bertipe "Atasan Unit". Default: `camat` = kecamatan, `lurah` = kelurahan.

---

## 3. Katalog permission

| Grup | Permission |
|---|---|
| Dashboard | `dashboard.view` |
| Data Aset | `aset.view`, `aset.create`, `aset.update`, `aset.print-label`, `import-aset`, `export-aset` |
| Scan QR | `scan.view` |
| Kategori Aset | `kategori.view/create/update/delete`, `import-kategori`, `export-kategori` |
| Data Pegawai | `pegawai.view/create/update/delete`, `pegawai.create-user`, `import-pegawai`, `export-pegawai` |
| Penerimaan Aset | `penerimaan.view/create/update/delete` |
| Mutasi Aset | `mutasi.view`, `mutasi.create` |
| Permohonan Aset | `permohonan.view/create/fulfill/close` |
| Lapor Insiden | `laporan-insiden.view`, `laporan-insiden.create` |
| Persetujuan | `persetujuan.view`, `persetujuan.act`, `persetujuan.reassign` |
| Laporan | `laporan.aset`, `laporan.mutasi`, `laporan.rusak-hilang` |
| Pengaturan | `pengaturan.alur`, `pengaturan.role`, `user.view`, `user.manage-access`, `user.reset-password`, `user.toggle-status`, `user.delete` |

Aturan katalog: setiap permission harus ditegakkan di kode (ada test penjaga di `PermissionCatalogTest`). Permission baru ditambahkan ke katalog, label di `RoleModal.tsx`, dan migrasi data yang aditif untuk lingkungan yang sudah berjalan (seeder tidak menimpa role yang sudah punya permission).

---

## 4. Policy

Semua policy mengikuti pola `can(permission)` + cakupan:

| Policy | Aturan inti |
|---|---|
| `AssetPolicy` | `view`/`update`: permission + `canAccessUnit(aset.unit)`; `create`: permission + user punya `unit_id` |
| `AssetCategoryPolicy` | Hanya permission `kategori.*` (data global) |
| `PegawaiPolicy` | `view/update/delete`: permission + cakupan unit pegawai; `createUser`: `pegawai.create-user` |
| `BeritaAcaraPenerimaanPolicy` | Draft hanya terlihat dan bisa diubah/dihapus oleh unit pembuat (permission `penerimaan.update`/`delete`); yang sudah diajukan mengikuti cakupan unit |
| `AssetMutationPolicy` | `view`: unit asal atau tujuan dalam cakupan; `create`: `mutasi.create` + unit asal dalam cakupan |
| `AssetRequestPolicy` | `view`: unit dalam cakupan, atau permohonan unit dari kelurahan binaan bagi pemegang `permohonan.fulfill`; `fulfill`/`close`: `permohonan.fulfill`/`close` + cakupan pemenuhan |
| `AssetReportPolicy` | `view`: cakupan unit; `create`: `laporan-insiden.create` + aset dalam cakupan |
| `WorkflowDefinitionPolicy` | `pengaturan.alur` |

Rute tanpa permission hanya layanan mandiri: login, lupa/reset password, profil, tandai notifikasi dibaca.

---

## 5. Mesin persetujuan

Satu mesin generik (`ApprovalWorkflowService`) melayani 10 alur: `penerimaan_aset`, `mutasi_kec_ke_kel`, `mutasi_antar_kel`, `retur_kel_ke_kec`, `mutasi_internal_kec`, `mutasi_internal_kel`, `pengembalian_aset`, `lapor_rusak_hilang`, `permohonan_pegawai`, `permohonan_unit`. Default langkah ada di `App\Support\WorkflowDefaults`; bisa diubah dari **Pengaturan Alur**, dan perubahan hanya berlaku untuk pengajuan baru karena langkah disalin (snapshot) ke `approval_request_steps` saat diajukan. Semua perubahan dicatat di `workflow_change_logs`.

Tipe approver per langkah:

| Tipe | Siapa yang berwenang |
|---|---|
| `role` | Pemegang role itu, ditambah cakupan: `none` (bebas unit), `subject` (unit pengaju), `origin` (unit asal), `destination` (unit tujuan) |
| `user` | Satu user tertentu |
| `atasan_unit` | Pemegang role bertanda `unit_head_of` yang sesuai jenis unit pengaju dan unitnya dalam cakupan user |

Syarat menyetujui atau menolak (`canAct`): pengajuan masih `pending`, user **bukan pembuat pengajuan**, user memegang `persetujuan.act`, dan user ditunjuk langkah saat ini. Tindakan dikunci `lockForUpdate` dan kewenangan diperiksa ulang di dalam transaksi.

Tindakan lain:
- **Batalkan**: hanya pengaju, selama masih pending.
- **Alihkan approver**: butuh `persetujuan.reassign`; langkah menjadi bertipe `user`, tujuan harus memegang `persetujuan.act` dan bukan pengaju.

Setelah langkah terakhir disetujui, `config/workflow.php` memetakan kode alur ke kelas efek (`PenerimaanAsetEffect`, `AssetMutationEffect`, `AssetReportEffect`, `AssetRequestEffect`) yang mengubah data aset dan menulis `asset_histories`.

---

## 6. Perlindungan administrasi akses

- **Batas delegasi** (`User::covers`, `canManage`, `canManageRole`): role, permission, dan cakupan yang diberikan tidak boleh melebihi milik pemberi; akun yang lebih berkuasa tidak bisa diubah; role yang dipakai pemegang di luar cakupan pemberi tidak bisa diubah.
- **Invarian `AccessGuard`**: selalu ada minimal satu pengguna aktif yang memegang `pengaturan.role` dan `user.manage-access`. Perubahan role/izin/status yang melanggarnya ditolak.
- Tidak boleh menonaktifkan atau menghapus akun sendiri; akun dengan riwayat persetujuan tidak dihapus (cukup dinonaktifkan).
- Mengganti kata sandi atau email akun lain butuh `user.reset-password`.
- `EnsureUserIsActive` mengeluarkan sesi akun yang dinonaktifkan; login dibatasi laju.
- Akun super-admin pertama dibuat manual saat deploy (`docs/ops/deployment.md`); tidak ada akun bawaan di produksi.

---

## 7. Sisi frontend

- Props bersama Inertia memuat `auth.user.permissions`; sidebar (`resources/js/config/navigation.ts`) menyaring menu per permission.
- Controller mengirim objek `can` per halaman untuk menampilkan atau menyembunyikan tombol. Ini hanya kenyamanan UI; penegak akhir tetap policy dan FormRequest di backend (403 bila dilanggar).
- Badge Kotak Persetujuan = jumlah pengajuan yang sedang menunggu tindakan user itu (`pendingFor`, memakai `canAct` yang sama dengan halaman inbox).

---

## 8. Catatan operasional

- Setelah mengubah permission lewat kode atau migrasi, cache Spatie harus dibersihkan (`PermissionRegistrar::forgetCachedPermissions()`); migrasi data sudah melakukannya.
- Deploy: `migrate` lalu `db:seed --class=WorkflowDefinitionSeeder` (non-destruktif). `PermissionSeeder` tidak perlu dijalankan saat deploy.
- Alur persetujuan yang belum di-seed menyebabkan pengajuan gagal dengan pesan jelas ("Alur persetujuan ... belum dikonfigurasi").
