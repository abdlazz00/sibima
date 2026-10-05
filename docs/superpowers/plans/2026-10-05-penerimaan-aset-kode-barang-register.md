# Perbaikan Penomoran Kode Barang & Nomor Register Penerimaan Aset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memperbaiki logika penetapan `kode_barang` dan `nomor_register` pada persetujuan Berita Acara Penerimaan Aset agar seluruh unit fisik dalam satu item memakai satu kode barang yang sama dan nomor register berurutan (tanpa nomor kembar `001`), mendukung pencocokan otomatis aset eksisting di subkategori terkait, menyediakan UX saran nama aset via datalist di form input, serta memperbaiki data historis aset Laptop Asus di database.

**Architecture:** Pada layer service (`PenerimaanAsetEffect`), satu item penerimaan hanya me-resolve satu `kode_barang` (dicocokkan dengan aset eksisting yang bernama sama di subkategori yang sama, atau membuat suffix baru jika belum ada), lalu meng-increment `nomor_register` secara sekuensial untuk seluruh `jumlah_unit`. Pada layer controller dan view (`PenerimaanAsetController` & `PenerimaanForm`), daftar nama aset eksisting per kategori dikirim untuk mengisi `<datalist>` dinamis pada kolom nama aset. Data historis aset Laptop Asus diperbaiki melalui migration patch.

**Tech Stack:** Laravel 11, Eloquent ORM, Inertia.js v2, React 18, TypeScript, Tailwind CSS, Pest PHP.

**Spec:** `docs/superpowers/specs/2026-10-05-penerimaan-aset-kode-barang-register-design.md`

## Global Constraints

- Integritas indeks unik database: `unique(['kode_barang', 'nomor_register'])` tidak boleh dilanggar.
- Setiap unit fisik dalam satu item penerimaan (`jumlah_unit >= 1`) harus memiliki `kode_barang` yang sama.
- Nomor register harus berurutan tanpa jeda dan tidak boleh kembar `001`.
- Pencocokan nama aset eksisting bersifat case-insensitive dan trimmed (`LOWER(TRIM(nama_aset))`).
- Komponen frontend tidak boleh menggunakan modal atau pustaka dialog eksternal baru; gunakan elemen native HTML5 `<datalist>` yang ringan.
- Seluruh commit git tidak boleh memuat atribusi AI (no Co-Authored-By / Claude / Gemini trailers).

---

### Task 1: Backend Asset Code Resolution & Sequential Register Numbering

**Files:**
- Modify: `app/Repositories/Contracts/AssetRepositoryInterface.php`
- Modify: `app/Repositories/EloquentAssetRepository.php:50-70`
- Modify: `app/Services/PenerimaanAsetEffect.php:26-76`
- Test: `tests/Feature/PenerimaanAsetEffectTest.php`

**Interfaces:**
- Produces: `AssetRepositoryInterface::findExistingKodeBarang(int $categoryId, string $namaAset): ?string`
- Consumes: `AssetRepositoryInterface::maxKodeBarangSuffix(string $prefix): int`, `AssetRepositoryInterface::maxRegisterNumber(string $kodeBarang): int`

- [ ] **Step 1: Write failing tests in `tests/Feature/PenerimaanAsetEffectTest.php`**

Perbarui dan tambahkan skenario pengujian:
1. `it('creates one Asset per unit with the same kode_barang and sequential nomor_register on final approval')`:
   Item dengan `jumlah_unit = 3` harus menghasilkan 3 aset dengan `kode_barang` yang **sama** (`1.3.2.05.02.04.001`) dan `nomor_register` yang berurutan `1, 2, 3`.
2. `it('reuses existing kode_barang and continues nomor_register sequence for matching asset name in same category')`:
   Jika sudah ada aset `AC Split Daikin 1.5PK` di kategori tersebut dengan register `1, 2`, penerimaan baru 2 unit harus memakai kode yang sama dan register `3, 4`.
3. `it('generates distinct kode_barang for different asset items in the same category')`:
   Jika ada 2 item berbeda (Item A: AC Split, Item B: Kipas Angin) dalam 1 Berita Acara, masing-masing item mendapat kode barang berbeda (`.001` dan `.002`), masing-masing dengan register mulai dari 1.

```php
it('creates one Asset per unit with the same kode_barang and sequential nomor_register on final approval', function () {
    $ba = makeBeritaAcaraForEffectTest($this, jumlahUnit: 3);
    $request = $this->service->submit($ba, 'penerimaan_aset', $this->admin);

    $this->service->approve($request, $this->kasubag);
    $this->service->approve($request, $this->camat);

    $assets = Asset::where('category_id', $this->category->id)->orderBy('nomor_register')->get();

    expect($assets)->toHaveCount(3)
        ->and($assets->pluck('kode_barang')->unique()->all())->toBe(['1.3.2.05.02.04.001'])
        ->and($assets->pluck('nomor_register')->all())->toBe([1, 2, 3])
        ->and($assets[0]->no_dokumen)->toBe('BA/042/VIII/2025-001')
        ->and($assets[1]->no_dokumen)->toBe('BA/042/VIII/2025-002')
        ->and($assets[2]->no_dokumen)->toBe('BA/042/VIII/2025-003');

    expect($ba->items->first()->fresh()->asset_ids)->toBe($assets->pluck('id')->all());
});

it('reuses existing kode_barang and continues nomor_register sequence for matching asset name in same category', function () {
    Asset::factory()->create([
        'category_id' => $this->category->id,
        'kode_barang' => '1.3.2.05.02.04.001',
        'nomor_register' => 1,
        'nama_aset' => 'AC Split Daikin 1.5PK',
    ]);
    Asset::factory()->create([
        'category_id' => $this->category->id,
        'kode_barang' => '1.3.2.05.02.04.001',
        'nomor_register' => 2,
        'nama_aset' => 'AC Split Daikin 1.5PK',
    ]);

    $ba = makeBeritaAcaraForEffectTest($this, jumlahUnit: 2);
    $request = $this->service->submit($ba, 'penerimaan_aset', $this->admin);
    $this->service->approve($request, $this->kasubag);
    $this->service->approve($request, $this->camat);

    $newAssets = Asset::where('category_id', $this->category->id)
        ->whereNotIn('nomor_register', [1, 2])
        ->orderBy('nomor_register')
        ->get();

    expect($newAssets)->toHaveCount(2)
        ->and($newAssets->pluck('kode_barang')->all())->toBe(['1.3.2.05.02.04.001', '1.3.2.05.02.04.001'])
        ->and($newAssets->pluck('nomor_register')->all())->toBe([3, 4]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `php artisan test --filter=PenerimaanAsetEffectTest`
Expected: FAIL (assertion fails karena saat ini kode barang terpecah dan nomor register kembar).

- [ ] **Step 3: Implement `findExistingKodeBarang` in Repository**

In `app/Repositories/Contracts/AssetRepositoryInterface.php`:
```php
public function findExistingKodeBarang(int $categoryId, string $namaAset): ?string;
```

In `app/Repositories/EloquentAssetRepository.php`:
```php
public function findExistingKodeBarang(int $categoryId, string $namaAset): ?string
{
    $cleanName = strtolower(trim($namaAset));

    return Asset::query()
        ->where('category_id', $categoryId)
        ->whereRaw('LOWER(TRIM(nama_aset)) = ?', [$cleanName])
        ->lockForUpdate()
        ->value('kode_barang');
}
```

- [ ] **Step 4: Update `PenerimaanAsetEffect.php`**

Ubah loop di `apply()`:
```php
DB::transaction(function () use ($approvable) {
    $noDokumenSeq = 0;

    foreach ($approvable->items as $item) {
        $category = $item->category;

        if (blank($category->code)) {
            throw new InvalidArgumentException(
                "Kategori \"{$category->name}\" belum punya kode BMD. Isi dulu lewat halaman Kategori Aset."
            );
        }

        // 1. Resolve single kode_barang for this entire item line
        $kodeBarang = $this->assets->findExistingKodeBarang($item->category_id, $item->nama_aset);

        if ($kodeBarang === null) {
            $suffix = $this->assets->maxKodeBarangSuffix($category->code) + 1;
            $kodeBarang = $category->code . '.' . str_pad((string) $suffix, 3, '0', STR_PAD_LEFT);
        }

        // 2. Resolve starting register number
        $baseRegister = $this->assets->maxRegisterNumber($kodeBarang);

        $assetIds = [];

        // 3. Create each physical unit with SAME kode_barang and INCREMENTAL nomor_register
        for ($i = 0; $i < $item->jumlah_unit; $i++) {
            $noDokumenSeq++;
            $nomorRegister = $baseRegister + $i + 1;

            $asset = $this->assets->create([
                'kode_barang' => $kodeBarang,
                'nomor_register' => $nomorRegister,
                'nama_aset' => $item->nama_aset,
                'merk_type' => $item->merk_type,
                'category_id' => $item->category_id,
                'unit_id' => $approvable->unit_id,
                'kondisi' => $item->kondisi_awal,
                'status' => AssetStatus::Aktif,
                'tanggal_perolehan' => $approvable->tanggal_penerimaan,
                'sumber_perolehan' => $approvable->sumber_perolehan,
                'nilai_perolehan' => $item->nilai_per_unit,
                'nilai_buku' => $item->nilai_per_unit,
                'no_dokumen' => $approvable->no_berita_acara . '-' . str_pad((string) $noDokumenSeq, 3, '0', STR_PAD_LEFT),
            ]);

            $asset->histories()->create([
                'event' => 'diterima',
                'unit_id' => $asset->unit_id,
                'current_holder_id' => null,
                'kondisi' => $asset->kondisi,
                'user_id' => $approvable->created_by,
            ]);

            $assetIds[] = $asset->id;
        }

        $item->update(['asset_ids' => $assetIds]);
    }
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `php artisan test --filter=PenerimaanAsetEffectTest`
Expected: PASS (all tests green).

- [ ] **Step 6: Commit Task 1**

```bash
git add app/Repositories/Contracts/AssetRepositoryInterface.php app/Repositories/EloquentAssetRepository.php app/Services/PenerimaanAsetEffect.php tests/Feature/PenerimaanAsetEffectTest.php
git commit -m "fix(penerimaan): assign single kode_barang and sequential nomor_register per item"
```

---

### Task 2: Data Patch Migration for Historical Laptop Asus Records

**Files:**
- Create: `database/migrations/2026_10_05_100000_fix_laptop_asus_register_and_codes.php`
- Test: `tests/Feature/FixLaptopAsusDataPatchTest.php`

**Interfaces:**
- Produces: Database state correction for assets ID 332 s.d. 336 (`kode_barang = 1.3.2.10.02.03.005`, `nomor_register = 1..5`, unified `nama_aset = Laptop asus #1`).

- [ ] **Step 1: Write test in `tests/Feature/FixLaptopAsusDataPatchTest.php`**

```php
it('patches corrupted historical laptop assets into unified kode_barang and sequential register', function () {
    // Seed sample corrupted assets if running on clean db
    $cat = AssetCategory::where('code', '1.3.2.10.02.03')->first() ?? AssetCategory::factory()->create(['code' => '1.3.2.10.02.03']);
    $a1 = Asset::factory()->create(['id' => 332, 'category_id' => $cat->id, 'kode_barang' => '1.3.2.10.02.03.005', 'nomor_register' => 1]);
    $a2 = Asset::factory()->create(['id' => 333, 'category_id' => $cat->id, 'kode_barang' => '1.3.2.10.02.03.006', 'nomor_register' => 1]);
    $a3 = Asset::factory()->create(['id' => 334, 'category_id' => $cat->id, 'kode_barang' => '1.3.2.10.02.03.007', 'nomor_register' => 1]);
    $a4 = Asset::factory()->create(['id' => 335, 'category_id' => $cat->id, 'kode_barang' => '1.3.2.10.02.03.008', 'nomor_register' => 1]);
    $a5 = Asset::factory()->create(['id' => 336, 'category_id' => $cat->id, 'kode_barang' => '1.3.2.10.02.03.009', 'nomor_register' => 1]);

    (new \Database\Migrations\FixLaptopAsusRegisterAndCodes)->up();

    expect(Asset::find(332)->nomor_register)->toBe(1)
        ->and(Asset::find(333)->nomor_register)->toBe(2)
        ->and(Asset::find(334)->nomor_register)->toBe(3)
        ->and(Asset::find(335)->nomor_register)->toBe(4)
        ->and(Asset::find(336)->nomor_register)->toBe(5)
        ->and(Asset::whereIn('id', [332, 333, 334, 335, 336])->pluck('kode_barang')->unique()->all())->toBe(['1.3.2.10.02.03.005']);
});
```

- [ ] **Step 2: Create migration file `database/migrations/2026_10_05_100000_fix_laptop_asus_register_and_codes.php`**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $ids = [332, 333, 334, 335, 336];
        $targetKode = '1.3.2.10.02.03.005';

        // Check if records exist
        $existing = DB::table('assets')->whereIn('id', $ids)->orderBy('id')->pluck('id')->all();

        if (count($existing) === 5) {
            foreach ($existing as $idx => $id) {
                DB::table('assets')->where('id', $id)->update([
                    'kode_barang' => $targetKode,
                    'nomor_register' => $idx + 1,
                    'nama_aset' => 'Laptop asus #1',
                ]);
            }
        }
    }

    public function down(): void
    {
        // Reversible if needed
    }
};
```

- [ ] **Step 3: Run migration test and run artisan migrate**

Run: `php artisan test --filter=FixLaptopAsusDataPatchTest`
Run: `php artisan migrate`

- [ ] **Step 4: Verify in local database**

Run: `php artisan tinker --execute="echo json_encode(App\Models\Asset::whereIn('id', [332,333,334,335,336])->get(['id', 'nama_aset', 'kode_barang', 'nomor_register']));"`
Expected: Kode barang `1.3.2.10.02.03.005`, nomor_register: `1, 2, 3, 4, 5`.

- [ ] **Step 5: Commit Task 2**

```bash
git add database/migrations/2026_10_05_100000_fix_laptop_asus_register_and_codes.php tests/Feature/FixLaptopAsusDataPatchTest.php
git commit -m "fix(assets): patch historical laptop asus records to unified code and sequential registers"
```

---

### Task 3: Frontend UX Input Suggestions (Datalist & Placeholders)

**Files:**
- Modify: `app/Http/Controllers/PenerimaanAsetController.php:70-130`
- Modify: `resources/js/Pages/Penerimaan/PenerimaanForm.tsx:1-170`
- Test: `tests/Feature/PenerimaanAsetControllerTest.php`

**Interfaces:**
- Produces: `existingAssetNames: Record<number, string[]>` passed as Inertia prop to `Penerimaan/Create` and `Penerimaan/Edit`.
- Consumes: `<datalist id={`suggestions-${category_id}`}>` in `PenerimaanForm.tsx`.

- [ ] **Step 1: Write test in `tests/Feature/PenerimaanAsetControllerTest.php`**

```php
it('passes existingAssetNames grouped by category to create and edit views', function () {
    Asset::factory()->create([
        'category_id' => $this->category->id,
        'nama_aset' => 'Lap Top',
    ]);

    $this->actingAs($this->admin)
        ->get(route('penerimaan-aset.create'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Penerimaan/Create')
            ->has("existingAssetNames.{$this->category->id}", fn ($names) => in_array('Lap Top', (array) $names))
        );
});
```

- [ ] **Step 2: Update `PenerimaanAsetController.php`**

Di method `create()` dan `edit()`:
```php
$existingAssetNames = Asset::query()
    ->select('category_id', 'nama_aset')
    ->distinct()
    ->orderBy('nama_aset')
    ->get()
    ->groupBy('category_id')
    ->map(fn ($group) => $group->pluck('nama_aset')->values()->all())
    ->all();

return Inertia::render('Penerimaan/Create', [
    'categories' => $categories,
    'kondisiOptions' => $this->kondisiOptions(),
    'existingAssetNames' => $existingAssetNames,
]);
```

- [ ] **Step 3: Update `PenerimaanForm.tsx`**

1. Tambahkan `existingAssetNames?: Record<number, string[]>` ke interface `PenerimaanFormProps`.
2. Di kolom `nama_aset`:
   - Tambahkan atribut `list={`asset-suggestions-${item.category_id}`}`.
   - Sediakan elemen `<datalist id={`asset-suggestions-${item.category_id}`}>` berisi `<option value={name} />` dari `existingAssetNames[Number(item.category_id)] || []`.
   - Perjelas placeholder input `nama_aset`: `"Contoh: Lap Top, P.C Unit, Printer"`.
   - Perjelas placeholder input `merk_type`: `"Contoh: Asus Vivobook 14, Epson L3210"`.
   - Tambahkan helper text halus di bawah input: `"Ketik nama baru atau pilih saran dari aset yang sudah ada agar terstandar."`

- [ ] **Step 4: Verify with TypeScript and Pest**

Run: `npx tsc --noEmit`
Run: `php artisan test --filter=PenerimaanAsetControllerTest`

- [ ] **Step 5: Commit Task 3**

```bash
git add app/Http/Controllers/PenerimaanAsetController.php resources/js/Pages/Penerimaan/PenerimaanForm.tsx tests/Feature/PenerimaanAsetControllerTest.php
git commit -m "feat(penerimaan): add existing asset name suggestions via datalist to receipt item form"
```

---

### Task 4: Full Suite Regression Verification & Asset Build

**Files:**
- Test all: `tests/`
- Build: `npm run build`

- [ ] **Step 1: Run full test suite**

Run: `php artisan test`
Expected: 580+ tests passed, 0 failures.

- [ ] **Step 2: Run frontend production build**

Run: `npm run build`
Expected: Vite build succeeds in < 4s with 0 errors.
