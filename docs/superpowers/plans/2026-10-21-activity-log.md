# Log Aktivitas Sistem (Audit Trail) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun fitur Log Aktivitas Sistem (Audit Trail) terpusat berbasis `spatie/laravel-activitylog` dengan Smart Diff Inspector dan antarmuka khusus Super Admin di SIBIMA.

**Architecture:** Model events dilacak secara otomatis menggunakan trait `LogsActivity` dengan konfigurasi `logOnlyDirty()` dan `dontSubmitEmptyLogs()`. Log disimpan pada tabel `activity_log` dengan retensi 90 hari via daily scheduler. Backend menggunakan `ActivityLogPresenter` untuk menyajikan diff manusiawi dalam Bahasa Indonesia, dan frontend Inertia React menyediakan tabel riwayat dengan filter multi-kriteria serta modal diff inspector yang didesain dengan standar craft Impeccable (Operate Mode).

**Tech Stack:** Laravel 12 (`^13.33`), PHP 8.4, `spatie/laravel-activitylog`, Inertia.js v2, React 19, Tailwind CSS v4, Pest PHP.

**Spec:** [docs/superpowers/specs/2026-10-21-activity-log-design.md](file:///c:/Users/abdulaziz/Documents/pribadi/SIBIMA/docs/superpowers/specs/2026-10-21-activity-log-design.md)

## Global Constraints

- Retensi log 90 hari: `'delete_records_older_than_days' => 90`.
- Keamanan: Kolom `password` dan `remember_token` pada model `User` dilarang keras dicatat ke log.
- Otorisasi: Rute `/pengaturan/log-aktivitas` hanya boleh diakses oleh pengguna dengan role `super-admin`.
- Kinerja: Gunakan `logOnlyDirty()` untuk mencegah penyimpanan log kosong yang membebani memori MySQL pada VPS 4GB RAM.
- Prinsip Ponytail: Gunakan native Tailwind & komponen yang sudah ada di repo; jangan membuat abstraksi atau helper yang spekulatif.
- Prinsip Impeccable: Mode *Operate* — scanability tinggi, badge kontras jelas, diff inspector tabel 3 kolom dengan soft color pills, responsive mobile s.d. desktop, dan penanganan empty state yang rapi.

---

### Task 1: Instalasi & Konfigurasi Spatie Activitylog

**Files:**
- Modify: `composer.json`
- Create: `config/activitylog.php`
- Create: `database/migrations/*_create_activity_log_table.php`
- Modify: `routes/console.php`
- Test: `tests/Feature/ActivityLogInstallationTest.php`

**Interfaces:**
- Produces: Tabel `activity_log` dan Artisan command `activitylog:clean` terdaftar di daily scheduler.

- [ ] **Step 1: Write the failing installation & schedule test**

```php
<?php

// tests/Feature/ActivityLogInstallationTest.php

use Illuminate\Support\Facades\Schema;
use Spatie\Activitylog\Models\Activity;

it('has activity_log table with required schema columns', function () {
    expect(Schema::hasTable('activity_log'))->toBeTrue()
        ->and(Schema::hasColumns('activity_log', [
            'id', 'log_name', 'description', 'subject_type', 'subject_id',
            'causer_type', 'causer_id', 'properties', 'created_at',
        ]))->toBeTrue();
});

it('has activitylog configuration with 90 days retention', function () {
    expect(config('activitylog.delete_records_older_than_days'))->toBe(90);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/ActivityLogInstallationTest.php --compact`  
Expected: FAIL with "Class Spatie\Activitylog\Models\Activity not found" or "table activity_log does not exist".

- [ ] **Step 3: Install package, publish config, migration, and schedule command**

Run commands in terminal:
```bash
composer require spatie/laravel-activitylog:^4.10 --no-interaction
php artisan vendor:publish --provider="Spatie\Activitylog\ActivitylogServiceProvider" --tag="activitylog-migrations"
php artisan vendor:publish --provider="Spatie\Activitylog\ActivitylogServiceProvider" --tag="activitylog-config"
php artisan migrate --force
```

Update `config/activitylog.php`:
```php
'delete_records_older_than_days' => 90,
```

Update `routes/console.php`:
Tambahkan jadwal pembersihan otomatis harian:
```php
use Illuminate\Support\Facades\Schedule;

Schedule::command('activitylog:clean')->dailyAt('02:00');
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/ActivityLogInstallationTest.php --compact`  
Expected: PASS (2 tests passed).

- [ ] **Step 5: Commit**

```bash
git add composer.json composer.lock config/activitylog.php database/migrations/*activity_log* routes/console.php tests/Feature/ActivityLogInstallationTest.php
git commit -m "feat(activity-log): install and configure spatie activitylog with 90 days retention"
```

---

### Task 2: Integrasi Model Events & Keamanan Privasi Data

**Files:**
- Modify: `app/Models/Asset.php`
- Modify: `app/Models/Pegawai.php`
- Modify: `app/Models/User.php`
- Modify: `app/Models/AssetCategory.php`
- Modify: `app/Models/BeritaAcaraPenerimaan.php`
- Modify: `app/Models/AssetMutation.php`
- Modify: `app/Models/AssetReport.php`
- Modify: `app/Models/WorkflowDefinition.php`
- Modify: `app/Models/Role.php`
- Test: `tests/Feature/ActivityLogModelEventsTest.php`

**Interfaces:**
- Consumes: `Spatie\Activitylog\Traits\LogsActivity`, `Spatie\Activitylog\LogOptions`
- Produces: Otomatis mencatat event `created`, `updated` (hanya field kotor/berubah), dan `deleted` pada model-model inti SIBIMA.

- [ ] **Step 1: Write the failing model events test**

```php
<?php

// tests/Feature/ActivityLogModelEventsTest.php

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Pegawai;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\UnitSeeder;
use Spatie\Activitylog\Models\Activity;

beforeEach(function () {
    $this->seed([RoleSeeder::class, PermissionSeeder::class, UnitSeeder::class]);
});

it('logs created and updated events for asset with dirty attributes only', function () {
    $user = User::factory()->create();
    $unit = Unit::first();
    $category = AssetCategory::factory()->create(['name' => 'Elektronik']);

    $this->actingAs($user);

    $asset = Asset::create([
        'name' => 'Laptop Lenovo',
        'code' => '1.3.2.05.02',
        'register_number' => '0001',
        'asset_category_id' => $category->id,
        'unit_id' => $unit->id,
        'condition' => 'Baik',
        'status' => 'Tersedia',
        'acquisition_price' => 12000000,
        'book_value' => 12000000,
        'acquisition_date' => now()->subYear(),
        'source' => 'APBD',
    ]);

    expect(Activity::where('subject_type', Asset::class)->where('subject_id', $asset->id)->count())->toBe(1);

    // Update condition
    $asset->update(['condition' => 'Rusak Berat']);

    $updateLog = Activity::where('subject_type', Asset::class)
        ->where('subject_id', $asset->id)
        ->where('event', 'updated')
        ->latest('id')
        ->first();

    expect($updateLog)->not->toBeNull()
        ->and($updateLog->properties['old']['condition'])->toBe('Baik')
        ->and($updateLog->properties['attributes']['condition'])->toBe('Rusak Berat')
        ->and(isset($updateLog->properties['attributes']['name']))->toBeFalse(); // logOnlyDirty check
});

it('strictly excludes user password and remember_token from activity logs', function () {
    $admin = User::factory()->create();
    $this->actingAs($admin);

    $targetUser = User::factory()->create(['password' => 'secret123']);

    $targetUser->update([
        'name' => 'Nama Baru',
        'password' => 'passwordBaruRahasia!',
    ]);

    $log = Activity::where('subject_type', User::class)
        ->where('subject_id', $targetUser->id)
        ->where('event', 'updated')
        ->latest('id')
        ->first();

    expect($log)->not->toBeNull()
        ->and(isset($log->properties['attributes']['password']))->toBeFalse()
        ->and(isset($log->properties['old']['password']))->toBeFalse()
        ->and($log->properties['attributes']['name'])->toBe('Nama Baru');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/ActivityLogModelEventsTest.php --compact`  
Expected: FAIL (no logs created yet because models do not use `LogsActivity`).

- [ ] **Step 3: Implement `LogsActivity` on target models**

Di `app/Models/Asset.php`:
```php
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

// di dalam class:
use LogsActivity;

public function getActivitylogOptions(): LogOptions
{
    return LogOptions::defaults()
        ->useLogName('asset')
        ->logOnly([
            'name', 'code', 'register_number', 'asset_category_id', 'unit_id',
            'user_id', 'condition', 'status', 'book_value', 'acquisition_price',
            'acquisition_date', 'source',
        ])
        ->logOnlyDirty()
        ->dontSubmitEmptyLogs();
}
```

Di `app/Models/User.php`:
```php
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

// di dalam class:
use LogsActivity;

public function getActivitylogOptions(): LogOptions
{
    return LogOptions::defaults()
        ->useLogName('user')
        ->logOnly(['name', 'email', 'is_active', 'unit_id', 'unit_scope_override'])
        ->logExcept(['password', 'remember_token'])
        ->logOnlyDirty()
        ->dontSubmitEmptyLogs();
}
```

Terapkan pola yang sama dengan nama log spesifik pada:
- `Pegawai.php` (`logName: pegawai`, log: `nama, nip, pangkat_golongan, jabatan, status_kepegawaian, unit_id, no_hp, email_dinas`)
- `AssetCategory.php` (`logName: kategori`, log: `name, code, parent_id`)
- `BeritaAcaraPenerimaan.php` (`logName: berita-acara`, log: `nomor_surat, tanggal, rekanan, unit_id, status`)
- `AssetMutation.php` (`logName: mutasi`, log: `nomor_mutasi, unit_asal_id, unit_tujuan_id, status`)
- `AssetReport.php` (`logName: laporan`, log: `nomor_laporan, status`)
- `WorkflowDefinition.php` (`logName: alur`, log: `name, is_active`)
- `Role.php` (`logName: role`, log: `name`)

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/ActivityLogModelEventsTest.php --compact`  
Expected: PASS (All tests pass).

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(activity-log): add LogsActivity trait and sanitize sensitive fields across models"
```

---

### Task 3: Backend Controller, Smart Presenter & Route Authorization

**Files:**
- Create: `app/Services/ActivityLogPresenter.php`
- Create: `app/Http/Controllers/ActivityLogController.php`
- Modify: `routes/web.php`
- Test: `tests/Feature/ActivityLogControllerTest.php`

**Interfaces:**
- `ActivityLogPresenter::present(Activity $log): array`
  - Input: instance `Activity`
  - Output: array `['id', 'waktu', 'waktu_relatif', 'pelaku', 'aksi', 'modul', 'target', 'diff']`
- `ActivityLogController::index(Request $request): Inertia\Response`
  - In: query filters `q`, `modul`, `event`, `user_id`, `start_date`, `end_date`
  - Out: props `['logs', 'filters', 'modules', 'events']`

- [ ] **Step 1: Write the failing controller & authorization test**

```php
<?php

// tests/Feature/ActivityLogControllerTest.php

use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\UnitSeeder;
use Spatie\Activitylog\Models\Activity;

beforeEach(function () {
    $this->seed([RoleSeeder::class, PermissionSeeder::class, UnitSeeder::class]);
});

it('allows super-admin to view activity logs index', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super-admin');

    $this->actingAs($admin)
        ->get(route('activity-logs.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('ActivityLogs/Index'));
});

it('forbids non-super-admin users from viewing activity logs', function () {
    $kasubag = User::factory()->create();
    $kasubag->assignRole('kasubag');

    $this->actingAs($kasubag)
        ->get(route('activity-logs.index'))
        ->assertForbidden();
});

it('filters logs by module and event correctly', function () {
    $admin = User::factory()->create();
    $admin->assignRole('super-admin');

    activity('asset')->log('Buat aset');
    activity('pegawai')->log('Buat pegawai');

    $this->actingAs($admin)
        ->get(route('activity-logs.index', ['modul' => 'asset']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('logs.data', 1)
            ->where('logs.data.0.modul', 'asset')
        );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/ActivityLogControllerTest.php --compact`  
Expected: FAIL (Route `activity-logs.index` not defined).

- [ ] **Step 3: Implement `ActivityLogPresenter` and `ActivityLogController`**

Buat `app/Services/ActivityLogPresenter.php`:
```php
<?php

namespace App\Services;

use App\Models\AssetCategory;
use App\Models\Unit;
use App\Models\User;
use Spatie\Activitylog\Models\Activity;

class ActivityLogPresenter
{
    private const LABELS = [
        'name' => 'Nama',
        'code' => 'Kode Barang',
        'register_number' => 'No. Register',
        'asset_category_id' => 'Kategori Aset',
        'unit_id' => 'Unit Kerja',
        'user_id' => 'Penanggung Jawab',
        'condition' => 'Kondisi Fisik',
        'status' => 'Status Operasional',
        'acquisition_price' => 'Harga Perolehan',
        'book_value' => 'Nilai Buku',
        'acquisition_date' => 'Tanggal Perolehan',
        'source' => 'Sumber Perolehan',
        'nama' => 'Nama Pegawai',
        'nip' => 'NIP',
        'pangkat_golongan' => 'Pangkat/Golongan',
        'jabatan' => 'Jabatan',
        'status_kepegawaian' => 'Status Kepegawaian',
        'no_hp' => 'Nomor HP',
        'email_dinas' => 'Email Dinas',
        'email' => 'Email',
        'is_active' => 'Status Akun',
        'nomor_surat' => 'Nomor Surat',
        'nomor_mutasi' => 'Nomor Mutasi',
        'nomor_laporan' => 'Nomor Laporan',
    ];

    public function format(Activity $log): array
    {
        $old = $log->properties['old'] ?? [];
        $new = $log->properties['attributes'] ?? [];
        $diff = [];

        $allKeys = array_unique(array_merge(array_keys($old), array_keys($new)));

        foreach ($allKeys as $key) {
            if (in_array($key, ['password', 'remember_token', 'updated_at', 'created_at'], true)) {
                continue;
            }

            $diff[] = [
                'field' => self::LABELS[$key] ?? ucfirst(str_replace('_', ' ', $key)),
                'key' => $key,
                'old' => $this->humanizeValue($key, $old[$key] ?? null),
                'new' => $this->humanizeValue($key, $new[$key] ?? null),
            ];
        }

        return [
            'id' => $log->id,
            'waktu' => $log->created_at->translatedFormat('d M Y, H:i').' WIB',
            'waktu_relatif' => $log->created_at->diffForHumans(),
            'pelaku' => [
                'nama' => $log->causer?->name ?? 'Sistem / Anonim',
                'email' => $log->causer?->email,
                'role' => $log->causer?->roles->pluck('name')->first() ?? '-',
            ],
            'aksi' => $log->event ?? 'updated',
            'modul' => $log->log_name ?? 'umum',
            'deskripsi' => $log->description,
            'target' => $this->resolveTargetName($log),
            'diff' => $diff,
        ];
    }

    private function humanizeValue(string $key, mixed $val): string
    {
        if ($val === null || $val === '') return '-';
        if (is_bool($val)) return $val ? 'Aktif' : 'Nonaktif';
        if ($key === 'is_active') return $val ? 'Aktif' : 'Nonaktif';
        if ($key === 'unit_id' && is_numeric($val)) return Unit::find($val)?->name ?? "Unit #{$val}";
        if ($key === 'asset_category_id' && is_numeric($val)) return AssetCategory::find($val)?->name ?? "Kategori #{$val}";
        if ($key === 'user_id' && is_numeric($val)) return User::find($val)?->name ?? "User #{$val}";
        if (in_array($key, ['acquisition_price', 'book_value'], true) && is_numeric($val)) {
            return 'Rp ' . number_format((float)$val, 0, ',', '.');
        }

        return (string) $val;
    }

    private function resolveTargetName(Activity $log): string
    {
        if ($log->subject) {
            return $log->subject->name ?? $log->subject->nama ?? $log->subject->nomor_surat ?? $log->subject->nomor_mutasi ?? class_basename($log->subject_type);
        }
        return class_basename($log->subject_type ?: 'Data');
    }
}
```

Buat `app/Http/Controllers/ActivityLogController.php`:
```php
<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\ActivityLogPresenter;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Activitylog\Models\Activity;

class ActivityLogController extends Controller
{
    public function __construct(private readonly ActivityLogPresenter $presenter) {}

    public function index(Request $request): Response
    {
        abort_unless($request->user()->hasRole('super-admin'), 403);

        $query = Activity::with(['causer.roles', 'subject'])->latest('id');

        if ($request->filled('q')) {
            $search = '%' . trim((string)$request->input('q')) . '%';
            $query->where(function ($q) use ($search) {
                $q->where('description', 'like', $search)
                  ->orWhereHasMorph('causer', [User::class], fn ($uq) => $uq->where('name', 'like', $search)->orWhere('email', 'like', $search));
            });
        }

        if ($request->filled('modul')) {
            $query->where('log_name', $request->input('modul'));
        }

        if ($request->filled('event')) {
            $query->where('event', $request->input('event'));
        }

        if ($request->filled('user_id')) {
            $query->where('causer_type', User::class)->where('causer_id', $request->input('user_id'));
        }

        if ($request->filled('start_date')) {
            $query->whereDate('created_at', '>=', $request->input('start_date'));
        }

        if ($request->filled('end_date')) {
            $query->whereDate('created_at', '<=', $request->input('end_date'));
        }

        $logs = $query->paginate(15)->withQueryString()->through(fn (Activity $log) => $this->presenter->format($log));

        $modules = [
            ['value' => 'asset', 'label' => 'Data Aset'],
            ['value' => 'pegawai', 'label' => 'Pegawai'],
            ['value' => 'user', 'label' => 'Pengguna (User)'],
            ['value' => 'kategori', 'label' => 'Kategori BMD'],
            ['value' => 'berita-acara', 'label' => 'Berita Acara'],
            ['value' => 'mutasi', 'label' => 'Mutasi Aset'],
            ['value' => 'laporan', 'label' => 'Laporan Kerusakan'],
            ['value' => 'alur', 'label' => 'Alur Persetujuan'],
            ['value' => 'role', 'label' => 'Peran (Role)'],
        ];

        return Inertia::render('ActivityLogs/Index', [
            'logs' => $logs,
            'filters' => $request->only(['q', 'modul', 'event', 'user_id', 'start_date', 'end_date']),
            'modules' => $modules,
            'users' => User::select('id', 'name')->orderBy('name')->get(),
        ]);
    }
}
```

Daftarkan di `routes/web.php`:
```php
use App\Http\Controllers\ActivityLogController;

Route::middleware(['auth', 'verified'])->group(function () {
    // ...
    Route::get('/pengaturan/log-aktivitas', [ActivityLogController::class, 'index'])->name('activity-logs.index');
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/ActivityLogControllerTest.php --compact`  
Expected: PASS (3 tests passed).

- [ ] **Step 5: Commit**

```bash
git add app/Services/ActivityLogPresenter.php app/Http/Controllers/ActivityLogController.php routes/web.php tests/Feature/ActivityLogControllerTest.php
git commit -m "feat(activity-log): add ActivityLogController, presenter with human diff, and route"
```

---

### Task 4: Frontend UI - Activity Log Page, Diff Inspector & Navigation

**Files:**
- Modify: `resources/js/Layouts/AuthenticatedLayout.tsx`
- Create: `resources/js/Pages/ActivityLogs/Index.tsx`
- Create: `resources/js/Pages/ActivityLogs/Partials/DiffInspectorModal.tsx`
- Test: Frontend build & UI verification

**Design Standards Applied (Impeccable - Operate Mode):**
- Layout: Kontras tinggi, typography tabular numbers untuk tanggal/waktu, badge jelas.
- Responsive: Horizontally scrollable table on mobile with fixed first/last column affordance, touch targets minimum 44px.
- Diff Inspector: 3-column table showing Field Name, Old Value (soft red pill `#fee2e2`), New Value (soft green pill `#dcfce7`).
- Empty State: Ilustrasi pencarian kosong yang ramah dengan tombol reset filter.

- [ ] **Step 1: Update Navigation Sidebar (`AuthenticatedLayout.tsx`)**

Buka `resources/js/Layouts/AuthenticatedLayout.tsx`:
Pada grup menu **Pengaturan**, tambahkan item `Log Aktivitas` jika user memiliki role `super-admin`:
```tsx
{
    title: 'Log Aktivitas',
    href: '/pengaturan/log-aktivitas',
    icon: ActivityIcon, // or ClockRewind icon
    permission: role === 'super-admin',
}
```

- [ ] **Step 2: Create DiffInspectorModal component**

Buat `resources/js/Pages/ActivityLogs/Partials/DiffInspectorModal.tsx`:
- Modal dialog dengan tombol tutup Escape & klik di luar.
- Menampilkan rincian subjek, waktu, dan pelaku.
- Menampilkan tabel perbandingan 3 kolom (`Informasi`, `Nilai Sebelumnya`, `Nilai Diperbarui`).
- Menangani event `created` (hanya menampilkan nilai baru) dan `deleted` (hanya menampilkan nilai sebelum dihapus).

- [ ] **Step 3: Create Main Activity Logs Page (`ActivityLogs/Index.tsx`)**

Buat `resources/js/Pages/ActivityLogs/Index.tsx`:
- Search input dengan debounce.
- Dropdown Modul, Dropdown Event (`created`, `updated`, `deleted`), Date picker range.
- Tabel dengan kolom Waktu, Pelaku, Aksi, Modul, Target, dan tombol "Lihat Perubahan".
- Tombol "Lihat Perubahan" membuka `DiffInspectorModal`.
- Inertia pagination.

- [ ] **Step 4: Build frontend and verify no TypeScript/Vite errors**

Run in terminal:
```bash
npm run build
```
Expected: Build succeeds with 0 errors.

- [ ] **Step 5: Run Pint code formatter**

Run: `vendor/bin/pint --dirty --format agent`  
Expected: `{"tool":"pint","result":"passed"}`.

- [ ] **Step 6: Run full test suite**

Run: `php artisan test tests/Feature/ActivityLog*.php --compact`  
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add resources/js/Layouts/AuthenticatedLayout.tsx resources/js/Pages/ActivityLogs/
git commit -m "feat(activity-log): add complete frontend activity logs table and diff inspector modal"
```
