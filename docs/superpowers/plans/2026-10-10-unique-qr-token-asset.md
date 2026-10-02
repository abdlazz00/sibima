# Unique QR Token untuk Aset BMD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengganti pengkodean QR code aset dari ID database numerik (`/scan/{id}`) menjadi token unik permanen alfanumerik 16 karakter (`/scan/{qr_token}`), sehingga setiap stiker fisik aset dijamin unik 100% seumur hidup dan tidak dapat tertukar meskipun data dihapus dan dibuat kembali dengan nomor register yang sama.

**Architecture:** Kolom `qr_token` alfanumerik 16 karakter ditambahkan ke tabel `assets` dengan indeks unik dan diisi otomatis melalui Eloquent `creating` event. Layanan `QrCodeService` menghasilkan URL berbasis token, rute backend memvalidasi token via regex `[A-Za-z0-9]{16}`, dan pemindai frontend (`qr.ts` & `Scan/Index.tsx`) mengekstrak token untuk lookup ke `ScanController`.

**Tech Stack:** Laravel 12, PHP 8.2+, Inertia.js, React + TypeScript, Pest PHP, BaconQrCode, Dompdf.

**Spec:** [`docs/superpowers/specs/2026-10-10-unique-qr-token-asset-design.md`](file:///C:/Users/abdulaziz/Documents/pribadi/SIBIMA/docs/superpowers/specs/2026-10-10-unique-qr-token-asset-design.md)

## Global Constraints
- Token QR berupa 16 karakter alfanumerik acak `[A-Za-z0-9]{16}` tanpa prefix.
- Token disembunyikan dari UI web (tidak ditampilkan di tabel, form, atau detail aset).
- Teks pada stiker fisik label tetap menampilkan informasi resmi BMD (Nama, Kode, Register, Unit, Tahun).
- Clean break: pemindai hanya menerima `qr_token` valid; format ID numerik lama ditolak sebagai tidak valid (404).
- Tidak menambah dependensi composer atau npm baru (gunakan `Illuminate\Support\Str::random(16)`).
- Zero test regression pada seluruh 553 test suite yang ada.

---

### Task 1: Skema Database & Model Lifecycle Aset (`qr_token`)

**Files:**
- Create: `database/migrations/2026_10_10_000001_add_qr_token_to_assets_table.php`
- Modify: `app/Models/Asset.php`
- Test: `tests/Feature/AssetQrTokenTest.php`

**Interfaces:**
- Consumes: Lifecycle Eloquent `Asset::creating`.
- Produces: Properti `Asset->qr_token` bertipe string 16 karakter unik yang terisi otomatis.

- [ ] **Step 1: Tulis test kegagalan untuk pembuatan otomatis `qr_token`**

`tests/Feature/AssetQrTokenTest.php`:
```php
<?php

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Unit;

beforeEach(function () {
    $this->unit = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
    $this->category = AssetCategory::create(['name' => 'Peralatan Komputer', 'code' => '02.06.01.02.001']);
});

it('automatically generates a 16-character alphanumeric qr_token on asset creation', function () {
    $asset = Asset::create([
        'kode_barang' => '02.06.01.02.001',
        'nomor_register' => 1,
        'nama_aset' => 'Laptop ThinkPad X1',
        'category_id' => $this->category->id,
        'unit_id' => $this->unit->id,
        'kondisi' => 'baik',
        'status' => 'aktif',
        'tanggal_perolehan' => '2026-01-15',
        'nilai_perolehan' => 15000000,
        'nilai_buku' => 15000000,
    ]);

    expect($asset->qr_token)->not->toBeNull()
        ->and(strlen($asset->qr_token))->toBe(16)
        ->and(preg_match('/^[A-Za-z0-9]{16}$/', $asset->qr_token))->toBe(1);
});

it('ensures distinct qr_tokens for newly created assets and recreating deleted register', function () {
    $asset1 = Asset::create([
        'kode_barang' => '02.06.01.02.001',
        'nomor_register' => 1,
        'nama_aset' => 'Laptop A',
        'category_id' => $this->category->id,
        'unit_id' => $this->unit->id,
        'kondisi' => 'baik',
        'status' => 'aktif',
        'tanggal_perolehan' => '2026-01-15',
        'nilai_perolehan' => 10000000,
        'nilai_buku' => 10000000,
    ]);

    $oldToken = $asset1->qr_token;

    // Hapus aset 1
    $asset1->delete();

    // Buat aset baru dengan nomor register yang sama
    $asset2 = Asset::create([
        'kode_barang' => '02.06.01.02.001',
        'nomor_register' => 1,
        'nama_aset' => 'Laptop A Baru',
        'category_id' => $this->category->id,
        'unit_id' => $this->unit->id,
        'kondisi' => 'baik',
        'status' => 'aktif',
        'tanggal_perolehan' => '2026-02-15',
        'nilai_perolehan' => 12000000,
        'nilai_buku' => 12000000,
    ]);

    expect($asset2->qr_token)->not->toBe($oldToken)
        ->and(strlen($asset2->qr_token))->toBe(16);
});
```

- [ ] **Step 2: Jalankan test untuk memverifikasi kegagalan**

Run: `php artisan test --filter=AssetQrTokenTest`  
Expected: FAIL (kolom `qr_token` belum ada di tabel `assets`).

- [ ] **Step 3: Buat file migrasi database dan update model `Asset`**

Buat migrasi `database/migrations/2026_10_10_000001_add_qr_token_to_assets_table.php`:
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->string('qr_token', 16)->nullable()->unique()->after('id');
        });

        // Backfill data eksisting
        DB::table('assets')->whereNull('qr_token')->orderBy('id')->chunk(100, function ($assets) {
            foreach ($assets as $asset) {
                DB::table('assets')
                    ->where('id', $asset->id)
                    ->update(['qr_token' => Str::random(16)]);
            }
        });
    }

    public function down(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->dropColumn('qr_token');
        });
    }
};
```

Update `app/Models/Asset.php`:
Tambahkan `'qr_token'` ke `$fillable`, dan tambahkan event handler `creating` pada method `booted()`:
```php
        static::creating(function (Asset $asset) {
            if (empty($asset->qr_token)) {
                do {
                    $token = \Illuminate\Support\Str::random(16);
                } while (static::where('qr_token', $token)->exists());

                $asset->qr_token = $token;
            }
        });
```

- [ ] **Step 4: Jalankan test untuk memverifikasi kelulusan**

Run: `php artisan test --filter=AssetQrTokenTest`  
Expected: PASS (2 tests, assertions pass).

- [ ] **Step 5: Commit perubahan Task 1**

```bash
git add database/migrations/2026_10_10_000001_add_qr_token_to_assets_table.php app/Models/Asset.php tests/Feature/AssetQrTokenTest.php
git commit -m "feat(assets): add unique 16-character qr_token to assets with auto-generation on create"
```

---

### Task 2: Pembaruan Layanan QR Code (`QrCodeService`)

**Files:**
- Modify: `app/Services/QrCodeService.php`
- Test: `tests/Feature/QrCodeServiceTokenTest.php`

**Interfaces:**
- Consumes: Model `Asset` dengan properti `qr_token`.
- Produces: `QrCodeService::urlForAsset(Asset $asset)` menghasilkan string URL target berformat `.../scan/{qr_token}`.

- [ ] **Step 1: Tulis test verifikasi format URL QR**

`tests/Feature/QrCodeServiceTokenTest.php`:
```php
<?php

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Unit;
use App\Services\QrCodeService;

it('generates scan URL using qr_token instead of numeric database id', function () {
    $unit = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
    $category = AssetCategory::create(['name' => 'Peralatan', 'code' => '02.06.01.02.001']);

    $asset = Asset::create([
        'kode_barang' => '02.06.01.02.001',
        'nomor_register' => 1,
        'nama_aset' => 'Meja Kerja',
        'category_id' => $category->id,
        'unit_id' => $unit->id,
        'kondisi' => 'baik',
        'status' => 'aktif',
        'tanggal_perolehan' => '2026-01-15',
        'nilai_perolehan' => 1000000,
        'nilai_buku' => 1000000,
    ]);

    $service = app(QrCodeService::class);
    $url = $service->urlForAsset($asset);

    expect($url)->toBe(rtrim(config('app.url'), '/') . '/scan/' . $asset->qr_token)
        ->and($url)->not->toContain('/scan/' . $asset->id);
});
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `php artisan test --filter=QrCodeServiceTokenTest`  
Expected: FAIL (karena `QrCodeService` masih memanggil `route('scan.show', ['id' => $asset->id])`).

- [ ] **Step 3: Update `app/Services/QrCodeService.php`**

Ubah method `urlForAsset`:
```php
    public function urlForAsset(Asset $asset): string
    {
        return rtrim(config('app.url'), '/').route('scan.show', ['token' => $asset->qr_token], false);
    }
```

- [ ] **Step 4: Jalankan test dan pastikan lulus**

Run: `php artisan test --filter=QrCodeServiceTokenTest`  
Expected: PASS.

- [ ] **Step 5: Commit perubahan Task 2**

```bash
git add app/Services/QrCodeService.php tests/Feature/QrCodeServiceTokenTest.php
git commit -m "feat(qr): update QrCodeService to generate target URLs using qr_token"
```

---

### Task 3: Backend Routing & Controller Pemindai (`ScanController`)

**Files:**
- Modify: `routes/web.php`
- Modify: `app/Http/Controllers/ScanController.php`
- Test: `tests/Feature/ScanTokenLookupTest.php`

**Interfaces:**
- Consumes: Route parameter `{token}` alfanumerik 16 karakter.
- Produces: Inertia page `Scan/Index` dengan ringkasan aset atau HTTP 404 (`notFound: true`).

- [ ] **Step 1: Tulis test lookup token pemindai**

`tests/Feature/ScanTokenLookupTest.php`:
```php
<?php

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->seed(PermissionSeeder::class);

    $this->unit = Unit::create(['name' => 'Kecamatan Sagulung', 'type' => 'kecamatan']);
    $this->category = AssetCategory::create(['name' => 'Peralatan', 'code' => '02.06.01.02.001']);

    $this->user = User::factory()->create(['unit_id' => $this->unit->id]);
    $this->user->assignRole('admin_kecamatan');

    $this->asset = Asset::create([
        'kode_barang' => '02.06.01.02.001',
        'nomor_register' => 99,
        'nama_aset' => 'Komputer Server',
        'category_id' => $this->category->id,
        'unit_id' => $this->unit->id,
        'kondisi' => 'baik',
        'status' => 'aktif',
        'tanggal_perolehan' => '2026-01-15',
        'nilai_perolehan' => 20000000,
        'nilai_buku' => 20000000,
    ]);
});

it('finds and displays asset summary by its qr_token', function () {
    $this->actingAs($this->user)
        ->get(route('scan.show', ['token' => $this->asset->qr_token]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Scan/Index')
            ->where('notFound', false)
            ->where('summary.nama_aset', 'Komputer Server')
            ->where('summary.nomor_register', '0099')
        );
});

it('returns 404 when token is not found or asset has been deleted', function () {
    $token = $this->asset->qr_token;
    $this->asset->delete();

    $this->actingAs($this->user)
        ->get(route('scan.show', ['token' => $token]))
        ->assertNotFound()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Scan/Index')
            ->where('notFound', true)
            ->where('summary', null)
        );
});

it('rejects old numeric id URLs via route pattern', function () {
    $this->actingAs($this->user)
        ->get('/scan/' . $this->asset->id)
        ->assertNotFound();
});
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `php artisan test --filter=ScanTokenLookupTest`  
Expected: FAIL.

- [ ] **Step 3: Update `routes/web.php` dan `ScanController.php`**

Di `routes/web.php`:
Ubah baris:
```php
Route::get('/scan/{token}', [ScanController::class, 'show'])->where('token', '[A-Za-z0-9]{16}')->name('scan.show');
```

Di `app/Http/Controllers/ScanController.php`:
Ubah signature method `show`:
```php
    public function show(Request $request, string $token): InertiaResponse|SymfonyResponse
    {
        $asset = Asset::with(['category', 'unit', 'currentHolder', 'photos'])
            ->where('qr_token', $token)
            ->first();

        if ($asset === null) {
            return Inertia::render('Scan/Index', ['summary' => null, 'canViewDetail' => false, 'notFound' => true])
                ->toResponse($request)
                ->setStatusCode(404);
        }

        return Inertia::render('Scan/Index', [
            'summary' => $this->summary->for($asset),
            'canViewDetail' => $request->user()->can('view', $asset),
            'notFound' => false,
        ]);
    }
```

- [ ] **Step 4: Jalankan test dan pastikan lulus**

Run: `php artisan test --filter=ScanTokenLookupTest`  
Expected: PASS (3 tests, assertions pass).

- [ ] **Step 5: Commit perubahan Task 3**

```bash
git add routes/web.php app/Http/Controllers/ScanController.php tests/Feature/ScanTokenLookupTest.php
git commit -m "feat(scan): update scan route and ScanController to resolve assets by qr_token"
```

---

### Task 4: Pembaruan Frontend Parser & Komponen Scan (`qr.ts` & `Scan/Index.tsx`)

**Files:**
- Modify: `resources/js/lib/qr.ts`
- Modify: `resources/js/Pages/Scan/Index.tsx`

**Interfaces:**
- Consumes: Teks hasil pembacaan kamera QR.
- Produces: String token 16 karakter atau `null` jika tidak sesuai pola.

- [ ] **Step 1: Update `resources/js/lib/qr.ts`**

Ganti `assetIdFromQr` dengan `qrTokenFromScan`:
```typescript
// ponytail: matches SIBIMA token scan URLs or raw 16-char tokens. Legacy numeric ID URLs return null.
export function qrTokenFromScan(text: string): string | null {
    let path: string;
    try {
        path = new URL(text.trim()).pathname;
    } catch {
        const raw = text.trim();
        return /^[A-Za-z0-9]{16}$/.test(raw) ? raw : null;
    }

    const match = path.match(/^\/scan\/([A-Za-z0-9]{16})\/?$/);
    return match ? match[1] : null;
}
```

- [ ] **Step 2: Update `resources/js/Pages/Scan/Index.tsx`**

Perbarui import dan pemanggilan di `handleDetect`:
```typescript
import { qrTokenFromScan } from '@/lib/qr';
...
    const handleDetect = (text: string) => {
        const token = qrTokenFromScan(text);

        if (token === null) {
            setInvalid(true);
            return;
        }

        setInvalid(false);
        setScanning(false);
        router.get(route('scan.show', { token }));
    };
```

- [ ] **Step 3: Jalankan verifikasi TypeScript**

Run: `npx tsc --noEmit`  
Expected: PASS (0 errors).

- [ ] **Step 4: Commit perubahan Task 4**

```bash
git add resources/js/lib/qr.ts resources/js/Pages/Scan/Index.tsx
git commit -m "feat(scan): update frontend QR parser and Scan page to detect 16-character qr_token"
```

---

### Task 5: Pembaruan Test Regresi Eksisting, Migrasi Lokal, & Build Akhir

**Files:**
- Modify: `tests/Feature/ScanControllerTest.php` (update test assertions to use `qr_token` instead of `$asset->id`)
- Modify: `tests/Feature/AssetScanSummaryTest.php` (jika ada)

- [ ] **Step 1: Perbarui test eksisting di `ScanControllerTest.php`**

Ganti pemanggilan rute dari `route('scan.show', $asset->id)` menjadi `route('scan.show', ['token' => $asset->qr_token])`.

- [ ] **Step 2: Jalankan seluruh test suite Pest**

Run: `php artisan test`  
Expected: Seluruh 550+ test PASS (100% green, 0 failures).

- [ ] **Step 3: Jalankan typecheck frontend & build produksi**

Run: `npx tsc --noEmit && npm run build`  
Expected: PASS, assets built cleanly.

- [ ] **Step 4: Jalankan migrasi di database lokal**

Run: `php artisan migrate`  
Expected: Migrasi `2026_10_10_000001_add_qr_token_to_assets_table` sukses dan mengisi seluruh aset eksisting dengan token baru.

- [ ] **Step 5: Commit akhir**

```bash
git add tests/Feature/ScanControllerTest.php
git commit -m "test(scan): update existing scan feature tests to use qr_token route parameter"
```
