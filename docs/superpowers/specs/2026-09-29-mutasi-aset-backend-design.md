# Desain: Backend Modul Mutasi Aset (4 Alur Mutasi)

Status: Disetujui, siap masuk `writing-plans`.
Tanggal: 2026-09-29

---

## 1. Konteks & Tujuan

Sprint 3 (`docs/superpowers/plans/2026-09-24-simaset-sprint-plan.md`) menetapkan 5 alur transaksi institusional yang terhubung dengan *Generic Approval Workflow Engine*. Alur pertama (`penerimaan_aset`) telah selesai diimplementasikan dan diuji.

Spesifikasi ini mencakup arsitektur dan implementasi backend untuk **4 alur mutasi aset**:
1. **Mutasi Kecamatan &rarr; Kelurahan (`mutasi_kec_ke_kel`)**
2. **Mutasi Antar Kelurahan (`mutasi_antar_kel`)**
3. **Retur Kelurahan &rarr; Kecamatan (`retur_kel_ke_kec`)**
4. **Mutasi Internal Ruangan/Pemegang (`mutasi_internal_kec` & `mutasi_internal_kel`)**

Spesifikasi ini fokus murni pada **fondasi backend**: schema database, workflow definition & scopes, model & repository, transaction lifecycle (termasuk status lock `dalam_proses`), effect handler perpindahan kepemilikan aset, audit trail `asset_histories`, policy & controller API, serta automated test suite menggunakan Pest.

---

## 2. Arsitektur Data Model & Database Migrations

### 2.1 Enums & Contracts

#### `app/Enums/MutationType.php`
```php
namespace App\Enums;

enum MutationType: string
{
    case KecKeKel = 'kec_ke_kel';
    case AntarKel = 'antar_kel';
    case ReturKelKeKec = 'retur_kel_ke_kec';
    case Internal = 'internal';

    public function label(): string
    {
        return match ($this) {
            self::KecKeKel => 'Mutasi Kecamatan ke Kelurahan',
            self::AntarKel => 'Mutasi Antar Kelurahan',
            self::ReturKelKeKec => 'Retur Kelurahan ke Kecamatan',
            self::Internal => 'Mutasi Internal',
        };
    }
}
```

#### `app/Enums/MutationStatus.php`
```php
namespace App\Enums;

enum MutationStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Menunggu Persetujuan',
            self::Approved => 'Disetujui',
            self::Rejected => 'Ditolak',
        };
    }
}
```

#### `app/Contracts/HasWorkflowUnits.php`
```php
namespace App\Contracts;

use App\Models\Unit;

interface HasWorkflowUnits
{
    public function getOriginUnit(): Unit;
    public function getDestinationUnit(): Unit;
}
```

### 2.2 Migrations & Schema

#### Tabel `asset_mutations`
```sql
CREATE TABLE asset_mutations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nomor_mutasi VARCHAR(50) NOT NULL UNIQUE,
    jenis_mutasi VARCHAR(30) NOT NULL, -- kec_ke_kel, antar_kel, retur_kel_ke_kec, internal
    origin_unit_id BIGINT UNSIGNED NOT NULL,
    destination_unit_id BIGINT UNSIGNED NOT NULL,
    tanggal_mutasi DATE NOT NULL,
    keterangan TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    FOREIGN KEY (origin_unit_id) REFERENCES units (id),
    FOREIGN KEY (destination_unit_id) REFERENCES units (id),
    FOREIGN KEY (created_by) REFERENCES users (id)
);
```

#### Tabel `asset_mutation_items`
```sql
CREATE TABLE asset_mutation_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    asset_mutation_id BIGINT UNSIGNED NOT NULL,
    asset_id BIGINT UNSIGNED NOT NULL,
    target_holder_id BIGINT UNSIGNED NULL, -- FK ke pegawais (wajib untuk internal, opsional untuk antar-unit)
    catatan VARCHAR(255) NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    FOREIGN KEY (asset_mutation_id) REFERENCES asset_mutations (id) ON DELETE CASCADE,
    FOREIGN KEY (asset_id) REFERENCES assets (id),
    FOREIGN KEY (target_holder_id) REFERENCES pegawais (id)
);
```

### 2.3 Models & Relationships

#### `AssetMutation` Model
- Mengimplementasikan `HasWorkflowUnits`.
- Relasi:
  - `originUnit()` &rarr; `BelongsTo(Unit::class, 'origin_unit_id')`
  - `destinationUnit()` &rarr; `BelongsTo(Unit::class, 'destination_unit_id')`
  - `creator()` &rarr; `BelongsTo(User::class, 'created_by')`
  - `items()` &rarr; `HasMany(AssetMutationItem::class)`
  - `photos()` &rarr; `MorphMany(AssetPhoto::class, 'photoable')`
  - `approvalRequest()` &rarr; `MorphOne(ApprovalRequest::class, 'approvable')`
- Helper: `approvalTitle()` &rarr; `"Mutasi Aset #{$this->nomor_mutasi}"`

#### `AssetMutationItem` Model
- Relasi:
  - `mutation()` &rarr; `BelongsTo(AssetMutation::class, 'asset_mutation_id')`
  - `asset()` &rarr; `BelongsTo(Asset::class, 'asset_id')`
  - `targetHolder()` &rarr; `BelongsTo(Pegawai::class, 'target_holder_id')`

---

## 3. Workflow Definitions & Generic Engine Integration

### 3.1 Definisi 5 Alur di `WorkflowDefinitionSeeder`

1. **`mutasi_kec_ke_kel`** (Kecamatan &rarr; Kelurahan):
   - Step 1: `kasubag` (verifikasi pengeluaran aset kecamatan) | Scope: `none`
   - Step 2: `camat` (persetujuan pengeluaran aset kecamatan) | Scope: `origin`
   - Step 3: `admin_kelurahan` (verifikasi fisik barang masuk di kelurahan tujuan) | Scope: `destination`
   - Step 4: `lurah` (persetujuan penerimaan aset di kelurahan tujuan) | Scope: `destination`

2. **`mutasi_antar_kel`** (Antar Kelurahan):
   - Step 1: `lurah` (persetujuan pengeluaran aset di kelurahan asal) | Scope: `origin`
   - Step 2: `admin_kelurahan` (verifikasi fisik barang di kelurahan tujuan) | Scope: `destination`
   - Step 3: `lurah` (persetujuan penerimaan aset di kelurahan tujuan) | Scope: `destination`

3. **`retur_kel_ke_kec`** (Retur Kelurahan &rarr; Kecamatan):
   - Step 1: `lurah` (persetujuan pengembalian aset dari kelurahan) | Scope: `origin`
   - Step 2: `admin_kecamatan` (verifikasi fisik barang tiba di kecamatan) | Scope: `destination`
   - Step 3: `kasubag` (verifikasi administrasi aset masuk kecamatan) | Scope: `none`
   - Step 4: `camat` (persetujuan penerimaan kembali ke kecamatan) | Scope: `destination`

4. **`mutasi_internal_kec`** (Internal Kecamatan):
   - Step 1: `camat` (persetujuan mutasi ruangan/pemegang internal kecamatan) | Scope: `origin`

5. **`mutasi_internal_kel`** (Internal Kelurahan):
   - Step 1: `lurah` (persetujuan mutasi ruangan/pemegang internal kelurahan) | Scope: `origin`

### 3.2 Pemetaan Otomatis Kode Workflow saat Submit

Service mendeteksi kode workflow yang tepat berdasarkan `jenis_mutasi` dan tipe `origin_unit`:
```php
public function resolveWorkflowCode(MutationType $type, Unit $originUnit): string
{
    return match ($type) {
        MutationType::KecKeKel => 'mutasi_kec_ke_kel',
        MutationType::AntarKel => 'mutasi_antar_kel',
        MutationType::ReturKelKeKec => 'retur_kel_ke_kec',
        MutationType::Internal => $originUnit->isKecamatan()
            ? 'mutasi_internal_kec'
            : 'mutasi_internal_kel',
    };
}
```

### 3.3 Penyesuaian `ApprovalWorkflowService`

#### A. Method `canAct()`
Menyempurnakan resolver scope `origin` dan `destination`:
```php
return match ($step->unit_scope) {
    UnitScope::None => true,
    UnitScope::Subject => $user->canAccessUnit($request->approvable->unit),
    UnitScope::Origin => $request->approvable instanceof HasWorkflowUnits
        && $user->canAccessUnit($request->approvable->getOriginUnit()),
    UnitScope::Destination => $request->approvable instanceof HasWorkflowUnits
        && $user->canAccessUnit($request->approvable->getDestinationUnit()),
};
```

#### B. Method `approversFor()`
Menyesuaikan penerima notifikasi step in-app:
```php
if ($step->unit_scope === UnitScope::Subject) {
    return $users->filter(fn (User $u) => $u->canAccessUnit($approvable->unit))->values();
}
if ($step->unit_scope === UnitScope::Origin && $approvable instanceof HasWorkflowUnits) {
    return $users->filter(fn (User $u) => $u->canAccessUnit($approvable->getOriginUnit()))->values();
}
if ($step->unit_scope === UnitScope::Destination && $approvable instanceof HasWorkflowUnits) {
    return $users->filter(fn (User $u) => $u->canAccessUnit($approvable->getDestinationUnit()))->values();
}
```

#### C. Hook Penolakan (`reject`)
Saat request ditolak, jika approvable memiliki method `onApprovalRejected()`, panggil method tersebut agar status mutasi diset `rejected` dan kunci aset dikembalikan menjadi `AssetStatus::Aktif`.

---

## 4. Siklus Transaksi, Integritas Status & Effect Handler

### 4.1 Validasi & Penguncian Status Aset saat Submit
1. **Pengecekan Kepemilikan & Status:**
   - Semua `asset_id` yang diajukan wajib milik `origin_unit_id`.
   - Semua `asset_id` wajib berstatus `AssetStatus::Aktif`. Jika salah satu aset berstatus `AssetStatus::DalamProses` (sedang dalam proses mutasi/transaksi lain), sistem melempar validasi exception.
2. **Aturan Mutasi Internal:**
   - `origin_unit_id` harus sama dengan `destination_unit_id`.
   - Tiap item wajib memilih `target_holder_id` yang merupakan pegawai di unit tersebut.
3. **Aturan Mutasi Antar-Unit:**
   - `origin_unit_id` tidak boleh sama dengan `destination_unit_id`.
   - `target_holder_id` bersifat opsional. Jika diisi, pegawai tersebut harus terdaftar di `destination_unit_id`.
4. **Penguncian Aset:**
   - Seluruh aset diupdate menjadi `AssetStatus::DalamProses` dalam satu transaksi DB.

### 4.2 Penanganan Penolakan (`reject`)
- Transaksi `approval_requests.status` menjadi `rejected`.
- `asset_mutations.status` menjadi `rejected`.
- Seluruh aset di `asset_mutation_items` dikembalikan menjadi `AssetStatus::Aktif`.

### 4.3 Eksekusi Efek Final (`AssetMutationEffect`)
Didaftarkan di `config/workflow.php`:
```php
'effects' => [
    'penerimaan_aset'     => PenerimaanAsetEffect::class,
    'mutasi_kec_ke_kel'   => AssetMutationEffect::class,
    'mutasi_antar_kel'    => AssetMutationEffect::class,
    'retur_kel_ke_kec'    => AssetMutationEffect::class,
    'mutasi_internal_kec' => AssetMutationEffect::class,
    'mutasi_internal_kel' => AssetMutationEffect::class,
],
```

Logika `AssetMutationEffect::apply(AssetMutation $mutation)`:
Untuk setiap item dalam `$mutation->items`:
1. **Update Aset:**
   - `unit_id = $mutation->destination_unit_id`
   - `current_holder_id = $item->target_holder_id`
   - `status = AssetStatus::Aktif`
2. **Audit Trail `AssetHistory`:**
   - `asset_id = $asset->id`
   - `event = 'mutasi'`
   - `unit_id = $mutation->destination_unit_id`
   - `current_holder_id = $item->target_holder_id`
   - `kondisi = $asset->kondisi`
   - `user_id = auth()->id()` (approver step final)
   - `keterangan = "Mutasi {$mutation->jenis_mutasi->label()} ({$originName} -> {$destinationName}) via No. {$mutation->nomor_mutasi}. {$item->catatan}"`
   - `created_at = now()`
3. **Update Status Header:**
   - `$mutation->update(['status' => MutationStatus::Approved]);`

---

## 5. Layer Repository, Policy & Controller

### 5.1 Repository Pattern
- `AssetMutationRepositoryInterface` & `AssetMutationRepository`:
  - `createWithItems(array $data, array $items): AssetMutation`
  - `findById(int $id): ?AssetMutation`
  - `paginateForUser(User $user, int $perPage = 15)` (disaring sesuai `accessibleUnitIds()`)

### 5.2 Authorization & Policy (`AssetMutationPolicy`)
- `viewAny(User $user)`: Semua user yang diautentikasi.
- `view(User $user, AssetMutation $mutation)`: User dapat mengakses jika memiliki akses ke `origin_unit_id` atau `destination_unit_id` (atau Kasubag/Camat).
- `create(User $user)`: Hanya role admin (`admin_kecamatan`, `admin_kelurahan`).
  - Admin Kecamatan hanya boleh mengajukan dengan `origin_unit = Kecamatan`.
  - Admin Kelurahan hanya boleh mengajukan dengan `origin_unit = Kelurahannya`.

### 5.3 Controller Endpoints
- `GET /asset-mutations` &rarr; `AssetMutationController@index`
- `GET /asset-mutations/create` &rarr; `AssetMutationController@create` (mengirim data unit dan daftar aset aktif yang siap dimutasi)
- `POST /asset-mutations` &rarr; `AssetMutationController@store`
- `GET /asset-mutations/{assetMutation}` &rarr; `AssetMutationController@show`
- Aksi `approve` dan `reject` memanfaatkan endpoint generic approval workflow yang sudah ada (`POST /approvals/{approvalRequest}/approve` & `reject`).

---

## 6. Rencana Pengujian Otomatis (Pest Tests)

1. **`ApprovalWorkflowServiceTest`**:
   - Memastikan `canAct` benar untuk scope `none`, `subject`, `origin`, dan `destination`.
   - Memastikan `approversFor` mengembalikan koleksi user sesuai scope unit.
2. **`AssetMutationServiceTest` & `AssetMutationEffectTest`**:
   - Submit mutasi berhasil mengubah status aset ke `dalam_proses`.
   - Error jika aset yang diajukan tidak aktif atau bukan milik unit asal.
   - Efek final memindahkan `unit_id`, update `current_holder_id`, mengembalikan status ke `aktif`, dan mencatat `asset_histories`.
   - Reject melepaskan kunci status aset kembali ke `aktif`.
3. **`AssetMutationFeatureTest`**:
   - Uji alur lengkap dari store request oleh admin &rarr; approval tiap step &rarr; verifikasi efek akhir untuk ke-4 alur mutasi.
   - Uji policy authorization (admin kelurahan lain tidak boleh melihat/mengajukan mutasi unit yang bukan haknya).
