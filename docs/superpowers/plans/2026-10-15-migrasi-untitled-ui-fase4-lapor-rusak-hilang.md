# Migrasi Untitled UI, Fase 4: Lapor Rusak/Hilang Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memigrasikan modul Lapor Rusak/Hilang (`AssetReports/Index`, `Create`, `Show`) ke komponen Untitled UI tanpa mengubah logika, props Inertia, atau backend, dengan memakai komponen bersama yang sudah ada (`ApprovalStepper`, `ApprovalTimeline`, `RejectRequestModal`, `AssetSelectModal`).

**Architecture:** Hanya frontend. `Index` mengikuti pola Permohonan. `Create` adalah formulir satu kartu (pilih aset lewat dialog, jenis, kondisi baru, tanggal, kronologi, foto). `Show` memakai komponen alur persetujuan bersama dan lightbox foto berbasis `ModalOverlay`.

**Tech Stack:** React 19, Inertia 2, Tailwind 4, Untitled UI (React Aria Components), `@untitledui/icons`.

**Spec:** `docs/superpowers/specs/2026-10-14-migrasi-untitled-ui-design.md` §3.5 butir 3. Pola acuan: plan Permohonan dan Mutasi.

## Global Constraints

- Hanya komponen Untitled UI gratis. Logika tidak berubah: filter server (`go`), `transform` di Create (`kondisi_baru` dikosongkan bila jenis `hilang`), `forceFormData`, `photos` (File[]), `photoError`, `stepState`, `can.*`, props Inertia, nama berkas. `ListFilters.tsx` dan `lib/pagination.ts` tidak diubah.
- Warna tombol: Buat/Ajukan/Setujui/Pilih aset `primary`; Lihat `secondary-brand`; "Ganti Aset" `secondary-brand`; Batalkan/Alihkan/Batal `secondary`; Tolak `secondary-destructive`. Badge `type="color" size="sm" className="rounded-sm"`.
- `Input` Untitled tidak meneruskan atribut `max`; batas "tidak boleh di masa depan" sudah divalidasi server (`before_or_equal:today`, pesan berbahasa Indonesia) dan tampil sebagai galat field. Kunci kosong tidak valid pada `Select`: belum dipilih memakai `selectedKey={… || null}`; filter memakai kunci `__all`.
- `REPORT_STATUS_STYLE` hanya dipakai Index dan Show Lapor; diganti `REPORT_STATUS_COLOR` (peta gaya dihapus di task terakhir agar tiap commit tetap dapat dibangun).
- Impor `@/Components/...` berhuruf besar; tanpa `@/Components/Icons`; tanpa dependensi baru.
- Verifikasi: `npx tsc --noEmit`, `npm run build`, test backend `--filter='AssetReport|LaporRusak|Approval'`. Cek runtime singkat diperbolehkan (tanpa menyimpan data permanen); penilaian visual oleh pengguna di gerbang.
- Git: commit per task di `main`, tanpa trailer Co-Authored-By, stage dengan path eksplisit, tanpa push.

## Review Focus

1. **Pemilihan aset**: tiga keadaan (tak ada aset, belum memilih, sudah memilih), tombol kirim nonaktif sampai aset dipilih, dialog `AssetSelectModal` mode `single`. Pagar: Task 2.
2. **Jenis Hilang**: kolom Kondisi Baru disembunyikan dan dikirim kosong; foto menjadi opsional, untuk Rusak minimal 1 (tanda wajib mengikuti jenis). Pagar: Task 2.
3. **Unggah foto**: beberapa berkas, daftar nama, galat `photos.*` dari server tampil. Pagar: Task 2.
4. **Tindakan sesuai izin**: kondisi `can.cancel/reassign/act` dipertahankan persis. Pagar: Task 3.
5. **Stepper/linimasa bersama**: label langkah tanpa awalan "Step N:", nama approver di langkah selesai, waktu proses di linimasa (sama dengan Mutasi/Permohonan). Pagar: butir gerbang.
6. **Lightbox foto** dapat dibuka dengan keyboard dan ditutup dengan Esc. Pagar: foto adalah `button`, lightbox berbasis `ModalOverlay` (Task 3).

---

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `resources/js/lib/assetReport.ts` | Tambah `REPORT_STATUS_COLOR`; hapus `REPORT_STATUS_STYLE` di akhir |
| `resources/js/Pages/AssetReports/Index.tsx` | Daftar |
| `resources/js/Pages/AssetReports/Create.tsx` | Formulir |
| `resources/js/Pages/AssetReports/Show.tsx` | Detail dan tindakan persetujuan |

---

### Task 1: Warna status dan `Index`

**Files:**
- Modify: `resources/js/lib/assetReport.ts`, `resources/js/Pages/AssetReports/Index.tsx` (ganti seluruh isi)

- [ ] **Step 1: Tambah peta warna status**

Di `lib/assetReport.ts`, setelah `REPORT_STATUS_LABEL`, tambahkan (biarkan `REPORT_STATUS_STYLE` sampai Task 3):
```ts
export const REPORT_STATUS_COLOR: Record<AssetReportStatus, 'warning' | 'success' | 'error' | 'gray'> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'error',
    cancelled: 'gray',
};
```

- [ ] **Step 2: Tulis ulang `Index.tsx`**

```tsx
import PageHeader from '@/Components/PageHeader';
import { PaginationPageDefault } from '@/Components/ui/application/pagination/pagination';
import { Table } from '@/Components/ui/application/table/table';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import { Select } from '@/Components/ui/base/select/select';
import { Tooltip } from '@/Components/ui/base/tooltip/tooltip';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_BADGE_COLOR, KONDISI_LABEL, REPORT_STATUS_COLOR, REPORT_STATUS_LABEL, REPORT_TYPE_LABEL } from '@/lib/assetReport';
import { AssetReport, AssetReportStatus, AssetReportType, PageProps, Paginated } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Eye, Plus, SearchLg, XClose } from '@untitledui/icons';
import { FormEvent, useState } from 'react';

interface IndexProps extends PageProps {
    items: Paginated<AssetReport>;
    filters: { search?: string; status?: string; jenis?: string; urut?: string };
    sortOptions: { value: string; label: string }[];
    can: { create: boolean };
}

const ALL = '__all';

const STATUS_ITEMS = [
    { id: ALL, label: 'Semua status' },
    ...(Object.keys(REPORT_STATUS_LABEL) as AssetReportStatus[]).map((key) => ({ id: key, label: REPORT_STATUS_LABEL[key] })),
];

const JENIS_ITEMS = [
    { id: ALL, label: 'Semua jenis' },
    ...(Object.keys(REPORT_TYPE_LABEL) as AssetReportType[]).map((key) => ({ id: key, label: REPORT_TYPE_LABEL[key] })),
];

export default function Index({ items, filters, sortOptions, can }: IndexProps) {
    const [search, setSearch] = useState(filters.search ?? '');
    const hasFilter = Boolean(filters.status || filters.jenis);

    const go = (changes: Record<string, string | number | undefined>) => {
        const params = { ...filters, search: search || undefined, ...changes };
        const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
        router.get(route('asset-reports.index'), clean, { preserveState: true, preserveScroll: true, replace: true });
    };

    const submitSearch = (e: FormEvent) => {
        e.preventDefault();
        go({ page: undefined });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Lapor Rusak/Hilang" />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Lapor Rusak/Hilang' }]}
                    title="Lapor Rusak/Hilang"
                    actions={
                        can.create && (
                            <Button color="primary" size="md" iconLeading={Plus} href={route('asset-reports.create')}>
                                Buat Laporan
                            </Button>
                        )
                    }
                />

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <Select
                            label="Status"
                            size="md"
                            items={STATUS_ITEMS}
                            selectedKey={filters.status ?? ALL}
                            onSelectionChange={(key) => go({ status: key === ALL ? undefined : String(key), page: undefined })}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                        <Select
                            label="Jenis"
                            size="md"
                            items={JENIS_ITEMS}
                            selectedKey={filters.jenis ?? ALL}
                            onSelectionChange={(key) => go({ jenis: key === ALL ? undefined : String(key), page: undefined })}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                        <Select
                            label="Urutkan"
                            size="md"
                            items={sortOptions.map((o) => ({ id: o.value, label: o.label }))}
                            selectedKey={filters.urut ?? 'terbaru'}
                            onSelectionChange={(key) => go({ urut: key === 'terbaru' ? undefined : String(key), page: undefined })}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                    </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    <form onSubmit={submitSearch} className="flex max-w-lg items-center gap-2 border-b border-slate-200 p-4">
                        <div className="flex-1">
                            <Input
                                aria-label="Cari"
                                size="md"
                                icon={SearchLg}
                                placeholder="Cari nomor laporan atau nama aset..."
                                value={search}
                                onChange={setSearch}
                            />
                        </div>
                        {search && (
                            <Button
                                color="tertiary"
                                size="md"
                                iconLeading={XClose}
                                aria-label="Hapus pencarian"
                                onPress={() => {
                                    setSearch('');
                                    go({ search: undefined, page: undefined });
                                }}
                            />
                        )}
                        <Button type="submit" color="secondary" size="md">
                            Cari
                        </Button>
                    </form>

                    <Table aria-label="Daftar laporan rusak atau hilang" size="sm">
                        <Table.Header>
                            <Table.Head id="nomor" label="No. Laporan" isRowHeader />
                            <Table.Head id="aset" label="Aset" />
                            <Table.Head id="jenis" label="Jenis" />
                            <Table.Head id="kondisi" label="Kondisi Baru" />
                            <Table.Head id="unit" label="Unit" />
                            <Table.Head id="tanggal" label="Tanggal" />
                            <Table.Head id="status" label="Status" />
                            <Table.Head id="aksi" label="Aksi" />
                        </Table.Header>
                        <Table.Body
                            items={items.data}
                            renderEmptyState={() => (
                                <p className="py-14 text-center text-sm text-slate-400">
                                    {hasFilter || filters.search ? 'Tidak ada laporan yang cocok dengan filter.' : 'Belum ada laporan.'}
                                </p>
                            )}
                        >
                            {(r) => (
                                <Table.Row id={r.id}>
                                    <Table.Cell className="whitespace-nowrap font-medium text-slate-800">{r.nomor_laporan}</Table.Cell>
                                    <Table.Cell className="font-semibold text-slate-900">{r.asset?.nama_aset}</Table.Cell>
                                    <Table.Cell className="text-slate-800">{REPORT_TYPE_LABEL[r.jenis]}</Table.Cell>
                                    <Table.Cell>
                                        <Badge type="color" size="sm" color={KONDISI_BADGE_COLOR[r.kondisi_baru] ?? 'gray'} className="rounded-sm">
                                            {KONDISI_LABEL[r.kondisi_baru]}
                                        </Badge>
                                    </Table.Cell>
                                    <Table.Cell className="text-slate-800">{r.unit?.name}</Table.Cell>
                                    <Table.Cell className="whitespace-nowrap text-slate-800">{new Date(r.tanggal_kejadian).toLocaleDateString('id-ID')}</Table.Cell>
                                    <Table.Cell>
                                        <Badge type="color" size="sm" color={REPORT_STATUS_COLOR[r.status]} className="rounded-sm">
                                            {REPORT_STATUS_LABEL[r.status]}
                                        </Badge>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Tooltip title="Lihat detail">
                                            <Button
                                                color="secondary-brand"
                                                size="sm"
                                                iconLeading={Eye}
                                                aria-label={`Lihat laporan ${r.nomor_laporan}`}
                                                href={route('asset-reports.show', r.id)}
                                            />
                                        </Tooltip>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                        </Table.Body>
                    </Table>

                    <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4">
                        <p className="text-xs text-slate-500">
                            Menampilkan{' '}
                            <span className="font-semibold tabular-nums text-slate-800">
                                {items.from ?? 0}-{items.to ?? 0}
                            </span>{' '}
                            dari <span className="font-semibold tabular-nums text-slate-800">{items.total}</span> laporan
                        </p>

                        {items.last_page > 1 && (
                            <PaginationPageDefault
                                className="border-t-0 pt-0 md:pt-0"
                                page={items.current_page}
                                total={items.last_page}
                                onPageChange={(page) => go({ page })}
                            />
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 3: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
php artisan test --compact --filter='AssetReport|LaporRusak'
git add resources/js/lib/assetReport.ts resources/js/Pages/AssetReports/Index.tsx
git commit -m "feat(ui): migrate the damage report list page to Untitled UI components"
```
Expected: bersih; test hijau.

---

### Task 2: `Create`

**Files:**
- Modify: `resources/js/Pages/AssetReports/Create.tsx` (ganti seluruh isi)

- [ ] **Step 1: Tulis ulang `Create.tsx`**

```tsx
import AssetSelectModal, { SelectableAsset } from '@/Components/AssetSelectModal';
import PageHeader from '@/Components/PageHeader';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import { Label } from '@/Components/ui/base/input/label';
import { RadioButton, RadioGroup } from '@/Components/ui/base/radio-buttons/radio-buttons';
import { Select } from '@/Components/ui/base/select/select';
import { TextArea } from '@/Components/ui/base/textarea/textarea';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_BADGE_COLOR, KONDISI_LABEL, REPORT_TYPE_LABEL } from '@/lib/assetReport';
import { AssetReportType, PageProps } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { Plus, UploadCloud02 } from '@untitledui/icons';
import { useMemo, useRef, useState } from 'react';

interface ReportableAsset {
    id: number;
    kode_barang: string;
    nomor_register: number | string;
    nama_aset: string;
    merk_type: string | null;
    kondisi: string;
    holder: string | null;
}

interface CreateProps extends PageProps {
    assets: ReportableAsset[];
    kondisiOptions: { value: string; label: string }[];
}

export default function Create({ assets, kondisiOptions }: CreateProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const form = useForm({
        asset_id: '',
        jenis: 'rusak' as AssetReportType,
        kondisi_baru: 'rusak_ringan',
        tanggal_kejadian: new Date().toISOString().slice(0, 10),
        kronologi: '',
        photos: [] as File[],
    });

    const selectableAssets: SelectableAsset[] = useMemo(() => {
        return assets.map((a) => ({
            id: a.id,
            kode_barang: a.kode_barang,
            nomor_register: a.nomor_register,
            nama_aset: a.nama_aset,
            merk_type: a.merk_type,
            kondisi: a.kondisi,
            holder: a.holder,
        }));
    }, [assets]);

    const asset = assets.find((a) => String(a.id) === form.data.asset_id);
    const photoError = Object.entries(form.errors).find(([key]) => key.startsWith('photos'))?.[1];
    const isRusak = form.data.jenis === 'rusak';

    const submit = () => {
        form.transform((data) => ({ ...data, kondisi_baru: data.jenis === 'rusak' ? data.kondisi_baru : '' }));
        form.post(route('asset-reports.store'), { forceFormData: true });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Buat Laporan Rusak/Hilang" />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Lapor Rusak/Hilang', href: route('asset-reports.index') }, { label: 'Buat Laporan' }]}
                    title="Buat Laporan Rusak/Hilang"
                />

                <form onSubmit={(e) => e.preventDefault()} className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                    <div className="space-y-1.5">
                        <Label isRequired>Aset yang Dilaporkan</Label>
                        {assets.length === 0 ? (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
                                Tidak ada aset yang dapat dilaporkan di unit Anda.
                            </div>
                        ) : !asset ? (
                            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
                                <p className="text-sm font-semibold text-slate-800">Belum ada aset yang dipilih</p>
                                <p className="mt-1 text-xs text-slate-500">
                                    Buka tabel daftar aset untuk memilih aset yang mengalami kerusakan atau kehilangan
                                </p>
                                <Button className="mt-3" color="primary" size="md" iconLeading={Plus} onPress={() => setIsModalOpen(true)}>
                                    Pilih Aset yang Dilaporkan
                                </Button>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs font-semibold text-slate-600">{asset.kode_barang}</span>
                                            <Badge type="color" size="sm" color="gray" className="rounded-sm">
                                                Reg. #{String(asset.nomor_register).padStart(4, '0')}
                                            </Badge>
                                        </div>
                                        <h3 className="mt-1 text-base font-bold text-slate-900">{asset.nama_aset}</h3>
                                        <p className="text-xs text-slate-500">{asset.merk_type || '—'}</p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-4">
                                        <div className="text-left sm:text-right">
                                            <p className="text-[11px] font-medium text-slate-500">Kondisi Saat Ini</p>
                                            <Badge type="color" size="sm" color={KONDISI_BADGE_COLOR[asset.kondisi] ?? 'gray'} className="mt-0.5 rounded-sm">
                                                {KONDISI_LABEL[asset.kondisi] ?? asset.kondisi}
                                            </Badge>
                                        </div>
                                        <div className="text-left sm:text-right">
                                            <p className="text-[11px] font-medium text-slate-500">Pemegang</p>
                                            <span className="mt-0.5 inline-block text-xs font-semibold text-slate-800">{asset.holder ?? 'Inventaris Unit'}</span>
                                        </div>
                                        <Button color="secondary-brand" size="sm" onPress={() => setIsModalOpen(true)}>
                                            Ganti Aset
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                        {form.errors.asset_id && <p className="text-xs font-medium text-red-600">{form.errors.asset_id}</p>}
                    </div>

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <RadioGroup
                            isRequired
                            className="gap-2"
                            value={form.data.jenis}
                            onChange={(v) => form.setData('jenis', v as AssetReportType)}
                            isInvalid={Boolean(form.errors.jenis)}
                        >
                            <Label isRequired>Jenis Laporan</Label>
                            <div className="flex gap-6">
                                {(['rusak', 'hilang'] as AssetReportType[]).map((j) => (
                                    <RadioButton key={j} value={j} label={REPORT_TYPE_LABEL[j]} />
                                ))}
                            </div>
                            {form.errors.jenis && <p className="text-xs text-red-600">{form.errors.jenis}</p>}
                        </RadioGroup>
                        {isRusak && (
                            <Select
                                label="Kondisi Baru"
                                isRequired
                                items={kondisiOptions.map((o) => ({ id: o.value, label: o.label }))}
                                selectedKey={form.data.kondisi_baru}
                                onSelectionChange={(key) => form.setData('kondisi_baru', String(key))}
                                isInvalid={Boolean(form.errors.kondisi_baru)}
                                hint={form.errors.kondisi_baru}
                            >
                                {(item) => <Select.Item id={item.id} label={item.label} />}
                            </Select>
                        )}
                    </div>

                    <div className="max-w-xs">
                        <Input
                            label="Tanggal Kejadian"
                            type="date"
                            isRequired
                            value={form.data.tanggal_kejadian}
                            onChange={(v) => form.setData('tanggal_kejadian', v)}
                            isInvalid={Boolean(form.errors.tanggal_kejadian)}
                            hint={form.errors.tanggal_kejadian ?? 'Tidak boleh di masa depan.'}
                        />
                    </div>

                    <TextArea
                        label="Kronologi"
                        isRequired
                        rows={4}
                        placeholder="Jelaskan kejadian, waktu, dan penyebabnya."
                        value={form.data.kronologi}
                        onChange={(v) => form.setData('kronologi', v)}
                        isInvalid={Boolean(form.errors.kronologi)}
                        hint={form.errors.kronologi}
                    />

                    <div className="space-y-1.5">
                        <Label isRequired={isRusak}>Foto Pendukung {isRusak ? '(minimal 1)' : '(opsional)'}</Label>
                        <input
                            type="file"
                            ref={fileInputRef}
                            multiple
                            accept=".jpg,.jpeg,.png,.webp"
                            className="hidden"
                            onChange={(e) => form.setData('photos', Array.from(e.target.files ?? []))}
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 p-6 text-center outline-hidden hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
                        >
                            <UploadCloud02 className="size-6 text-slate-400" aria-hidden="true" />
                            <span className="text-sm font-medium text-slate-900">Klik untuk unggah foto (JPG/PNG/WEBP)</span>
                            <span className="text-xs text-slate-500">Maks. 10 foto, 5MB per foto</span>
                        </button>
                        {form.data.photos.length > 0 && (
                            <ul className="space-y-1 text-xs text-slate-600">
                                {form.data.photos.map((f, i) => (
                                    <li key={i}>{f.name}</li>
                                ))}
                            </ul>
                        )}
                        {photoError && <p className="text-xs text-red-600">{photoError}</p>}
                    </div>

                    <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                        <Button color="secondary" size="md" href={route('asset-reports.index')}>
                            Batal
                        </Button>
                        <Button color="primary" size="md" isLoading={form.processing} isDisabled={!form.data.asset_id} onPress={submit}>
                            Ajukan Laporan
                        </Button>
                    </div>
                </form>
            </div>

            <AssetSelectModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                assets={selectableAssets}
                selectedIds={form.data.asset_id ? [Number(form.data.asset_id)] : []}
                onConfirm={(confirmed) => {
                    if (confirmed.length > 0) {
                        form.setData('asset_id', String(confirmed[0].id));
                    }
                    setIsModalOpen(false);
                }}
                mode="single"
                title="Pilih Aset yang Dilaporkan"
                description="Pilih 1 aset dari tabel di bawah ini yang mengalami kerusakan atau kehilangan."
            />
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 2: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
php artisan test --compact --filter='AssetReport|LaporRusak'
git add resources/js/Pages/AssetReports/Create.tsx
git commit -m "feat(ui): migrate the damage report form to Untitled UI components"
```
Expected: bersih; test hijau.

---

### Task 3: `Show` dan gerbang

**Files:**
- Modify: `resources/js/Pages/AssetReports/Show.tsx` (ganti seluruh isi), `resources/js/lib/assetReport.ts` (hapus `REPORT_STATUS_STYLE`)

- [ ] **Step 1: Tulis ulang `Show.tsx`**

```tsx
import ApprovalStepper from '@/Components/ApprovalStepper';
import ApprovalTimeline from '@/Components/ApprovalTimeline';
import CancelRequestModal from '@/Components/CancelRequestModal';
import PageHeader from '@/Components/PageHeader';
import ReassignApproverModal from '@/Components/ReassignApproverModal';
import RejectRequestModal from '@/Components/RejectRequestModal';
import { Dialog, Modal, ModalOverlay } from '@/Components/ui/application/modals/modal';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_LABEL, REPORT_STATUS_COLOR, REPORT_STATUS_LABEL, REPORT_TYPE_LABEL } from '@/lib/assetReport';
import { AssetPhoto, AssetReport, PageProps, ReassignCandidate } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

interface ShowProps extends PageProps {
    report: AssetReport;
    can: { act: boolean; cancel: boolean; reassign: boolean };
    reassignCandidates: ReassignCandidate[];
}

export default function Show({ report, can, reassignCandidates }: ShowProps) {
    const [showReject, setShowReject] = useState(false);
    const [showCancel, setShowCancel] = useState(false);
    const [showReassign, setShowReassign] = useState(false);
    const [photo, setPhoto] = useState<AssetPhoto | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const req = report.approval_request;
    const steps = req?.steps ?? [];

    const approve = () => {
        if (!req || submitting) return;
        setSubmitting(true);
        router.post(route('approval-requests.approve', req.id), {}, { preserveScroll: true, onFinish: () => setSubmitting(false) });
    };

    const rows: [string, string][] = [
        ['Nomor Laporan', report.nomor_laporan],
        ['Jenis', REPORT_TYPE_LABEL[report.jenis]],
        ['Kondisi Baru', KONDISI_LABEL[report.kondisi_baru]],
        ['Kondisi Saat Ini', report.asset ? KONDISI_LABEL[report.asset.kondisi] : '—'],
        ['Tanggal Kejadian', new Date(report.tanggal_kejadian).toLocaleDateString('id-ID')],
        ['Unit', report.unit?.name ?? '—'],
        ['Pemegang', report.pegawai?.nama ?? 'Tidak ada (milik unit)'],
        ['Dilaporkan Oleh', report.creator?.name ?? '—'],
    ];

    return (
        <AuthenticatedLayout>
            <Head title={`Laporan #${report.nomor_laporan}`} />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Lapor Rusak/Hilang', href: route('asset-reports.index') }, { label: 'Detail' }]}
                    title={`Laporan ${REPORT_TYPE_LABEL[report.jenis]} #${report.nomor_laporan}`}
                    badges={
                        <Badge type="color" size="sm" color={REPORT_STATUS_COLOR[report.status]} className="rounded-sm">
                            {REPORT_STATUS_LABEL[report.status]}
                        </Badge>
                    }
                    actions={
                        <>
                            {can.cancel && (
                                <Button color="secondary" size="md" onPress={() => setShowCancel(true)}>
                                    Batalkan Pengajuan
                                </Button>
                            )}
                            {can.reassign && (
                                <Button color="secondary" size="md" onPress={() => setShowReassign(true)}>
                                    Alihkan Approver
                                </Button>
                            )}
                            {can.act && (
                                <>
                                    <Button color="secondary-destructive" size="md" isDisabled={submitting} onPress={() => setShowReject(true)}>
                                        Tolak
                                    </Button>
                                    <Button color="primary" size="md" isLoading={submitting} onPress={approve}>
                                        Setujui
                                    </Button>
                                </>
                            )}
                        </>
                    }
                />

                {req && <ApprovalStepper request={req} />}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                        <p className="mb-3 text-base font-semibold text-slate-900">Detail Laporan</p>
                        <dl className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 text-sm">
                            {rows.map(([label, value], i) => (
                                <div key={label} className={`flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:gap-4 ${i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                                    <dt className="shrink-0 font-medium text-slate-500 sm:w-40">{label}</dt>
                                    <dd className="text-slate-900">{value}</dd>
                                </div>
                            ))}
                        </dl>
                        <p className="mb-1 mt-4 text-sm font-semibold text-slate-900">Kronologi</p>
                        <p className="whitespace-pre-line text-sm text-slate-700">{report.kronologi}</p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                        <p className="mb-3 text-base font-semibold text-slate-900">Aset</p>
                        {report.asset && (
                            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                                <p className="font-semibold text-slate-900">{report.asset.nama_aset}</p>
                                <p className="text-xs text-slate-500">
                                    {report.asset.kode_barang} · {report.asset.merk_type ?? '—'}
                                </p>
                                <Link href={route('assets.show', report.asset.id)} className="mt-1 inline-block text-xs font-medium text-blue-700 hover:underline">
                                    Lihat detail aset
                                </Link>
                            </div>
                        )}
                        <p className="mb-2 text-sm font-semibold text-slate-900">Foto ({report.photos?.length ?? 0})</p>
                        {(report.photos?.length ?? 0) === 0 ? (
                            <p className="text-sm text-slate-400">Tidak ada foto.</p>
                        ) : (
                            <div className="grid grid-cols-3 gap-2">
                                {report.photos?.map((p, idx) => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => setPhoto(p)}
                                        aria-label={`Perbesar foto laporan ${idx + 1}`}
                                        className="aspect-square cursor-pointer overflow-hidden rounded-lg border border-slate-200 outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
                                    >
                                        <img src={p.url} alt="" className="size-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {req && <ApprovalTimeline request={req} createdTitle="Laporan Dibuat" creatorName={report.creator?.name} />}
            </div>

            {showCancel && req && (
                <CancelRequestModal
                    approvalRequestId={req.id}
                    onClose={() => setShowCancel(false)}
                    description="Laporan dihentikan dan tidak lagi muncul di kotak persetujuan. Kondisi aset tidak berubah."
                />
            )}

            {showReassign && req && (
                <ReassignApproverModal
                    approvalRequestId={req.id}
                    candidates={reassignCandidates}
                    stepOrder={req.current_step}
                    stepLabel={steps.find((s) => s.step_order === req.current_step)?.label}
                    onClose={() => setShowReassign(false)}
                />
            )}

            {showReject && req && (
                <RejectRequestModal
                    approvalRequestId={req.id}
                    onClose={() => setShowReject(false)}
                    description="Tuliskan alasan penolakan laporan secara jelas. Alasan ini akan terlihat oleh pelapor."
                />
            )}

            <ModalOverlay isOpen={photo !== null} isDismissable onOpenChange={(open) => !open && setPhoto(null)}>
                <Modal className="sm:max-w-3xl">
                    <Dialog aria-label="Foto laporan">
                        {photo && <img src={photo.url} alt="Foto laporan" className="max-h-[80vh] w-full rounded-xl object-contain" />}
                    </Dialog>
                </Modal>
            </ModalOverlay>
        </AuthenticatedLayout>
    );
}
```
Perbedaan perilaku yang disengaja: modal Tolak memakai komponen bersama (dengan teks pengantar, label judul "Tolak Pengajuan"); stepper/linimasa bersama.

- [ ] **Step 2: Hapus `REPORT_STATUS_STYLE`**

Di `lib/assetReport.ts` hapus konstanta `REPORT_STATUS_STYLE` (tak ada lagi pemakai).

- [ ] **Step 3: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
grep -rn "REPORT_STATUS_STYLE\|window.confirm\|@/Components/Icons" resources/js/Pages/AssetReports resources/js/lib/assetReport.ts
php artisan test --compact --filter='AssetReport|LaporRusak|Approval'
git add resources/js/Pages/AssetReports/Show.tsx resources/js/lib/assetReport.ts
git commit -m "feat(ui): migrate the damage report detail page to Untitled UI components"
```
Expected: bersih; `grep` kosong; test hijau.

- [ ] **Step 4: Cek runtime singkat dan GERBANG LAPOR RUSAK/HILANG — berhenti**

Cek di browser headless (super-admin untuk daftar/detail; `admin.kelurahan@simaset.test` untuk formulir): daftar (filter, pencarian), formulir (dialog pilih aset, ganti jenis ke Hilang, kirim tanpa aset/kronologi untuk galat tanpa menyimpan), detail (stepper, linimasa, dialog Batalkan/Alihkan/Tolak tanpa dikonfirmasi bila tombol tampil, lightbox bila ada foto).

Laporkan hasil Task 1–3, `Ruling`, dan hal yang tak bisa diverifikasi. Minta pengguna memeriksa:
- **Daftar**: filter Status/Jenis/Urutkan, pencarian, badge Kondisi Baru dan Status, tabel muat di laptop, pagination.
- **Formulir**: tiga keadaan pemilih aset, dialog pilih aset (mode satu pilihan), jenis Rusak ↔ Hilang (Kondisi Baru hilang, tanda wajib foto berubah), tanggal, kronologi, unggah foto, galat per field, tombol Ajukan nonaktif sampai aset dipilih.
- **Detail**: badge status, tombol sesuai izin, stepper dan linimasa bersama, kartu Aset, galeri foto + lightbox, dialog Batalkan/Alihkan/Tolak.
- **Keyboard** (Tab/Spasi/Esc), layar 375 px, cincin fokus.
**Jangan memulai modul berikutnya** sebelum pengguna menyatakan lolos.

---

## Catatan Review (ponytail + impeccable, sudah diterapkan)

- Ponytail: tidak ada komponen baru. Blok unggah berkas mirip dengan unggah dokumen di formulir Penerimaan; ekstraksi `FileDropzone` ditunda sampai konsumen ketiga (formulir Aset punya pengunggah sendiri) agar formulir Penerimaan yang sudah lolos tidak disentuh.
- Impeccable (Operate): karena atribut `max` tanggal tidak diteruskan `Input`, batas "tidak boleh di masa depan" ditampilkan sebagai teks bantu (galat server menggantikannya bila ada); badge Kondisi Saat Ini/Baru mengikuti warna kondisi di modul lain. Dicek saat eksekusi: `Label` berdiri sendiri (di luar field) tampil benar; pratinjau foto unggahan tetap berupa daftar nama berkas (perilaku lama, tidak ditambah).
