# ARSITEKTUR & DETAIL ROLE-BASED ACCESS CONTROL (RBAC) SIBIMA
## Sistem Informasi Barang Milik Daerah — Kecamatan Sagulung, Kota Batam

Dokumen ini membedah secara menyeluruh arsitektur otorisasi **Role-Based Access Control (RBAC)** pada aplikasi **SIBIMA (SIMASET)**, menguraikan perpaduan antara **Peran Pengguna (Roles)**, **Cakupan Wilayah Kerja (Unit Scoping)**, **Kebijakan Laravel (Policies)**, dan **Alur Kerja Persetujuan (Workflow Engine)**, baik berdasarkan dokumen perancangan awal maupun yang sudah diimplementasikan dalam *codebase*.

---

## 1. PRINSIP UTAMA: DUAL-LAYER SECURITY

Sistem SIBIMA tidak mengandalkan *role* semata (misal: "Admin"), melainkan menerapkan sistem keamanan dua lapis (**Dual-Layer Authorization**):

$$\text{Otorisasi Akhir} = \text{Peran Fungsional (Role)} \;\land\; \text{Cakupan Wilayah Kerja (Unit Scope)}$$

```
┌─────────────────────────────────────────────────────────────┐
│                    Pengguna Terautentikasi                  │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
 ┌───────────────────────┐             ┌─────────────────────┐
 │    Lapis 1: Role      │             │  Lapis 2: Wilayah   │
 │ (Spatie Permission)   │             │ (Unit / Org Scope)  │
 ├───────────────────────┤             ├─────────────────────┤
 │ • kasubag             │             │ • Global (All Unit) │
 │ • camat               │             │ • Kecamatan + Kel.  │
 │ • admin_kecamatan     │             │ • Unit Kelurahan    │
 │ • admin_kelurahan     │             │   Tertentu          │
 │ • lurah               │             │                     │
 └──────────┬────────────┘             └──────────┬──────────┘
            │                                     │
            └──────────────────┬──────────────────┘
                               ▼
        ┌─────────────────────────────────────────────┐
        │  Evaluasi Otorisasi (Policy & Workflow)     │
        │  • View / Create / Update / Delete          │
        │  • Can Act (Approve / Reject Workflow Step) │
        └─────────────────────────────────────────────┘
```

### Mengapa Perlu Unit Scope?
Dalam tata kelola pemerintahan daerah:
- Pejabat dan staf memiliki yurisdiksi teritorial.
- Lurah Sungai Binti tidak berhak menyetujui mutasi atau melihat inventaris internal Kelurahan Tembesi.
- Admin Kecamatan hanya mengelola stok fisik aset kantor kecamatan, bukan barang kelurahan.
- Camat menaungi seluruh kelurahan di wilayah Kecamatan Sagulung.
- Kasubag Kepegawaian & Aset bertindak sebagai koordinator penatausahaan aset seluruh wilayah.

---

## 2. STRUKTUR HIERARKI UNIT & MODEL PENGGUNA

### 2.1 Hierarki Unit Organisasi (`units`)
Database mengorganisir unit dalam relasi *Self-Referencing Parent-Child*:
1. **Kecamatan Sagulung** (`type = 'kecamatan'`, `parent_id = null`)
2. **Kelurahan Binaan** (`type = 'kelurahan'`, `parent_id = [id_kecamatan]`):
   - Kelurahan Sagulung Kota
   - Kelurahan Sungai Binti
   - Kelurahan Sungai Langkai
   - Kelurahan Sungai Lekop
   - Kelurahan Sungai Pelunggut
   - Kelurahan Tembesi
   - Kelurahan Sungai Buluh

### 2.2 Resolusi Cakupan pada Model `User` (`app/Models/User.php`)
Setiap akun `User` memiliki relasi `unit_id`. Evaluasi hak akses teritorial dieksekusi melalui metode:

```php
public function accessibleUnitIds(): ?array
{
    // 1. Kasubag memiliki akses global lintas seluruh unit
    if ($this->hasRole('kasubag')) {
        return null; // null merepresentasikan "Semua Unit"
    }

    if ($this->getRoleNames()->isEmpty() || $this->unit_id === null) {
        return [];
    }

    // 2. Camat memiliki akses ke unit kecamatan + seluruh kelurahan anak binaannya
    if ($this->hasRole('camat')) {
        return Unit::query()
            ->where('id', $this->unit_id)
            ->orWhere('parent_id', $this->unit_id)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    // 3. Admin Kecamatan, Admin Kelurahan, dan Lurah terkunci pada unit kerja sendiri
    return [$this->unit_id];
}

public function canAccessUnit(Unit $unit): bool
{
    $ids = $this->accessibleUnitIds();

    return $ids === null || in_array($unit->id, $ids, true);
}
```

---

## 3. KATALOG 5 PERAN (ROLES) & TANGGUNG JAWAB

| Peran (Role) | Unit Kerja Asal | Cakupan Akses Wilayah (`accessibleUnitIds`) | Tanggung Jawab Utama |
|---|---|---|---|
| **`kasubag`**<br>*(Kasubag Kepegawaian & Aset)* | Kecamatan Sagulung (`unit_id: null` / Kantor Camat) | **Global (Semua Unit)**<br>`null` | • Administrator fungsional master kategori aset.<br>• Pengelola penuh data pegawai dan aktivasi akun login dinas.<br>• Verifikator administratif (Step 1) penerimaan aset baru.<br>• Verifikator administratif alur mutasi barang tertentu. |
| **`camat`**<br>*(Kepala Kecamatan Sagulung)* | Kantor Kecamatan Sagulung | **Supervisi Wilayah**<br>Unit Kec. + Seluruh 7 Kelurahan | • Pimpinan eksekutif tertinggi tingkat kecamatan.<br>• Menandatangani (*approval*) akhir pengadaan aset masuk (Penerimaan).<br>• Menyetujui pengeluaran aset kecamatan ke kelurahan.<br>• Menyetujui mutasi internal pegawai kecamatan. |
| **`admin_kecamatan`**<br>*(Pengurus Barang Kecamatan)* | Kantor Kecamatan Sagulung | **Lokal Kecamatan**<br>`[id_kecamatan]` | • Operator penginput fisik pengadaan aset baru.<br>• Mengelola stok dan pencatatan barang milik kecamatan.<br>• Mengajukan mutasi aset keluar ke kelurahan.<br>• Mengajukan permohonan/retur barang kecamatan. |
| **`admin_kelurahan`**<br>*(Pengurus Barang Kelurahan)* | Kelurahan Masing-Masing | **Lokal Kelurahan Terkait**<br>`[id_kelurahan]` | • Operator pencatatan inventaris kelurahan bersangkutan.<br>• Mengajukan mutasi antar-kelurahan atau retur ke kecamatan.<br>• Mengonfirmasi fisik barang diterima saat mutasi masuk ke kelurahannya. |
| **`lurah`**<br>*(Kepala Kelurahan)* | Kelurahan Masing-Masing | **Lokal Kelurahan Terkait**<br>`[id_kelurahan]` | • Pimpinan eksekutif unit kelurahan.<br>• Menyetujui mutasi keluar dari kelurahannya.<br>• Menyetujui penerimaan barang masuk ke kelurahannya.<br>• Menyetujui alokasi mutasi internal pegawai kelurahan. |

---

## 4. MATRIKS HAK AKSES FITUR (FEATURE PERMISSION MATRIX)

Matriks berikut menggabungkan spesifikasi dokumen desain (`PANDUAN_DESAIN_UI_UX_SIBIMA.md`) dan implementasi kode riil:

| Fitur / Modul | Kasubag | Camat | Admin Kec. | Admin Kel. | Lurah | Status Implementasi Kode |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Dashboard Eksekutif** | Global | Supervisi | Unit Kec. | Unit Kel. | Unit Kel. | ✅ Selesai (`Dashboard.tsx`) |
| **Katalog Aset (Read)** | Semua Unit | Semua Unit | Unit Kec. | Unit Kel. | Unit Kel. | ✅ Selesai (`AssetPolicy::view`) |
| **Katalog Aset (Create/Edit)** | ❌ Read Only | ❌ Read Only | ✅ Unit Kec. | ✅ Unit Kel. | ❌ Read Only | ✅ Selesai (`AssetPolicy::create, update`) |
| **Master Kategori Aset** | ✅ Penuh (CRUD) | ❌ Tidak Ada | ❌ Tidak Ada | ❌ Tidak Ada | ❌ Tidak Ada | ✅ Selesai (`AssetCategoryPolicy`) |
| **Kelola Data Pegawai** | ✅ Penuh (CRUD) | 👁️ Lihat Unit | ✅ Unit Kec. | ✅ Unit Kel. | 👁️ Lihat Kel. | ✅ Selesai (`PegawaiPolicy`) |
| **Aktivasi Akun User Login** | ✅ Hanya Kasubag | ❌ Dilarang | ❌ Dilarang | ❌ Dilarang | ❌ Dilarang | ✅ Selesai (`PegawaiPolicy::createUser`) |
| **Penerimaan Aset (Input)** | ❌ Tidak Ada | ❌ Tidak Ada | ✅ Input BA | ❌ Dilarang | ❌ Dilarang | ✅ Selesai (`BeritaAcaraPenerimaanPolicy`) |
| **Penerimaan Aset (Verifikasi)** | ✅ Step 1 (Kasubag) | ✅ Step 2 (Camat) | ❌ Read Only | ❌ Dilarang | ❌ Dilarang | ✅ Selesai (`Workflow penerimaan_aset`) |
| **Mutasi Aset (Ajukan)** | ❌ Read Only | ❌ Read Only | ✅ Unit Asal Kec. | ✅ Unit Asal Kel. | ❌ Read Only | ✅ Selesai (`AssetMutationPolicy::create`) |
| **Mutasi Aset (Persetujuan)** | Sesuai Alur | Sesuai Alur | Sesuai Alur (Konfirmasi) | Sesuai Alur (Konfirmasi) | Sesuai Alur | ✅ Selesai (`ApprovalWorkflowService`) |
| **Kotak Persetujuan (`/persetujuan`)** | ✅ Tugas Kasubag | ✅ Tugas Camat | ✅ Langkah verifikasi retur | ✅ Langkah verifikasi mutasi masuk | ✅ Tugas Lurah | ✅ Selesai (`PersetujuanController`) |
| **Batalkan Pengajuan** | ❌ | ❌ | ✅ Hanya pengaju, selama pending | ✅ Hanya pengaju, selama pending | ❌ | ✅ Selesai (`ApprovalWorkflowService::cancel`) |
| **Pengaturan Alur Persetujuan** | ✅ Penuh (ubah langkah, alihkan approver) | ❌ | ❌ | ❌ | ❌ | ✅ Selesai (`WorkflowDefinitionPolicy`, `WorkflowSettingsController`) |
| **Draft Berita Acara (lihat/edit/hapus)** | ❌ Tidak terlihat | ❌ Tidak terlihat | ✅ Admin unit yang sama | ❌ | ❌ | ✅ Selesai (`BeritaAcaraPenerimaanPolicy`) |
| **Permohonan Kebutuhan Aset** | Approve permohonan unit | Approve pegawai kecamatan | Input + penuhi | Input + penuhi | Approve pegawai kelurahan | ✅ Selesai (`AssetRequestPolicy`, workflow `permohonan_pegawai`/`permohonan_unit`) |
| **Pelaporan Rusak / Hilang** | Lihat semua (alihkan approver) | Approve aset kecamatan | Input laporan | Input laporan | Approve aset kelurahan | ✅ Selesai (`AssetReportPolicy`, workflow `lapor_rusak_hilang`) |
| **Pindai QR Code Kamera** | ✅ Akses | ✅ Akses | ✅ Akses | ✅ Akses | ✅ Akses | ⏳ *Next Roadmap* |
| **Laporan & Rekapitulasi Excel** | Cetak Seluruhnya | Cetak Seluruhnya | Cetak Unit Kec. | Cetak Unit Kel. | Cetak Unit Kel. | ⏳ *Next Roadmap* |

---

## 5. DETAIL ATURAN DI TINGKAT KODE (AS-BUILT CODE IMPLEMENTATION)

### 5.1 Kebijakan Otorisasi (Laravel Policies)

#### A. `AssetCategoryPolicy` (`app/Policies/AssetCategoryPolicy.php`)
```php
// Seluruh kemampuan (viewAny, create, update, delete) dikunci eksklusif untuk Kasubag
public function viewAny(User $user): bool { return $user->hasRole('kasubag'); }
public function create(User $user): bool  { return $user->hasRole('kasubag'); }
public function update(User $user, AssetCategory $category): bool { return $user->hasRole('kasubag'); }
public function delete(User $user, AssetCategory $category): bool { return $user->hasRole('kasubag'); }
```

#### B. `AssetPolicy` (`app/Policies/AssetPolicy.php`)
```php
// Melihat Aset: Harus memiliki role valid DAN unit aset berada dalam cakupan wilayah user
public function view(User $user, Asset $asset): bool
{
    return $user->hasAnyRole(['kasubag', 'camat', 'admin_kecamatan', 'admin_kelurahan', 'lurah'])
        && $user->canAccessUnit($asset->unit);
}

// Menambah Aset: Hanya operator (admin_kecamatan / admin_kelurahan)
public function create(User $user): bool
{
    return $user->hasAnyRole(['admin_kecamatan', 'admin_kelurahan']) && $user->unit_id !== null;
}

// Mengubah Aset: Operator hanya boleh mengedit aset milik unit kerjanya sendiri
public function update(User $user, Asset $asset): bool
{
    return $user->hasAnyRole(['admin_kecamatan', 'admin_kelurahan']) && $user->unit_id === $asset->unit_id;
}
```

#### C. `BeritaAcaraPenerimaanPolicy` (`app/Policies/BeritaAcaraPenerimaanPolicy.php`)
```php
public function viewAny(User $user): bool
{
    // Hanya pihak tingkat kecamatan yang berurusan dengan pengadaan penerimaan baru
    return $user->hasAnyRole(['admin_kecamatan', 'kasubag', 'camat']);
}

public function create(User $user): bool
{
    // Hanya Admin Kecamatan yang berhak menginput dokumen penerimaan
    return $user->hasRole('admin_kecamatan') && $user->unit_id !== null;
}

public function view(User $user, BeritaAcaraPenerimaan $ba): bool
{
    // Draft hanya terlihat oleh admin_kecamatan di unit yang sama;
    // Kasubag/Camat baru melihat BA setelah diajukan
    if ($ba->status === BeritaAcaraStatus::Draft) {
        return $user->hasRole('admin_kecamatan') && $user->canAccessUnit($ba->unit);
    }
    return $user->hasRole('kasubag') || $user->canAccessUnit($ba->unit);
}

// update & delete: hanya untuk draft, oleh admin_kecamatan unit yang sama
```

#### D. `AssetMutationPolicy` (`app/Policies/AssetMutationPolicy.php`)
```php
public function view(User $user, AssetMutation $mutation): bool
{
    $accessibleUnitIds = $user->accessibleUnitIds();
    if ($accessibleUnitIds === null) return true; // Kasubag

    // Boleh melihat jika unit user terlibat sebagai Unit Asal ATAU Unit Tujuan
    return in_array($mutation->origin_unit_id, $accessibleUnitIds, true)
        || in_array($mutation->destination_unit_id, $accessibleUnitIds, true);
}

public function create(User $user, ?Unit $originUnit = null): bool
{
    // Hanya admin yang boleh mengajukan mutasi
    if (! $user->hasRole(['admin_kecamatan', 'admin_kelurahan'])) return false;

    // Unit asal mutasi wajib berada dalam kewenangan unit user
    return $originUnit === null || $user->canAccessUnit($originUnit);
}
```

#### E. `PegawaiPolicy` (`app/Policies/PegawaiPolicy.php`)
```php
// Kasubag mengelola seluruh pegawai se-Kecamatan dan Kelurahan
// Admin mengelola pegawai di unit kerjanya masing-masing
public function update(User $user, Pegawai $pegawai): bool
{
    return $user->hasRole('kasubag')
        || ($user->hasAnyRole(['admin_kecamatan', 'admin_kelurahan']) && $user->canAccessUnit($pegawai->unit));
}

// Pembuatan akun User sistem untuk pegawai hanya boleh dilakukan oleh Kasubag
public function createUser(User $user, Pegawai $pegawai): bool
{
    return $user->hasRole('kasubag');
}
```

---

## 6. MEKANISME WORKFLOW APPROVAL DENGAN 4 SCOPE UNIT

Sistem otorisasi persetujuan diatur terpusat di `ApprovalWorkflowService::canAct()` (`app/Services/ApprovalWorkflowService.php`). Setiap langkah alur kerja (`WorkflowStep`) memiliki dua parameter penentu:
1. `approver_role`: Peran yang berwenang (misal: `camat`, `kasubag`, `lurah`, `admin_kelurahan`).
2. `unit_scope`: Ruang lingkup wilayah penentu pejabat yang berhak.

```php
public function canAct(User $user, ApprovalRequest $request): bool
{
    if ($request->status !== ApprovalStatus::Pending) return false;

    $step = $request->currentStepDefinition();
    if ($step === null || ! $user->hasRole($step->approver_role)) return false;

    return match ($step->unit_scope) {
        UnitScope::None        => true, // Bebas wilayah (misal: Kasubag Aset)
        UnitScope::Subject     => $user->canAccessUnit($request->approvable->unit),
        UnitScope::Origin      => $user->canAccessUnit($request->approvable->getOriginUnit()),
        UnitScope::Destination => $user->canAccessUnit($request->approvable->getDestinationUnit()),
    };
}
```

### Rincian 6 Definisi Workflow yang Telah Diterapkan:

```
1. Penerimaan Aset Baru (`penerimaan_aset`)
   Step 1: Kasubag [Scope: None]
   Step 2: Camat   [Scope: Subject] ──> Selesai (Aset Aktif di Kecamatan)

2. Mutasi Kecamatan ke Kelurahan (`mutasi_kec_ke_kel`)
   Step 1: Kasubag         [Scope: None] (Verifikasi Administrasi)
   Step 2: Camat           [Scope: Origin] (Persetujuan Pelepasan Aset Kecamatan)
   Step 3: Admin Kelurahan [Scope: Destination] (Konfirmasi Fisik Barang Diterima)
   Step 4: Lurah           [Scope: Destination] (Persetujuan Penerimaan Masuk)

3. Mutasi Antar Kelurahan (`mutasi_antar_kel`)
   Step 1: Lurah Asal      [Scope: Origin] (Persetujuan Pelepasan dari Kelurahan A)
   Step 2: Admin Kelurahan [Scope: Destination] (Konfirmasi Fisik di Kelurahan B)
   Step 3: Lurah Tujuan    [Scope: Destination] (Persetujuan Penerimaan Kelurahan B)

4. Retur Kelurahan ke Kecamatan (`retur_kel_ke_kec`)
   Step 1: Lurah Asal      [Scope: Origin] (Pelepasan dari Kelurahan)
   Step 2: Admin Kecamatan [Scope: Destination] (Pengecekan Fisik di Kantor Camat)
   Step 3: Kasubag         [Scope: None] (Verifikasi Penatausahaan Aset)
   Step 4: Camat           [Scope: Destination] (Pengesahan Masuk Kembali ke Kecamatan)

5. Mutasi Internal Kecamatan (`mutasi_internal_kec`)
   Step 1: Camat           [Scope: Origin] (Pengalihan Ruangan/Pegawai di Kecamatan)

6. Mutasi Internal Kelurahan (`mutasi_internal_kel`)
   Step 1: Lurah           [Scope: Origin] (Pengalihan Ruangan/Pegawai di Kelurahan)

7. Lapor Rusak/Hilang (`lapor_rusak_hilang`)
   Step 1: Atasan Unit     [Scope: Subject] (Camat untuk aset kecamatan, Lurah untuk aset kelurahan)

8. Permohonan Aset Pegawai (`permohonan_pegawai`)
   Step 1: Atasan Unit     [Scope: Subject] (Camat untuk unit kecamatan, Lurah untuk unit kelurahan)

9. Permohonan Aset Unit (`permohonan_unit`)
   Step 1: Kasubag        [Scope: None]
```


### Tipe Approver & Snapshot Langkah

Setiap langkah (`workflow_steps`) kini punya `label` dan `approver_type`:
- `role`: role + cakupan unit (`none/subject/origin/destination`), seperti sebelumnya.
- `user`: eksklusif untuk satu user; Kasubag dapat mengalihkan approver langkah yang sedang pending ke user lain.
- `atasan_unit`: otomatis Camat (unit kecamatan) atau Lurah (unit kelurahan).

Langkah disalin ke `approval_request_steps` saat pengajuan dibuat, sehingga mengubah alur dari menu Pengaturan Alur hanya berlaku untuk pengajuan baru. Semua perubahan tercatat di `workflow_change_logs`.

Catatan operasional setelah pull: `php artisan migrate` lalu `php artisan db:seed --class=WorkflowDefinitionSeeder` (seeder tidak menimpa alur yang sudah diubah admin).

---

## 7. OTORISASI PADA ANTARMUKA FRONTEND (INERTIA REACT)

Frontend menerapkan prinsip **Defense in Depth**:
1. **Navigasi Sidebar Responsif Per Role** (`resources/js/config/navigation.ts`, properti `roles` per item):
   - *Kategori Aset* hanya untuk `kasubag`; *Penerimaan Aset* hanya untuk `kasubag`, `camat`, `admin_kecamatan`.
   - *Kotak Persetujuan* tampil untuk semua role karena admin kecamatan/kelurahan juga menjadi approver pada langkah verifikasi mutasi. Badge angkanya adalah jumlah pengajuan yang **sedang menunggu tindakan user tersebut** (prop bersama `pending_approvals`, dihitung dengan `canAct()` yang sama dengan halaman inbox), bukan jumlah notifikasi belum dibaca.
2. **Prop Otorisasi Komponen (`can`)**:
   - Controller selalu mengirimkan objek otorisasi eksplisit via Inertia:
     ```php
     return Inertia::render('AssetMutations/Index', [
         'can' => [
             'create' => $request->user()->can('create', AssetMutation::class),
         ],
     ]);
     ```
   - Tombol *"Ajukan Mutasi Aset"*, *"Tambah Barang"*, *"Tolak"*, dan *"Setujui"* disembunyikan secara visual jika `can.create` atau `can.act` bernilai `false`.
3. **Validasi Backend Tetap Mutlak**:
   - Sekalipun pengguna memanipulasi DOM atau me-request endpoint via API client, backend Route Middleware dan FormRequest/Policy akan memblokir dengan kode status **403 (Forbidden)** atau **404**.

---

## 8. REKOMENDASI PENGEMBANGAN RBAC PADA MODUL SELANJUTNYA

Berdasarkan evaluasi as-built dan rencana modul berikutnya:
1. **Modul Permohonan Kebutuhan Aset (`asset_requests`)**:
   - **Tipe Pegawai**: Pengaju adalah Admin Unit &rarr; Approval oleh Atasan Unit (`camat` jika unit kec, `lurah` jika unit kel). Pemenuhan barang oleh Admin Unit.
   - **Tipe Unit**: Pengaju adalah Admin Kelurahan &rarr; Approval oleh Kasubag Kecamatan. Pemenuhan barang oleh Admin Kecamatan.
2. **Modul Pelaporan Kerusakan / Kehilangan (`asset_reports`)**:
   - Pengaju adalah Admin Unit atas nama pegawai pemegang barang.
   - Approval persetujuan satu langkah oleh Atasan Unit (`camat` untuk kecamatan, `lurah` untuk kelurahan).
   - Efek approval otomatis mengubah `assets.kondisi` dan menerbitkan entri `asset_histories`.
3. **Pemberian Akun Role Multi-User**:
   - Menjaga integritas bahwa pembuatan akun login `User` baru bagi pegawai tetap berada di bawah kendali tunggal `kasubag` untuk mencegah pembuatan akun liar di luar verifikasi kepegawaian resmi.

---
*Dokumen diperbarui: 29 September 2026 (selaras dengan perilaku as-built setelah code review Sprint 3)*  
*Versi Arsitektur: SIBIMA v1.1-Production*
