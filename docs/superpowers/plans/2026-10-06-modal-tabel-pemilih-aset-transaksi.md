# Komponen Modal Tabel Pemilih Aset untuk Transaksi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menggantikan pemilihan aset berbasis dropdown `<select>` dan list sempit dengan komponen modal dialog berbasis tabel data aset interaktif (`<AssetSelectModal>`) yang ramah pegawai senior pada menu Mutasi Aset, Pemenuhan Permohonan Aset, dan Laporan Kerusakan/Kehilangan.

**Architecture:** Membuat satu komponen reusable `AssetSelectModal.tsx` dengan antarmuka pencarian instan, paginasi lokal, baris yang dapat diklik (*clickable rows*), serta dukungan mode single dan multi-select. Di sisi backend, menyertakan kolom `nomor_register` pada payload controller yang relevan. Di sisi form transaksi, mengadaptasi tampilan aset terpilih menjadi **Tabel Ringkasan Barang Terpilih** yang ringkas dan rapi.

**Tech Stack:** Laravel 11, Inertia.js v2, React 18, TypeScript, Tailwind CSS, Pest PHP.

**Spec:** `docs/superpowers/specs/2026-10-06-modal-tabel-pemilih-aset-transaksi-design.md`

## Global Constraints

- Komponen modal harus mandiri (*self-contained*), tidak menambahkan dependency NPM pihak ketiga baru.
- Area klik harus lapang: seluruh area baris tabel dapat diklik untuk memilih (*clickable row*), tidak memaksa pengguna mengeklik kotak checkbox/radio kecil.
- Header dan footer modal harus bersifat *sticky* sehingga status aset terpilih dan tombol aksi konfirmasi selalu terlihat tanpa perlu scroll ke dasar modal.
- Integrasi di form transaksi harus menampilkan **Tabel Ringkasan Barang Terpilih** yang informatif (Kode Barang, No. Register, Nama Barang, Merk/Tipe, Kondisi, Pemegang).
- Seluruh commit git tidak boleh memuat atribusi AI (no Co-Authored-By / Claude / Gemini trailers).

---

### Task 1: Backend Controller Props Enrichment (`nomor_register`) & Tests

**Files:**
- Modify: `app/Http/Controllers/AssetReportController.php:65-85`
- Modify: `app/Http/Controllers/AssetRequestController.php:118-128`
- Test: `tests/Feature/AssetReportControllerTest.php`
- Test: `tests/Feature/AssetRequestControllerTest.php`

**Interfaces:**
- Produces:
  - `assets[].nomor_register` pada Inertia props `AssetReports/Create`
  - `eligibleAssets[].nomor_register` pada Inertia props `AssetRequests/Show`

- [ ] **Step 1: Write failing test in `tests/Feature/AssetReportControllerTest.php`**

Tambahkan pengujian untuk memastikan properti `nomor_register` diteruskan ke view `AssetReports/Create`:

```php
it('passes nomor_register in assets prop to create view', function () {
    $asset = Asset::factory()->create([
        'unit_id' => $this->kec->id,
        'nomor_register' => 42,
        'status' => AssetStatus::Aktif,
        'kondisi' => Kondisi::Baik,
    ]);

    $this->actingAs($this->admin)
        ->get(route('asset-reports.create'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('AssetReports/Create')
            ->where('assets', fn ($assets) => collect($assets)->contains(fn ($a) => $a['id'] === $asset->id && $a['nomor_register'] === 42))
        );
});
```

- [ ] **Step 2: Write failing test in `tests/Feature/AssetRequestControllerTest.php`**

Tambahkan pengujian untuk memastikan properti `nomor_register` diteruskan pada `eligibleAssets` di `AssetRequests/Show`:

```php
it('passes nomor_register in eligibleAssets prop to show view when can fulfill', function () {
    $asset = Asset::factory()->create([
        'unit_id' => $this->kec->id,
        'category_id' => $this->category->id,
        'nomor_register' => 17,
        'status' => AssetStatus::Aktif,
        'kondisi' => Kondisi::Baik,
    ]);

    $request = AssetRequest::factory()->create([
        'unit_id' => $this->kec->id,
        'category_id' => $this->category->id,
        'status' => AssetRequestStatus::Approved,
        'jenis' => AssetRequestType::Pegawai,
        'jumlah' => 1,
    ]);

    $this->actingAs($this->admin)
        ->get(route('asset-requests.show', $request))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('AssetRequests/Show')
            ->where('eligibleAssets', fn ($assets) => collect($assets)->contains(fn ($a) => $a['id'] === $asset->id && $a['nomor_register'] === 17))
        );
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `php artisan test --filter=AssetReportControllerTest`
Run: `php artisan test --filter=AssetRequestControllerTest`
Expected: FAIL (assertion fails karena `nomor_register` belum disertakan di array pemetaan).

- [ ] **Step 4: Update `AssetReportController.php` and `AssetRequestController.php`**

Di `app/Http/Controllers/AssetReportController.php` (baris 72-80):
```php
            ->map(fn (Asset $a) => [
                'id' => $a->id,
                'kode_barang' => $a->kode_barang,
                'nomor_register' => $a->nomor_register,
                'nama_aset' => $a->nama_aset,
                'merk_type' => $a->merk_type,
                'kondisi' => $a->kondisi->value,
                'holder' => $a->currentHolder?->nama,
            ])->values();
```

Di `app/Http/Controllers/AssetRequestController.php` (baris 120-126):
```php
            'eligibleAssets' => $canFulfill
                ? $this->requests->eligibleAssets($assetRequest)->map(fn ($a) => [
                    'id' => $a->id,
                    'kode_barang' => $a->kode_barang,
                    'nomor_register' => $a->nomor_register,
                    'nama_aset' => $a->nama_aset,
                    'merk_type' => $a->merk_type,
                    'kondisi' => $a->kondisi->value,
                ])->values()
                : [],
```

- [x] **Step 5: Run tests to verify they pass**

Run: `php artisan test --filter=AssetReportControllerTest`
Run: `php artisan test --filter=AssetRequestControllerTest`
Expected: PASS (seluruh test hijau).

- [x] **Step 6: Commit Task 1**

```bash
git add app/Http/Controllers/AssetReportController.php app/Http/Controllers/AssetRequestController.php tests/Feature/AssetReportControllerTest.php tests/Feature/AssetRequestControllerTest.php
git commit -m "feat(controllers): include nomor_register in transaction asset payload"
```

---

### Task 2: Build Reusable Senior-Friendly Component `<AssetSelectModal>`

**Files:**
- Create: `resources/js/Components/AssetSelectModal.tsx`

**Interfaces:**
- Produces:
  ```typescript
  export interface SelectableAsset {
      id: number;
      kode_barang: string;
      nomor_register: number | string;
      nama_aset: string;
      merk_type?: string | null;
      kondisi: string;
      holder?: string | null;
      unit_id?: number;
      unit_name?: string | null;
  }

  export interface AssetSelectModalProps {
      isOpen: boolean;
      onClose: () => void;
      assets: SelectableAsset[];
      selectedIds: number[];
      onConfirm: (selected: SelectableAsset[]) => void;
      mode?: 'single' | 'multiple';
      maxSelection?: number;
      title?: string;
      description?: string;
      disabledIds?: number[];
  }
  ```

- [x] **Step 1: Create `resources/js/Components/AssetSelectModal.tsx`**

Implementasi lengkap mencakup:
1. Keyboard accessibility: Menutup saat tombol `Escape` ditekan.
2. State internal untuk temporary selection (`tempSelectedIds`), search query, dan pagination page (`currentPage`).
3. Search matching multi-field: `nama_aset`, `kode_barang`, `nomor_register`, `merk_type`, `holder`.
4. Paginasi lokal: 10 item per halaman dengan tombol "Sebelumnya" dan "Berikutnya".
5. Clickable row toggle: Mengklik baris langsung mencentang/memilih item (jika tidak disabled).
6. Baris terpilih memiliki highlight visual `bg-blue-50/70 border-blue-200`.
7. Badge kondisi kontras tinggi dengan warna yang jelas.
8. Sticky header (Search + Judul) dan Sticky footer (Counter terpilih + Tombol Batal & Simpan).

```tsx
import { SearchIcon as Search, XIcon as X } from '@/Components/Icons';
import { useEffect, useMemo, useState } from 'react';

export interface SelectableAsset {
    id: number;
    kode_barang: string;
    nomor_register: number | string;
    nama_aset: string;
    merk_type?: string | null;
    kondisi: string;
    holder?: string | null;
    unit_id?: number;
    unit_name?: string | null;
}

export interface AssetSelectModalProps {
    isOpen: boolean;
    onClose: () => void;
    assets: SelectableAsset[];
    selectedIds: number[];
    onConfirm: (selected: SelectableAsset[]) => void;
    mode?: 'single' | 'multiple';
    maxSelection?: number;
    title?: string;
    description?: string;
    disabledIds?: number[];
}

const ITEMS_PER_PAGE = 10;

const KONDISI_BADGE: Record<string, { label: string; class: string }> = {
    baik: { label: 'Baik', class: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    rusak_ringan: { label: 'Rusak Ringan', class: 'bg-amber-100 text-amber-800 border-amber-200' },
    rusak_berat: { label: 'Rusak Berat', class: 'bg-red-100 text-red-800 border-red-200' },
    hilang: { label: 'Hilang', class: 'bg-slate-100 text-slate-800 border-slate-200' },
};

export default function AssetSelectModal({
    isOpen,
    onClose,
    assets,
    selectedIds,
    onConfirm,
    mode = 'multiple',
    maxSelection,
    title = 'Pilih Aset',
    description = 'Pilih aset dari tabel di bawah ini, lalu klik tombol Simpan Pilihan.',
    disabledIds = [],
}: AssetSelectModalProps) {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [tempSelected, setTempSelected] = useState<number[]>(selectedIds);

    useEffect(() => {
        if (isOpen) {
            setTempSelected(selectedIds);
            setSearch('');
            setPage(1);
        }
    }, [isOpen, selectedIds]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return assets;
        return assets.filter((a) =>
            a.nama_aset?.toLowerCase().includes(q) ||
            a.kode_barang?.toLowerCase().includes(q) ||
            String(a.nomor_register).includes(q) ||
            a.merk_type?.toLowerCase().includes(q) ||
            a.holder?.toLowerCase().includes(q)
        );
    }, [assets, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const paginated = useMemo(() => {
        const start = (page - 1) * ITEMS_PER_PAGE;
        return filtered.slice(start, start + ITEMS_PER_PAGE);
    }, [filtered, page]);

    const toggleAsset = (id: number) => {
        if (disabledIds.includes(id)) return;

        if (mode === 'single') {
            setTempSelected([id]);
            return;
        }

        if (tempSelected.includes(id)) {
            setTempSelected(tempSelected.filter((i) => i !== id));
        } else {
            if (maxSelection && tempSelected.length >= maxSelection) {
                return;
            }
            setTempSelected([...tempSelected, id]);
        }
    };

    const handleConfirm = () => {
        const selectedObjects = assets.filter((a) => tempSelected.includes(a.id));
        onConfirm(selectedObjects);
        onClose();
    };

    if (!isOpen) return null;

    const isExceeding = maxSelection !== undefined && tempSelected.length > maxSelection;
    const isUnderQuota = maxSelection !== undefined && tempSelected.length !== maxSelection;
    const isConfirmDisabled = tempSelected.length === 0 || (maxSelection !== undefined && isUnderQuota);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={onClose} />

            <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4.5">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
                        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-3">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                            placeholder="Cari berdasarkan nama aset, kode barang, no. register, merk..."
                            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            autoFocus
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600"
                            >
                                Bersihkan
                            </button>
                        )}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                        <span>Menampilkan {filtered.length} aset yang sesuai</span>
                        {mode === 'multiple' && maxSelection && (
                            <span className="font-semibold text-blue-700">Batas pilihan: tepat {maxSelection} aset</span>
                        )}
                    </div>
                </div>

                {/* Table Body */}
                <div className="flex-1 overflow-y-auto px-6 py-2">
                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <p className="text-sm font-semibold text-slate-700">Tidak ada aset ditemukan</p>
                            <p className="mt-1 text-xs text-slate-400">Coba ubah kata kunci pencarian Anda</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                        <th className="py-3 px-3 w-12 text-center">Pilih</th>
                                        <th className="py-3 px-3">Kode & Register</th>
                                        <th className="py-3 px-3">Nama Barang & Merk</th>
                                        <th className="py-3 px-3">Kondisi</th>
                                        <th className="py-3 px-3">Pemegang Saat Ini</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {paginated.map((asset) => {
                                        const isSelected = tempSelected.includes(asset.id);
                                        const isDisabled = disabledIds.includes(asset.id);

                                        return (
                                            <tr
                                                key={asset.id}
                                                onClick={() => !isDisabled && toggleAsset(asset.id)}
                                                className={`cursor-pointer transition select-none ${
                                                    isDisabled
                                                        ? 'opacity-40 cursor-not-allowed bg-slate-50'
                                                        : isSelected
                                                        ? 'bg-blue-50/80 font-medium'
                                                        : 'hover:bg-slate-50/80'
                                                }`}
                                            >
                                                <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type={mode === 'single' ? 'radio' : 'checkbox'}
                                                        checked={isSelected}
                                                        disabled={isDisabled}
                                                        onChange={() => toggleAsset(asset.id)}
                                                        className="h-4.5 w-4.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                </td>
                                                <td className="py-3.5 px-3 whitespace-nowrap">
                                                    <div className="font-mono text-xs text-slate-700">{asset.kode_barang}</div>
                                                    <div className="mt-0.5 inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                                                        Reg. #{String(asset.nomor_register).padStart(4, '0')}
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-3">
                                                    <div className="font-semibold text-slate-900">{asset.nama_aset}</div>
                                                    <div className="text-xs text-slate-500">{asset.merk_type || '—'}</div>
                                                </td>
                                                <td className="py-3.5 px-3 whitespace-nowrap">
                                                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${KONDISI_BADGE[asset.kondisi]?.class || 'bg-slate-100 text-slate-700'}`}>
                                                        {KONDISI_BADGE[asset.kondisi]?.label || asset.kondisi}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-3 text-xs text-slate-600 whitespace-nowrap">
                                                    {asset.holder ? (
                                                        <span className="font-medium text-slate-900">{asset.holder}</span>
                                                    ) : (
                                                        <span className="text-slate-400 italic">Inventaris Unit</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-slate-200 px-6 py-2.5 text-xs text-slate-600">
                        <span>Halaman {page} dari {totalPages}</span>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                disabled={page === 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                className="rounded-lg border border-slate-300 px-3 py-1 font-medium hover:bg-slate-50 disabled:opacity-40"
                            >
                                Sebelumnya
                            </button>
                            <button
                                type="button"
                                disabled={page === totalPages}
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                className="rounded-lg border border-slate-300 px-3 py-1 font-medium hover:bg-slate-50 disabled:opacity-40"
                            >
                                Berikutnya
                            </button>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
                    <div className="text-sm font-medium">
                        {mode === 'single' ? (
                            <span>{tempSelected.length === 1 ? '1 aset dipilih' : 'Pilih 1 aset'}</span>
                        ) : (
                            <span className={isExceeding ? 'text-red-600 font-bold' : 'text-slate-700'}>
                                {tempSelected.length} aset dipilih
                                {maxSelection && ` (harus tepat ${maxSelection})`}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            Batal
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={isConfirmDisabled}
                            className="rounded-xl bg-[#1E40AF] px-5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-800 disabled:opacity-50"
                        >
                            Gunakan {tempSelected.length > 0 ? `(${tempSelected.length}) ` : ''}Aset Terpilih
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
```

- [x] **Step 2: Verify component with TypeScript**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [x] **Step 3: Commit Task 2**

```bash
git add resources/js/Components/AssetSelectModal.tsx
git commit -m "feat(ui): create senior-friendly AssetSelectModal component"
```

---

### Task 3: Integrate `<AssetSelectModal>` into Mutasi Aset (`AssetMutations/Create.tsx`)

**Files:**
- Modify: `resources/js/Pages/AssetMutations/Create.tsx`

**Interfaces:**
- Consumes: `<AssetSelectModal>` with `mode="multiple"`
- Produces: Form item populated simultaneously via modal; Tabel Ringkasan Barang Terpilih with Pemegang Baru & Catatan per row.

- [x] **Step 1: Update `AssetMutations/Create.tsx` state and item management**

1. Tambahkan state `isModalOpen: boolean`.
2. Ubah `availableAssets` agar menyertakan pemetaan `SelectableAsset` (menambahkan `holder: a.current_holder?.nama`).
3. Ganti section "Daftar Aset yang Dimutasi":
   - Jika `form.data.items` kosong atau aset belum dipilih (`asset_id === ''`), tampilkan empty state dengan tombol **`[ + Buka Daftar & Pilih Aset ]`**.
   - Jika sudah ada aset, tampilkan **Tabel Ringkasan Barang Terpilih**:
     - Tombol atas: **`[ + Tambah / Ubah Pilihan Aset ]`**.
     - Kolom tabel: Identitas Barang (Nama, Kode, Register, Merk), Pemegang Asal, Pemegang Baru (Select Pegawai), Catatan (Input teks), Aksi (Hapus).
4. Ketika modal di-confirm (`onConfirm`):
   - Pertahankan target holder & catatan untuk aset yang sebelumnya sudah dipilih.
   - Tambahkan baris baru untuk aset yang baru dipilih.
5. Tambahkan reset konfirmasi jika `origin_unit_id` diubah ketika sudah ada barang yang dipilih.

- [x] **Step 2: Verify with TypeScript and Pest**

Run: `npx tsc --noEmit`
Run: `php artisan test --filter=AssetMutation`
Expected: PASS.

- [x] **Step 3: Commit Task 3**

```bash
git add resources/js/Pages/AssetMutations/Create.tsx
git commit -m "feat(mutasi): integrate AssetSelectModal and table summary into mutation form"
```

---

### Task 4: Integrate `<AssetSelectModal>` into Pemenuhan Permohonan & Lapor Kerusakan

**Files:**
- Modify: `resources/js/Pages/AssetRequests/Show.tsx:190-225`
- Modify: `resources/js/Pages/AssetReports/Create.tsx:20-75`

**Interfaces:**
- Consumes: `<AssetSelectModal>` with `mode="single"` and `mode="multiple"`.

- [x] **Step 1: Update `AssetRequests/Show.tsx`**

1. Import `AssetSelectModal` dan `SelectableAsset`.
2. Tambahkan state `isModalOpen: boolean`.
3. Di area `can.fulfill`:
   - Ganti kotak scroll `max-h-64` dengan tombol **`[ Buka Daftar Aset untuk Dipenuhi ]`** (menampilkan jumlah aset memenuhi syarat).
   - Ketika modal dibuka, set `mode={single ? 'single' : 'multiple'}` dan `maxSelection={single ? 1 : r.jumlah}`.
   - Setelah dipilih, tampilkan tabel ringkasan aset terpilih dengan tombol **`[ Ganti Pilihan Aset ]`**.
   - Tombol **`[ Serahkan ke Pegawai ]`** / **`[ Ajukan Mutasi Pemenuhan ]`** diaktifkan ketika kuota terpenuhi.

- [x] **Step 2: Update `AssetReports/Create.tsx`**

1. Import `AssetSelectModal` dan `SelectableAsset`.
2. Tambahkan state `isModalOpen: boolean`.
3. Ganti dropdown `<select>`:
   - Jika belum ada aset: Tampilkan kartu pemilih dengan tombol **`[ + Pilih Aset yang Dilaporkan ]`**.
   - Jika aset terpilih: Tampilkan **Panel Ringkasan Aset Terpilih** dengan detail lengkap (Nama, Kode, Register, Merk, Kondisi Saat Ini, Pemegang) dan tombol **`[ Ganti Aset ]`**.

- [x] **Step 3: Verify with TypeScript and Pest**

Run: `npx tsc --noEmit`
Run: `php artisan test --filter=AssetReport`
Run: `php artisan test --filter=AssetRequest`
Expected: PASS.

- [x] **Step 4: Commit Task 4**

```bash
git add resources/js/Pages/AssetRequests/Show.tsx resources/js/Pages/AssetReports/Create.tsx
git commit -m "feat(transaksi): integrate AssetSelectModal into asset fulfillment and damage report"
```

---

### Task 5: Full Suite Regression Verification & Asset Build

**Files:**
- Test all: `tests/`
- Build: `npm run build`

- [x] **Step 1: Run full test suite**

Run: `php artisan test`
Expected: 650+ tests passed, 0 failures.

- [x] **Step 2: Run frontend production build**

Run: `npm run build`
Expected: Vite build succeeds in < 4s with 0 errors.
