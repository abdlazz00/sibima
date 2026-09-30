# Desain: Pengaturan Alur Persetujuan Dinamis (E1 + E2)

Status: Menunggu review.
Tanggal: 2026-09-30

---

## 1. Konteks & Tujuan

Generic Approval Workflow Engine (Sprint 3) sudah berbasis data: `workflow_definitions` + `workflow_steps` menentukan urutan langkah, tetapi isinya hanya bisa diubah lewat seeder/kode, tiap langkah hanya bisa dikunci ke satu **role**, dan label langkah di-hardcode di frontend.

Kebutuhan baru (Sprint 4, subsistem E): Kasubag dapat mengatur dari UI **fitur mana**, **urutan langkah**, dan **siapa yang menyetujui** tiap langkah, termasuk menunjuk **user tertentu**. Notifikasi tetap lewat mekanisme yang ada (bell + Kotak Persetujuan).

Spec ini mencakup dua bagian yang dikerjakan berurutan:

- **E1 - Fondasi engine:** tipe approver (`role` / `user` / `atasan_unit`), snapshot langkah per pengajuan, pengalihan approver oleh Kasubag.
- **E2 - UI Pengaturan Alur:** halaman kelola alur, validasi, log audit, reset ke default.

Lapor Rusak/Hilang, Permohonan Aset, Dashboard/Excel, dan Scan QR dibahas di siklus spec masing-masing sesudah spec ini. Alur Lapor dan Permohonan nanti cukup mendaftarkan alur default berisi langkah `atasan_unit`.

## 2. Keputusan yang Sudah Disepakati

| Topik | Keputusan |
|---|---|
| Tingkat dinamis | Atur langkah per fitur yang sudah ada, approver bisa role atau user tertentu. Tanpa langkah bersyarat, tanpa approver paralel, tanpa pembuatan fitur baru dari UI. |
| Approver user tertentu | Eksklusif ke user itu. Kasubag dapat mengalihkan langkah yang sedang pending ke user lain. |
| Perubahan alur saat ada pengajuan berjalan | Pengajuan berjalan tetap memakai langkah lama (snapshot saat submit). Perubahan hanya berlaku untuk pengajuan baru. |
| Routing Camat/Lurah | Tipe approver ketiga `atasan_unit`: Camat bila unit subjek kecamatan, Lurah bila kelurahan. |
| Hak akses menu | Hanya Kasubag. Perubahan tercatat di log audit. |
| Lingkup alur | Semua alur (Penerimaan, Mutasi x5 kode, dan alur Sprint 4 nanti) dengan validasi otomatis + tombol Kembalikan ke Default. |
| Langkah bersyarat | Tidak. Semua langkah selalu berlaku. |
| Notifikasi | Tetap in-app: bell + Kotak Persetujuan, dihitung dengan aturan approver yang sama. |
| Urutan pengerjaan | E1, lalu E2, lalu Lapor, Permohonan, Dashboard/Excel, Scan QR. |

## 3. Data Model (E1)

### 3.1 `workflow_steps` (template yang diedit dari UI)

Kolom baru / berubah:

| Kolom | Tipe | Keterangan |
|---|---|---|
| `label` | string, wajib | Nama langkah yang tampil di tracker (mis. "Verifikasi Kasubag"). Menggantikan label hardcode di frontend. |
| `approver_type` | string, default `role` | `role`, `user`, atau `atasan_unit`. Enum `ApproverType`. |
| `approver_role` | string, **nullable** | Wajib bila `approver_type = role`. |
| `approver_user_id` | FK `users` nullable (`nullOnDelete`) | Wajib bila `approver_type = user`. |
| `unit_scope` | string | Tetap `none/subject/origin/destination`. Bermakna hanya untuk `role`. Untuk `user` diabaikan (disimpan `none`). Untuk `atasan_unit` selalu `subject`. |

### 3.2 `approval_request_steps` (snapshot per pengajuan, tabel baru)

`id`, `approval_request_id` (FK cascade), `step_order`, `label`, `approver_type`, `approver_role` nullable, `unit_scope`, `approver_user_id` nullable (`nullOnDelete`), timestamps. Unik `(approval_request_id, step_order)`.

- Dibuat oleh `ApprovalWorkflowService::submit()` dengan menyalin langkah definisi pada saat itu, dalam transaksi yang sama dengan pembuatan `approval_requests`.
- `ApprovalRequest::steps()` (HasMany, urut `step_order`). `currentStepDefinition()` dan `isLastStep()` membaca dari snapshot, bukan dari `definition->steps`.
- Semua tampilan tracker membaca `approvalRequest.steps` (bukan `definition.steps`).

### 3.3 `approval_actions`

`action` bertambah nilai `reassign` (`ApprovalActionType::Reassign`). `note` berisi "Dialihkan dari {A} ke {B}: {alasan}".

### 3.4 `workflow_change_logs` (tabel baru)

`id`, `workflow_definition_id` (FK), `user_id` (FK), `event` (`update` / `reset`), `steps_before` (json), `steps_after` (json), `created_at`.

## 4. Perilaku Engine (E1)

### 4.1 `canAct(User, ApprovalRequest)`

Setelah guard `status === Pending` yang sudah ada, berdasarkan `approver_type` langkah saat ini (dari snapshot):

- **`user`:** `$user->id === $step->approver_user_id`. Tidak ada cek role atau unit.
- **`role`:** logika sekarang: `hasRole(approver_role)` + `unit_scope` (`none` / `subject` / `origin` / `destination`).
- **`atasan_unit`:** unit subjek = `approvable->unit`. Role yang diminta = `camat` bila `unit->isKecamatan()`, selain itu `lurah`. User harus `hasRole(role)` dan `canAccessUnit(unit)`.

`approversFor()` (penerima notifikasi) dan `pendingFor()` (inbox + badge) memakai logika yang sama sehingga konsisten. Langkah `user` dengan `approver_user_id` null (user terhapus) tidak punya approver dan hanya bisa ditangani lewat pengalihan (4.2).

### 4.2 Pengalihan (`reassign`)

`ApprovalWorkflowService::reassign(ApprovalRequest $request, User $by, User $to, string $note)`:

- Hanya `kasubag` (`InvalidArgumentException` selain itu), hanya `status = pending`.
- `$to` harus punya minimal satu role (akun login yang valid).
- Dalam transaksi + `lockForUpdate` pada baris pengajuan: ubah langkah saat ini di snapshot menjadi `approver_type = user`, `approver_user_id = $to->id`, `unit_scope = none`. Catat `approval_actions` (`reassign`, `note`).
- Notifikasi ke `$to` ("Menunggu persetujuan Anda: ...") dengan cara yang sama seperti perpindahan langkah.
- Hanya snapshot pengajuan itu yang berubah, template alur tidak tersentuh.

Endpoint: `POST /approval-requests/{approvalRequest}/reassign` (`user_id`, `note` wajib), `403` bila bukan Kasubag.

### 4.3 Kapabilitas per alur

`config/workflow.php` mendapat peta `capabilities` per kode alur, dipakai validasi (5.2):

- `penerimaan_aset`: `unit: subject`
- `mutasi_*`: `unit: origin_destination`
- (alur Sprint 4 nanti: `lapor_*`, `permohonan_*` mengisi sendiri: `subject` atau `none`)

## 5. UI Pengaturan Alur (E2)

### 5.1 Halaman

Menu sidebar "Pengaturan Alur" (item baru, `roles: ['kasubag']`). Policy/Gate: hanya Kasubag, role lain `403`.

- `GET /pengaturan/alur` - daftar alur: nama, kode, ringkasan langkah ("Kasubag -> Camat"), jumlah pengajuan pending, waktu terakhir diubah.
- `GET /pengaturan/alur/{workflow}` - editor: daftar langkah berurutan. Tiap langkah: nama, tipe approver (Role / User tertentu / Atasan unit), role atau user (dropdown), cakupan unit (opsi disesuaikan kapabilitas alur). Tombol tambah, hapus, naik/turun. Banner: "Pengajuan yang sedang berjalan tidak terpengaruh". Panel "Riwayat perubahan" (dari `workflow_change_logs`).
- `PUT /pengaturan/alur/{workflow}` - simpan seluruh langkah sekaligus dalam satu transaksi.
- `POST /pengaturan/alur/{workflow}/reset` - kembalikan ke default.

Tombol "Alihkan approver" (Kasubag, pengajuan pending) ditambahkan di halaman detail pengajuan: modal pilih user + alasan. Tracker di Penerimaan dan Mutasi membaca `label` dari snapshot; untuk langkah `origin`/`destination`, nama unit ditambahkan otomatis di tampilan.

### 5.2 Validasi (server, dalam `UpdateWorkflowRequest` / service)

- Minimal 1 langkah; `label` wajib (maks 100 karakter).
- `approver_type = role`: `approver_role` salah satu dari 5 role, dan role itu punya minimal 1 user.
- `approver_type = user`: `approver_user_id` ada dan user punya minimal 1 role. (Belum ada fitur nonaktif akun; "aktif" berarti punya role.)
- `unit_scope = origin/destination` hanya bila kapabilitas alur `origin_destination`.
- `approver_type = atasan_unit`, dan `unit_scope = subject`, hanya bila kapabilitas alur `subject`.
- Gagal validasi tidak mengubah apa pun (transaksi + validasi sebelum tulis).

### 5.3 Log audit dan reset default

- Tiap `PUT` dan `reset` menulis satu baris `workflow_change_logs` (langkah sebelum dan sesudah).
- Default alur dipindah dari seeder ke satu sumber (`WorkflowDefaults`), dipakai oleh `WorkflowDefinitionSeeder` dan tombol reset, sehingga label dan langkah bawaan konsisten.

## 6. Migrasi & Kompatibilitas

1. Migrasi skema: kolom baru `workflow_steps`, `approver_role` nullable, tabel `approval_request_steps`, `workflow_change_logs`, nilai `reassign`.
2. Backfill `workflow_steps`: `approver_type = role`, `label` dari default per (kode alur, `step_order`); ditegakkan oleh `WorkflowDefinitionSeeder` yang dijalankan setelah migrasi.
3. Backfill snapshot: untuk setiap `approval_requests` yang sudah ada, salin langkah definisi saat ini ke `approval_request_steps` (termasuk yang sudah selesai, agar tracker tetap tampil). Perilaku pengajuan yang berjalan tidak berubah.
4. Frontend: hapus `stepLabel`/`stepLabelFor` hardcode, ganti dengan `label` dari snapshot.
5. Catatan operasional dev/prod: setelah pull, jalankan `php artisan migrate` lalu `php artisan db:seed --class=WorkflowDefinitionSeeder`.

## 7. Pengujian (Pest)

- **Engine:** `canAct`/`approversFor`/`pendingFor` untuk tiap tipe approver (`role` semua scope, `user`, `atasan_unit` kecamatan dan kelurahan); snapshot tidak terpengaruh perubahan alur; pengajuan lama ter-backfill dan tetap bisa diproses.
- **Pengalihan:** hanya Kasubag, hanya pending, hanya user valid, tercatat di riwayat, notifikasi ke user baru, user lama tidak bisa lagi bertindak, `403` HTTP untuk role lain.
- **Pengaturan:** `403` selain Kasubag; setiap aturan validasi (5.2); simpan atomik; log audit terisi; reset default; pengajuan baru mengikuti alur baru sementara yang lama tidak.
- **Frontend (manual di browser):** ubah alur, ajukan, tracker dan inbox mengikuti alur baru; pengajuan lama tetap pada langkah lama; alihkan approver.

## 8. Di Luar Cakupan

Langkah bersyarat (nilai/kategori/unit), approver paralel ("semua/salah satu"), pembuatan fitur/jenis transaksi baru dari UI, delegasi otomatis saat cuti, fitur nonaktifkan akun, notifikasi email/push, dan pengubahan langkah pada pengajuan yang sudah berjalan (kecuali pengalihan approver langkah saat ini).
