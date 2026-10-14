# Migrasi Untitled UI, Fase 4: Permohonan Aset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memigrasikan modul Permohonan Aset (`Index`, `Create`, `Show`) ke komponen Untitled UI tanpa mengubah logika, props Inertia, atau backend, dengan memakai komponen bersama yang sudah dibuat pada modul Mutasi (`ApprovalStepper`, `ApprovalTimeline`, `RejectRequestModal`, `AssetSelectModal`).

**Architecture:** Hanya frontend. `Index` mengikuti pola Mutasi/Penerimaan. `Create` adalah formulir pendek (radio jenis, pegawai/jumlah, subkategori, keterangan). `Show` memakai komponen alur persetujuan bersama; panel "Pemenuhan" (pilih aset lalu serahkan/ajukan mutasi) memakai `AssetSelectModal` + `Table`; modal "Tutup Permohonan" tetap lokal (satu konsumen).

**Tech Stack:** React 19, Inertia 2, Tailwind 4, Untitled UI (React Aria Components), `@untitledui/icons`.

**Spec:** `docs/superpowers/specs/2026-10-14-migrasi-untitled-ui-design.md` §3.5 butir 3. Pola acuan: plan Mutasi dan Penerimaan.

## Global Constraints

- Hanya komponen Untitled UI gratis. Logika tidak berubah: filter server (`go`), `transform` di Create (`jumlah` kosong untuk jenis pegawai, `pegawai_id` kosong untuk jenis unit), `post` helper di Show (`approve`, `fulfill`, `close`, `reject`), `stepState`, `can.*`, `selected`, syarat tombol pemenuhan (`selected.length === 0 || (!single && selected.length !== r.jumlah)`), props Inertia, nama berkas. `ListFilters.tsx` dan `lib/pagination.ts` tidak diubah.
- Warna tombol: Ajukan/Buat/Setujui/Serahkan/Buka daftar `primary`; Lihat `secondary-brand`; Batalkan/Alihkan/Tutup Permohonan/Batal `secondary`; Tolak dan hapus pilihan `secondary-destructive`; "Ubah Pilihan" `link-color`. Badge `type="color" size="sm" className="rounded-sm"`; status `Menunggu Pemenuhan` biru, `Dipenuhi` hijau.
- `Input` Untitled tidak meneruskan atribut `min`; server memvalidasi jumlah. Kunci kosong tidak valid pada `Select`: belum dipilih memakai `selectedKey={… || null}` dengan `placeholder`; filter memakai kunci `__all`.
- Impor `@/Components/...` berhuruf besar; tanpa `@/Components/Icons`; tanpa dependensi baru. `REQUEST_STATUS_STYLE` hanya dipakai Index dan Show Permohonan; diganti `REQUEST_STATUS_COLOR` (peta gaya dihapus di task terakhir agar tiap commit tetap dapat dibangun).
- Verifikasi: `npx tsc --noEmit`, `npm run build`, test backend `--filter='AssetRequest|Permohonan|Approval'`. Cek runtime singkat diperbolehkan (tanpa menyimpan data permanen); penilaian visual oleh pengguna di gerbang.
- Git: commit per task di `main`, tanpa trailer Co-Authored-By, stage dengan path eksplisit, tanpa push.

## Review Focus

1. **Filter "Menunggu Pemenuhan"** adalah tombol hidup/mati (`aria-pressed`) yang menambah `menunggu_pemenuhan=1`; diganti `Toggle` bertuliskan sama. Pagar: Task 1.
2. **Formulir Create**: dua jenis (opsi "Untuk unit" hanya bila `canUnit`); bidang bergantian pegawai/jumlah; kirim dengan `transform` yang sama. Pagar: Task 2.
3. **Panel Pemenuhan**: tiga keadaan (tak ada aset memenuhi syarat, belum memilih, sudah memilih) dan syarat tombol kirim tidak berubah; mode `single` (pegawai) vs `multiple` dengan `maxSelection = jumlah`. Pagar: Task 3.
4. **Dua jalur catatan**: Tolak (komponen bersama) dan Tutup Permohonan (lokal) sama-sama wajib alasan dan terkunci saat memproses. Pagar: Task 3.
5. **Stepper/linimasa bersama**: label langkah kini "label" saja (tanpa awalan "Step N:"), nama approver di langkah selesai, waktu proses di linimasa. Pagar: butir gerbang.
6. **Tindakan sesuai izin**: kondisi `can.cancel/reassign/close/act/fulfill` dipertahankan persis. Pagar: Task 3.

---

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `resources/js/lib/assetRequest.ts` | Tambah `REQUEST_STATUS_COLOR`; hapus `REQUEST_STATUS_STYLE` di akhir |
| `resources/js/Pages/AssetRequests/Index.tsx` | Daftar |
| `resources/js/Pages/AssetRequests/Create.tsx` | Formulir |
| `resources/js/Pages/AssetRequests/Show.tsx` | Detail, pemenuhan, tindakan persetujuan |

---

### Task 1: Warna status dan `Index`

**Files:**
- Modify: `resources/js/lib/assetRequest.ts`, `resources/js/Pages/AssetRequests/Index.tsx` (ganti seluruh isi)

- [ ] **Step 1: Tambah peta warna status**

Di `lib/assetRequest.ts`, setelah `REQUEST_STATUS_LABEL`, tambahkan (biarkan `REQUEST_STATUS_STYLE` sampai Task 3):
```ts
export const REQUEST_STATUS_COLOR: Record<AssetRequestStatus, 'warning' | 'blue' | 'success' | 'error' | 'gray'> = {
    pending: 'warning',
    approved: 'blue',
    fulfilled: 'success',
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
import { Toggle } from '@/Components/ui/base/toggle/toggle';
import { Tooltip } from '@/Components/ui/base/tooltip/tooltip';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { REQUEST_STATUS_COLOR, REQUEST_STATUS_LABEL, REQUEST_TYPE_LABEL } from '@/lib/assetRequest';
import { AssetRequest, AssetRequestStatus, AssetRequestType, PageProps, Paginated } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Eye, Plus, SearchLg, XClose } from '@untitledui/icons';
import { FormEvent, useState } from 'react';

interface IndexProps extends PageProps {
    items: Paginated<AssetRequest>;
    filters: { search?: string; status?: string; jenis?: string; menunggu_pemenuhan?: string; urut?: string };
    sortOptions: { value: string; label: string }[];
    can: { create: boolean };
}

const ALL = '__all';

const STATUS_ITEMS = [
    { id: ALL, label: 'Semua status' },
    ...(Object.keys(REQUEST_STATUS_LABEL) as AssetRequestStatus[]).map((key) => ({ id: key, label: REQUEST_STATUS_LABEL[key] })),
];

const JENIS_ITEMS = [
    { id: ALL, label: 'Semua jenis' },
    ...(Object.keys(REQUEST_TYPE_LABEL) as AssetRequestType[]).map((key) => ({ id: key, label: REQUEST_TYPE_LABEL[key] })),
];

export default function Index({ items, filters, sortOptions, can }: IndexProps) {
    const [search, setSearch] = useState(filters.search ?? '');
    const waiting = filters.menunggu_pemenuhan === '1';
    const hasFilter = Boolean(filters.status || filters.jenis || waiting);

    const go = (changes: Record<string, string | number | undefined>) => {
        const params = { ...filters, search: search || undefined, ...changes };
        const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
        router.get(route('asset-requests.index'), clean, { preserveState: true, preserveScroll: true, replace: true });
    };

    const submitSearch = (e: FormEvent) => {
        e.preventDefault();
        go({ page: undefined });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Permohonan Aset" />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Permohonan Aset' }]}
                    title="Permohonan Aset"
                    actions={
                        can.create && (
                            <Button color="primary" size="md" iconLeading={Plus} href={route('asset-requests.create')}>
                                Buat Permohonan
                            </Button>
                        )
                    }
                />

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                    <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                        <div className="pb-2.5">
                            <Toggle
                                label="Menunggu Pemenuhan"
                                isSelected={waiting}
                                onChange={(on) => go({ menunggu_pemenuhan: on ? '1' : undefined, page: undefined })}
                            />
                        </div>
                    </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    <form onSubmit={submitSearch} className="flex max-w-lg items-center gap-2 border-b border-slate-200 p-4">
                        <div className="flex-1">
                            <Input
                                aria-label="Cari"
                                size="md"
                                icon={SearchLg}
                                placeholder="Cari nomor permohonan atau keterangan..."
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

                    <Table aria-label="Daftar permohonan aset" size="sm">
                        <Table.Header>
                            <Table.Head id="nomor" label="No. Permohonan" isRowHeader />
                            <Table.Head id="jenis" label="Jenis" />
                            <Table.Head id="pemohon" label="Pemohon" />
                            <Table.Head id="kategori" label="Subkategori" />
                            <Table.Head id="jumlah" label="Jumlah" />
                            <Table.Head id="tanggal" label="Tanggal" />
                            <Table.Head id="status" label="Status" />
                            <Table.Head id="aksi" label="Aksi" />
                        </Table.Header>
                        <Table.Body
                            items={items.data}
                            renderEmptyState={() => (
                                <p className="py-14 text-center text-sm text-slate-400">
                                    {hasFilter || filters.search ? 'Tidak ada permohonan yang cocok dengan filter.' : 'Belum ada permohonan.'}
                                </p>
                            )}
                        >
                            {(r) => (
                                <Table.Row id={r.id}>
                                    <Table.Cell className="whitespace-nowrap font-medium text-slate-800">{r.nomor_permohonan}</Table.Cell>
                                    <Table.Cell className="text-slate-800">{REQUEST_TYPE_LABEL[r.jenis]}</Table.Cell>
                                    <Table.Cell className="font-semibold text-slate-900">{r.jenis === 'pegawai' ? r.pegawai?.nama : r.unit?.name}</Table.Cell>
                                    <Table.Cell className="text-slate-800">{r.category?.name}</Table.Cell>
                                    <Table.Cell className="text-right tabular-nums text-slate-800">{r.jumlah}</Table.Cell>
                                    <Table.Cell className="whitespace-nowrap text-slate-800">{new Date(r.created_at).toLocaleDateString('id-ID')}</Table.Cell>
                                    <Table.Cell>
                                        <Badge type="color" size="sm" color={REQUEST_STATUS_COLOR[r.status]} className="rounded-sm">
                                            {REQUEST_STATUS_LABEL[r.status]}
                                        </Badge>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Tooltip title="Lihat detail">
                                            <Button
                                                color="secondary-brand"
                                                size="sm"
                                                iconLeading={Eye}
                                                aria-label={`Lihat permohonan ${r.nomor_permohonan}`}
                                                href={route('asset-requests.show', r.id)}
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
                            dari <span className="font-semibold tabular-nums text-slate-800">{items.total}</span> permohonan
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
Prop yang berbeda dari yang diasumsikan (mis. `Toggle` `onChange`) disesuaikan dan dicatat sebagai `Ruling`.

- [ ] **Step 3: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
php artisan test --compact --filter='AssetRequest|Permohonan'
git add resources/js/lib/assetRequest.ts resources/js/Pages/AssetRequests/Index.tsx
git commit -m "feat(ui): migrate the request list page to Untitled UI components"
```
Expected: bersih; test hijau.

---

### Task 2: `Create`

**Files:**
- Modify: `resources/js/Pages/AssetRequests/Create.tsx` (ganti seluruh isi)

- [ ] **Step 1: Tulis ulang `Create.tsx`**

```tsx
import PageHeader from '@/Components/PageHeader';
import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import { Label } from '@/Components/ui/base/input/label';
import { RadioButton, RadioGroup } from '@/Components/ui/base/radio-buttons/radio-buttons';
import { Select } from '@/Components/ui/base/select/select';
import { TextArea } from '@/Components/ui/base/textarea/textarea';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AssetRequestType, PageProps } from '@/types';
import { Head, useForm } from '@inertiajs/react';

interface CreateProps extends PageProps {
    pegawais: { id: number; nama: string; jabatan: string | null }[];
    categories: { id: number; name: string }[];
    canUnit: boolean;
}

export default function Create({ pegawais, categories, canUnit }: CreateProps) {
    const form = useForm({
        jenis: 'pegawai' as AssetRequestType,
        pegawai_id: '',
        jumlah: '1',
        category_id: '',
        keterangan: '',
    });

    const submit = () => {
        form.transform((data) => (data.jenis === 'pegawai' ? { ...data, jumlah: '' } : { ...data, pegawai_id: '' }));
        form.post(route('asset-requests.store'));
    };

    return (
        <AuthenticatedLayout>
            <Head title="Buat Permohonan Aset" />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Permohonan Aset', href: route('asset-requests.index') }, { label: 'Buat Permohonan' }]}
                    title="Buat Permohonan Aset"
                />

                <form onSubmit={(e) => e.preventDefault()} className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                    <RadioGroup
                        isRequired
                        className="gap-2"
                        value={form.data.jenis}
                        onChange={(v) => form.setData('jenis', v as AssetRequestType)}
                        isInvalid={Boolean(form.errors.jenis)}
                    >
                        <Label isRequired>Jenis Permohonan</Label>
                        <RadioButton value="pegawai" label="Untuk pegawai (aset diserahkan ke pegawai dari stok unit)" />
                        {canUnit && <RadioButton value="unit" label="Untuk unit (minta stok dari kecamatan)" />}
                        {form.errors.jenis && <p className="text-xs text-red-600">{form.errors.jenis}</p>}
                    </RadioGroup>

                    {form.data.jenis === 'pegawai' ? (
                        <Select
                            label="Pegawai"
                            isRequired
                            placeholder="Pilih pegawai..."
                            items={pegawais.map((p) => ({ id: String(p.id), label: `${p.nama}${p.jabatan ? ` — ${p.jabatan}` : ''}` }))}
                            selectedKey={form.data.pegawai_id || null}
                            onSelectionChange={(key) => form.setData('pegawai_id', String(key))}
                            isInvalid={Boolean(form.errors.pegawai_id)}
                            hint={form.errors.pegawai_id}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                    ) : (
                        <div className="max-w-xs">
                            <Input
                                label="Jumlah Barang"
                                type="number"
                                inputMode="numeric"
                                isRequired
                                inputClassName="tabular-nums"
                                value={form.data.jumlah}
                                onChange={(v) => form.setData('jumlah', v)}
                                isInvalid={Boolean(form.errors.jumlah)}
                                hint={form.errors.jumlah}
                            />
                        </div>
                    )}

                    <Select
                        label="Subkategori Aset yang Diminta"
                        isRequired
                        placeholder="Pilih subkategori..."
                        items={categories.map((c) => ({ id: String(c.id), label: c.name }))}
                        selectedKey={form.data.category_id || null}
                        onSelectionChange={(key) => form.setData('category_id', String(key))}
                        isInvalid={Boolean(form.errors.category_id)}
                        hint={form.errors.category_id}
                    >
                        {(item) => <Select.Item id={item.id} label={item.label} />}
                    </Select>

                    <TextArea
                        label="Keterangan / Alasan"
                        isRequired
                        rows={4}
                        placeholder="Jelaskan kebutuhan dan alasan permohonan."
                        value={form.data.keterangan}
                        onChange={(v) => form.setData('keterangan', v)}
                        isInvalid={Boolean(form.errors.keterangan)}
                        hint={form.errors.keterangan}
                    />

                    <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                        <Button color="secondary" size="md" href={route('asset-requests.index')}>
                            Batal
                        </Button>
                        <Button color="primary" size="md" isLoading={form.processing} onPress={submit}>
                            Ajukan Permohonan
                        </Button>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 2: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
php artisan test --compact --filter='AssetRequest|Permohonan'
git add resources/js/Pages/AssetRequests/Create.tsx
git commit -m "feat(ui): migrate the request form to Untitled UI components"
```
Expected: bersih; test hijau.

---

### Task 3: `Show` dan gerbang

**Files:**
- Modify: `resources/js/Pages/AssetRequests/Show.tsx` (ganti seluruh isi), `resources/js/lib/assetRequest.ts` (hapus `REQUEST_STATUS_STYLE`)

- [ ] **Step 1: Tulis ulang `Show.tsx`**

```tsx
import ApprovalStepper from '@/Components/ApprovalStepper';
import ApprovalTimeline from '@/Components/ApprovalTimeline';
import AssetSelectModal, { SelectableAsset } from '@/Components/AssetSelectModal';
import CancelRequestModal from '@/Components/CancelRequestModal';
import PageHeader from '@/Components/PageHeader';
import ReassignApproverModal from '@/Components/ReassignApproverModal';
import RejectRequestModal from '@/Components/RejectRequestModal';
import { Dialog, Modal, ModalOverlay } from '@/Components/ui/application/modals/modal';
import { Table } from '@/Components/ui/application/table/table';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { TextArea } from '@/Components/ui/base/textarea/textarea';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { REQUEST_STATUS_COLOR, REQUEST_STATUS_LABEL, REQUEST_TYPE_LABEL } from '@/lib/assetRequest';
import { AssetRequest, PageProps, ReassignCandidate } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { XClose } from '@untitledui/icons';
import { useMemo, useState } from 'react';

interface EligibleAsset {
    id: number;
    kode_barang: string;
    nomor_register: number | string;
    nama_aset: string;
    merk_type: string | null;
    kondisi: string;
}

interface ShowProps extends PageProps {
    assetRequest: AssetRequest;
    can: { act: boolean; cancel: boolean; reassign: boolean; fulfill: boolean; close: boolean };
    reassignCandidates: ReassignCandidate[];
    eligibleAssets: EligibleAsset[];
}

export default function Show({ assetRequest: r, can, reassignCandidates, eligibleAssets }: ShowProps) {
    const [showReject, setShowReject] = useState(false);
    const [showCancel, setShowCancel] = useState(false);
    const [showReassign, setShowReassign] = useState(false);
    const [showClose, setShowClose] = useState(false);
    const [note, setNote] = useState('');
    const [selected, setSelected] = useState<number[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [isFulfillModalOpen, setIsFulfillModalOpen] = useState(false);

    const req = r.approval_request;
    const steps = req?.steps ?? [];
    const single = r.jenis === 'pegawai';

    const selectableEligibleAssets: SelectableAsset[] = useMemo(() => {
        return eligibleAssets.map((a) => ({
            id: a.id,
            kode_barang: a.kode_barang,
            nomor_register: a.nomor_register,
            nama_aset: a.nama_aset,
            merk_type: a.merk_type,
            kondisi: a.kondisi,
            holder: null,
        }));
    }, [eligibleAssets]);

    const selectedAssetsDetails = useMemo(() => {
        return eligibleAssets.filter((a) => selected.includes(a.id));
    }, [eligibleAssets, selected]);

    const post = (name: string, id: number, data: Parameters<typeof router.post>[1], onSuccess?: () => void) => {
        if (submitting) return;
        setSubmitting(true);
        router.post(route(name, id), data, { preserveScroll: true, onSuccess, onFinish: () => setSubmitting(false) });
    };

    const dismissCloseModal = () => {
        setShowClose(false);
        setNote('');
    };

    const rows: [string, string][] = [
        ['Nomor Permohonan', r.nomor_permohonan],
        ['Jenis', REQUEST_TYPE_LABEL[r.jenis]],
        ['Pemohon', r.jenis === 'pegawai' ? (r.pegawai?.nama ?? '—') : (r.unit?.name ?? '—')],
        ['Unit', r.unit?.name ?? '—'],
        ['Subkategori', r.category?.name ?? '—'],
        ['Jumlah', String(r.jumlah)],
        ['Diajukan Oleh', r.creator?.name ?? '—'],
    ];

    return (
        <AuthenticatedLayout>
            <Head title={`Permohonan #${r.nomor_permohonan}`} />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Permohonan Aset', href: route('asset-requests.index') }, { label: 'Detail' }]}
                    title={`Permohonan #${r.nomor_permohonan}`}
                    badges={
                        <Badge type="color" size="sm" color={REQUEST_STATUS_COLOR[r.status]} className="rounded-sm">
                            {REQUEST_STATUS_LABEL[r.status]}
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
                            {can.close && (
                                <Button color="secondary" size="md" onPress={() => setShowClose(true)}>
                                    Tutup Permohonan
                                </Button>
                            )}
                            {can.act && (
                                <>
                                    <Button color="secondary-destructive" size="md" isDisabled={submitting} onPress={() => setShowReject(true)}>
                                        Tolak
                                    </Button>
                                    <Button color="primary" size="md" isLoading={submitting} onPress={() => req && post('approval-requests.approve', req.id, {})}>
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
                        <p className="mb-3 text-base font-semibold text-slate-900">Detail Permohonan</p>
                        <dl className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 text-sm">
                            {rows.map(([label, value], i) => (
                                <div key={label} className={`flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:gap-4 ${i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                                    <dt className="shrink-0 font-medium text-slate-500 sm:w-40">{label}</dt>
                                    <dd className="text-slate-900">{value}</dd>
                                </div>
                            ))}
                        </dl>
                        <p className="mb-1 mt-4 text-sm font-semibold text-slate-900">Keterangan</p>
                        <p className="whitespace-pre-line text-sm text-slate-700">{r.keterangan}</p>
                        {r.catatan_penutupan && (
                            <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">Ditutup: {r.catatan_penutupan}</p>
                        )}
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                        <p className="mb-3 text-base font-semibold text-slate-900">Pemenuhan</p>

                        {r.mutation && (
                            <p className="mb-3 text-sm text-slate-700">
                                Mutasi:{' '}
                                <Link href={route('asset-mutations.show', r.mutation.id)} className="font-semibold text-blue-700 hover:underline">
                                    {r.mutation.nomor_mutasi}
                                </Link>
                            </p>
                        )}

                        {(r.assets?.length ?? 0) > 0 && (
                            <ul className="mb-3 space-y-1.5 text-sm">
                                {r.assets?.map((a) => (
                                    <li key={a.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                        <Link href={route('assets.show', a.id)} className="font-semibold text-slate-900 hover:text-blue-700">
                                            {a.nama_aset}
                                        </Link>
                                        <span className="ml-2 text-xs text-slate-500">{a.kode_barang}</span>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {can.fulfill ? (
                            <div className="space-y-3">
                                {eligibleAssets.length === 0 ? (
                                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
                                        Belum ada aset yang memenuhi syarat di unit Anda. Anda dapat menutup permohonan ini.
                                    </div>
                                ) : selected.length === 0 ? (
                                    <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-5 text-center">
                                        <p className="text-sm font-semibold text-slate-800">Pilih {single ? '1 aset' : `tepat ${r.jumlah} aset`} untuk dipenuhi</p>
                                        <p className="mt-1 text-xs text-slate-500">Tersedia {eligibleAssets.length} aset yang memenuhi syarat</p>
                                        <Button className="mt-3" color="primary" size="md" onPress={() => setIsFulfillModalOpen(true)}>
                                            Buka Daftar Aset untuk Dipenuhi
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                                    Aset Terpilih ({selected.length}
                                                    {!single ? ` / ${r.jumlah}` : ''})
                                                </p>
                                                {!single && selected.length !== r.jumlah && (
                                                    <p className="text-xs font-semibold text-amber-600">Harus memilih tepat {r.jumlah} aset</p>
                                                )}
                                            </div>
                                            <Button color="link-color" size="sm" onPress={() => setIsFulfillModalOpen(true)}>
                                                Ubah Pilihan
                                            </Button>
                                        </div>

                                        <div className="overflow-hidden rounded-xl border border-slate-200">
                                            <Table aria-label="Aset terpilih untuk pemenuhan" size="sm">
                                                <Table.Header>
                                                    <Table.Head id="nama" label="Nama Barang" isRowHeader />
                                                    <Table.Head id="kode" label="Kode & Reg" />
                                                    <Table.Head id="aksi" label="Aksi" />
                                                </Table.Header>
                                                <Table.Body items={selectedAssetsDetails}>
                                                    {(asset) => (
                                                        <Table.Row id={asset.id}>
                                                            <Table.Cell>
                                                                <span className="font-semibold text-slate-900">{asset.nama_aset}</span>
                                                                <span className="block text-xs text-slate-500">{asset.merk_type || '—'}</span>
                                                            </Table.Cell>
                                                            <Table.Cell className="whitespace-nowrap">
                                                                <span className="font-mono text-xs text-slate-700">{asset.kode_barang}</span>
                                                                <span className="block text-[11px] font-semibold text-slate-500">
                                                                    Reg. #{String(asset.nomor_register).padStart(4, '0')}
                                                                </span>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <Button
                                                                    color="secondary-destructive"
                                                                    size="sm"
                                                                    iconLeading={XClose}
                                                                    aria-label={`Hapus pilihan ${asset.nama_aset}`}
                                                                    onPress={() => setSelected((cur) => cur.filter((id) => id !== asset.id))}
                                                                />
                                                            </Table.Cell>
                                                        </Table.Row>
                                                    )}
                                                </Table.Body>
                                            </Table>
                                        </div>

                                        <Button
                                            className="w-full"
                                            color="primary"
                                            size="md"
                                            isLoading={submitting}
                                            isDisabled={selected.length === 0 || (!single && selected.length !== r.jumlah)}
                                            onPress={() => post('asset-requests.fulfill', r.id, { asset_ids: selected }, () => setSelected([]))}
                                        >
                                            {single ? 'Serahkan ke Pegawai' : 'Ajukan Mutasi Pemenuhan'}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            r.status === 'approved' && !r.mutation && <p className="text-sm text-slate-500">Menunggu pemenuhan oleh admin unit terkait.</p>
                        )}
                    </div>
                </div>

                {req && <ApprovalTimeline request={req} createdTitle="Permohonan Dibuat" creatorName={r.creator?.name} createdAt={r.created_at} />}
            </div>

            {showCancel && req && (
                <CancelRequestModal
                    approvalRequestId={req.id}
                    onClose={() => setShowCancel(false)}
                    description="Permohonan dihentikan dan tidak lagi muncul di kotak persetujuan."
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
                    description="Tuliskan alasan penolakan secara jelas. Alasan ini akan terlihat oleh pemohon."
                />
            )}

            <ModalOverlay isOpen={showClose} isDismissable={!submitting} isKeyboardDismissDisabled={submitting} onOpenChange={(open) => !open && dismissCloseModal()}>
                <Modal className="sm:max-w-md">
                    <Dialog aria-labelledby="close-request-title">
                        <div className="w-full p-6">
                            <h3 id="close-request-title" className="mb-2 text-base font-bold text-slate-900">
                                Tutup Permohonan
                            </h3>
                            <p className="mb-4 text-xs leading-relaxed text-slate-600">Permohonan ditutup tanpa dipenuhi. Alasan penutupan tercatat pada permohonan.</p>
                            <TextArea label="Alasan Penutupan" isRequired rows={4} maxLength={1000} value={note} onChange={setNote} />
                            <div className="mt-6 flex items-center justify-end gap-3">
                                <Button color="secondary" size="md" isDisabled={submitting} onPress={dismissCloseModal}>
                                    Batal
                                </Button>
                                <Button
                                    color="primary-destructive"
                                    size="md"
                                    isLoading={submitting}
                                    isDisabled={!note.trim()}
                                    onPress={() => post('asset-requests.close', r.id, { note: note.trim() }, dismissCloseModal)}
                                >
                                    Ya, Tutup
                                </Button>
                            </div>
                        </div>
                    </Dialog>
                </Modal>
            </ModalOverlay>

            {can.fulfill && (
                <AssetSelectModal
                    isOpen={isFulfillModalOpen}
                    onClose={() => setIsFulfillModalOpen(false)}
                    assets={selectableEligibleAssets}
                    selectedIds={selected}
                    onConfirm={(confirmed) => {
                        setSelected(confirmed.map((a) => a.id));
                        setIsFulfillModalOpen(false);
                    }}
                    mode={single ? 'single' : 'multiple'}
                    maxSelection={single ? 1 : r.jumlah}
                    title="Pilih Aset untuk Dipenuhi"
                    description={
                        single
                            ? 'Pilih 1 aset dari daftar di bawah ini untuk diserahkan kepada pegawai pemohon.'
                            : `Pilih tepat ${r.jumlah} aset dari daftar di bawah ini untuk dimutasi ke unit pemohon.`
                    }
                />
            )}
        </AuthenticatedLayout>
    );
}
```
Perbedaan perilaku yang disengaja: modal Tolak memakai komponen bersama (dengan teks pengantar); modal Tutup Permohonan mendapat teks pengantar dan tombol destruktif; stepper/linimasa bersama.

- [ ] **Step 2: Hapus `REQUEST_STATUS_STYLE`**

Di `lib/assetRequest.ts` hapus konstanta `REQUEST_STATUS_STYLE` (tak ada lagi pemakai).

- [ ] **Step 3: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
grep -rn "REQUEST_STATUS_STYLE\|window.confirm\|@/Components/Icons" resources/js/Pages/AssetRequests resources/js/lib/assetRequest.ts
php artisan test --compact --filter='AssetRequest|Permohonan|Approval'
git add resources/js/Pages/AssetRequests/Show.tsx resources/js/lib/assetRequest.ts
git commit -m "feat(ui): migrate the request detail page to Untitled UI components"
```
Expected: bersih; `grep` kosong; test hijau.

- [ ] **Step 4: Cek runtime singkat dan GERBANG PERMOHONAN — berhenti**

Cek di browser headless (super-admin untuk daftar/detail; akun dengan `permohonan.create` untuk formulir): daftar (filter, toggle, pencarian, pagination), formulir (ganti jenis, kirim kosong untuk galat tanpa menyimpan), detail (stepper, linimasa, dialog Batalkan/Alihkan/Tolak/Tutup tanpa dikonfirmasi, panel Pemenuhan bila akun berhak).

Laporkan hasil Task 1–3, `Ruling`, dan hal yang tak bisa diverifikasi. Minta pengguna memeriksa:
- **Daftar**: filter Status/Jenis/Urutkan, toggle Menunggu Pemenuhan, pencarian, badge status (Menunggu kuning, Menunggu Pemenuhan biru, Dipenuhi hijau, Ditolak merah, Dibatalkan abu), tabel muat di laptop.
- **Formulir**: radio jenis (opsi unit hanya bila berhak), bidang pegawai ↔ jumlah, galat per field, tombol Ajukan.
- **Detail**: badge status, tombol sesuai izin, stepper dan linimasa bersama, panel Pemenuhan (tiga keadaan, dialog pilih aset, tabel terpilih, tombol kirim dengan syarat jumlah tepat), dialog Tolak dan Tutup Permohonan.
- **Keyboard** (Tab/Spasi/Esc), layar 375 px, cincin fokus.
**Jangan memulai modul berikutnya** sebelum pengguna menyatakan lolos.

---

## Catatan Review (ponytail + impeccable, sudah diterapkan)

- Ponytail: lean; tidak ada komponen baru (memakai komponen bersama Mutasi), modal Tutup Permohonan tetap lokal karena satu konsumen. Pembantu `closeCloseModal` diganti nama `dismissCloseModal`.
- Impeccable (Operate): "Tutup Permohonan" memakai tombol destruktif karena menutup tanpa dipenuhi; filter hidup/mati memakai `Toggle` (bukan tombol bertekan) agar keadaan aktif terbaca; kesejajaran `Toggle` dengan `Select` (`pb-2.5`) dicek saat eksekusi. Enter di formulir Create tidak mengirim (sama dengan Penerimaan/Mutasi; tombol Ajukan satu-satunya jalur).
