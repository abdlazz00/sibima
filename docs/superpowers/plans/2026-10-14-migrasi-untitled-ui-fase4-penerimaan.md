# Migrasi Untitled UI, Fase 4: Penerimaan Aset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memigrasikan modul Penerimaan Aset (`Index`, `PenerimaanForm` untuk `Create`/`Edit`, `Show`) ke komponen Untitled UI tanpa mengubah logika, props Inertia, atau backend, dan memigrasikan dua modal persetujuan bersama (`CancelRequestModal`, `ReassignApproverModal`) bersama konsumen pertamanya.

**Architecture:** Hanya frontend. `Index` memakai `Table` (rapat), `PaginationPageDefault`, dan filter `Select`/`Input`. `PenerimaanForm` memakai `Input`/`Select`/`TextArea`, ulangan barang dengan bilah aksi lengket (Simpan Draft / Ajukan Penerimaan). `Show` memakai `PageHeader`, `ConfirmDialog`, dan modal berbasis `ModalOverlay`. Modul transaksi lain (Mutasi, Permohonan, Lapor Rusak/Hilang) ikut mendapat tampilan baru kedua modal bersama itu tanpa perubahan props.

**Tech Stack:** React 19, Inertia 2, Tailwind 4, Untitled UI (React Aria Components), `@untitledui/icons`.

**Spec:** `docs/superpowers/specs/2026-10-14-migrasi-untitled-ui-design.md` §3.5 butir 3 (Transaksi, satu modul per langkah atas permintaan pengguna). Pola acuan: plan Pengguna, Alur, dan Aset di `docs/superpowers/plans/`.

## Global Constraints

- Hanya komponen Untitled UI gratis. Panduan UI/UX menang untuk identitas; Untitled UI menang untuk semantik, keyboard, fokus.
- Logika tidak berubah: `useForm` penerimaan (termasuk `items`, `dokumen`, `hapus_dokumen`), `transform` (`status`, `_method: 'put'` pada edit karena PHP tidak mem-parse multipart PUT), `forceFormData`, filter server (`goTo`), `approve`/`reject`/`cancel`/`reassign`, `deleteDraft`, `stepState`, `can.*`, props Inertia, nama berkas. `Create.tsx` dan `Edit.tsx` (pembungkus tipis) tidak diubah. `ListFilters.tsx` dan `lib/pagination.ts` tidak diubah (masih dipakai halaman lain).
- `window.confirm` diganti `ConfirmDialog` dengan teks yang sama. Teks bagian formulir "Section N:" menjadi "N." (bahasa konsisten dengan modul lain).
- Warna tombol: Ajukan/Setujui/Simpan `primary`; Lihat `secondary-brand`; Edit `secondary-green`; Hapus draft, Tolak `secondary-destructive`; Batalkan/Alihkan/Simpan Draft/Batal `secondary`; Tambah Barang `secondary-brand`. Badge status memakai peta warna di `lib/penerimaanStatus.ts`.
- `Input` Untitled tidak meneruskan atribut `min`; server memvalidasi jumlah dan nilai. Kunci kosong tidak valid pada `Select`: belum dipilih memakai `selectedKey={… || null}` dengan `placeholder`.
- Impor `@/Components/...` berhuruf besar; tanpa komponen Breeze atau `@/Components/Icons`; tanpa dependensi baru.
- Verifikasi: `npx tsc --noEmit`, `npm run build`, test backend `--filter='Penerimaan|Approval|Persetujuan'`. Cek runtime singkat di browser diperbolehkan untuk menangkap error (tanpa menyimpan data permanen); penilaian visual oleh pengguna di gerbang.
- Git: commit per task di `main`, tanpa trailer Co-Authored-By, stage dengan path eksplisit, tanpa push.

## Review Focus

1. **Saran nama barang (`<datalist>`)**: `Input` tidak meneruskan atribut `list`. Pagar: prop `list` diteruskan di `input.tsx` lokal (Task 1) agar saran per subkategori tetap muncul.
2. **Dua modal bersama dipakai halaman lain** (Mutasi, Permohonan, Lapor): props tidak boleh berubah, dan perilaku (alasan wajib, kunci saat memproses, `onSuccess: onClose`) harus sama. Pagar: Task 1; butir gerbang memeriksa satu halaman lain yang memakainya.
3. **Edit draft**: kirim memakai `_method: 'put'` lewat POST; dokumen lama bisa ditandai hapus/batal hapus; `hapus_dokumen` terkirim. Pagar: `transform` tidak diubah (Task 3).
4. **Ulangan barang**: tambah/hapus barang (tombol Hapus hanya bila > 1), galat per barang (`items.N.field`), nilai awal `jumlah_unit = 1` dan `kondisi_awal = baik`. Pagar: Task 3.
5. **Dua jalur kirim**: Simpan Draft dan Ajukan Penerimaan; keduanya terkunci saat memproses dan tidak boleh mengirim ganda. Pagar: `isLoading`/`isDisabled` (Task 3).
6. **Filter dan pagination server**: pindah halaman mempertahankan filter; reset menghapus status/tanggal; pencarian lewat Enter atau tombol Cari. Pagar: `goTo` tidak diubah (Task 2).
7. **Tabel 8 kolom bisa meluber**: Pagar: `Table size="sm"` dan Nama Aset membungkus (Task 2); butir gerbang pada lebar laptop.
8. **Tindakan di Show hanya sesuai izin** (`can.*`): kombinasi tombol berbeda per status; tidak boleh ada tombol yang tampil tanpa izin. Pagar: kondisi dipertahankan persis (Task 4).
9. **Tolak wajib alasan**; Batalkan wajib alasan; Alihkan wajib user dan alasan. Pagar: tombol konfirmasi nonaktif sampai terisi (Task 1, 4).
10. **Alur persetujuan (stepper) dan riwayat** tetap menampilkan status tiap langkah dengan benar, termasuk ditolak/dibatalkan. Pagar: `stepState` tidak diubah (Task 4).

---

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `resources/js/Components/ui/base/input/input.tsx` | Meneruskan prop `list` (saran `<datalist>`) |
| `resources/js/lib/penerimaanStatus.ts` | Peta warna badge status menggantikan peta kelas |
| `resources/js/Components/CancelRequestModal.tsx`, `ReassignApproverModal.tsx` | Modal bersama berbasis `ModalOverlay` |
| `resources/js/Pages/Penerimaan/Index.tsx` | Daftar |
| `resources/js/Pages/Penerimaan/PenerimaanForm.tsx` | Form Tambah/Edit |
| `resources/js/Pages/Penerimaan/Show.tsx` | Detail dan tindakan persetujuan |

---

### Task 1: Fondasi (`Input list`, warna status, dua modal bersama)

**Files:**
- Modify: `resources/js/Components/ui/base/input/input.tsx`, `resources/js/lib/penerimaanStatus.ts`, `resources/js/Components/CancelRequestModal.tsx`, `resources/js/Components/ReassignApproverModal.tsx`

**Interfaces:**
- Produces: `Input` menerima `list?: string`; `PENERIMAAN_STATUS_COLOR: Record<PenerimaanStatusKey, 'gray' | 'blue' | 'warning' | 'success' | 'error'>` (peta `PENERIMAAN_STATUS_STYLE` dihapus; hanya `Index` dan `Show` Penerimaan yang memakainya); `CancelRequestModal` dan `ReassignApproverModal` dengan props yang sama seperti sekarang.

- [ ] **Step 1: `Input` meneruskan `list`**

Di `input.tsx`: tambahkan `list?: string;` pada `InputProps` (di blok antarmuka setelah `hideRequiredIndicator`), destructure `list,` pada `Input` (bersama `type = "text"`), dan sertakan `list,` pada objek yang diteruskan ke `<InputBase {...{ ... type, list }} />`. `InputBase` sudah meneruskan sisa props ke `AriaInput`, sehingga atribut `list` sampai ke elemen `<input>`.

- [ ] **Step 2: Peta warna status**

Di `lib/penerimaanStatus.ts` **tambahkan** (biarkan `PENERIMAAN_STATUS_STYLE` sampai Task 4 agar setiap commit tetap dapat dibangun):
```ts
export const PENERIMAAN_STATUS_COLOR: Record<PenerimaanStatusKey, 'gray' | 'blue' | 'warning' | 'success' | 'error'> = {
    draft: 'gray',
    diajukan: 'blue',
    diverifikasi: 'warning',
    disetujui: 'success',
    ditolak: 'error',
    dibatalkan: 'gray',
};
```
(`PENERIMAAN_STATUS_LABEL` dan `penerimaanStatus()` tidak berubah.)

- [ ] **Step 3: `CancelRequestModal.tsx`**

```tsx
import { Dialog, Modal, ModalOverlay } from '@/Components/ui/application/modals/modal';
import { Button } from '@/Components/ui/base/buttons/button';
import { TextArea } from '@/Components/ui/base/textarea/textarea';
import { router } from '@inertiajs/react';
import { useState } from 'react';

interface CancelRequestModalProps {
    approvalRequestId: number;
    onClose: () => void;
    description: string;
}

export default function CancelRequestModal({ approvalRequestId, onClose, description }: CancelRequestModalProps) {
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const cancel = () => {
        if (submitting || !note.trim()) return;
        setSubmitting(true);
        router.post(
            route('approval-requests.cancel', approvalRequestId),
            { note: note.trim() },
            { preserveScroll: true, onSuccess: onClose, onFinish: () => setSubmitting(false) },
        );
    };

    return (
        <ModalOverlay
            isOpen
            isDismissable={!submitting}
            isKeyboardDismissDisabled={submitting}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <Modal className="sm:max-w-md">
                <Dialog aria-labelledby="cancel-request-title">
                    <div className="w-full p-6">
                        <h3 id="cancel-request-title" className="mb-2 text-base font-bold text-slate-900">
                            Batalkan Pengajuan
                        </h3>
                        <p className="mb-4 text-xs leading-relaxed text-slate-600">{description}</p>
                        <TextArea label="Alasan Pembatalan" isRequired rows={4} maxLength={1000} value={note} onChange={setNote} />
                        <div className="mt-6 flex items-center justify-end gap-3">
                            <Button color="secondary" size="md" isDisabled={submitting} onPress={onClose}>
                                Kembali
                            </Button>
                            <Button color="primary-destructive" size="md" isLoading={submitting} isDisabled={!note.trim()} onPress={cancel}>
                                Ya, Batalkan
                            </Button>
                        </div>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
}
```

- [ ] **Step 4: `ReassignApproverModal.tsx`**

```tsx
import { Dialog, Modal, ModalOverlay } from '@/Components/ui/application/modals/modal';
import { Button } from '@/Components/ui/base/buttons/button';
import { Select } from '@/Components/ui/base/select/select';
import { TextArea } from '@/Components/ui/base/textarea/textarea';
import { ReassignCandidate } from '@/types';
import { router } from '@inertiajs/react';
import { useState } from 'react';

interface ReassignApproverModalProps {
    approvalRequestId: number;
    candidates: ReassignCandidate[];
    stepOrder: number;
    stepLabel?: string;
    onClose: () => void;
}

export default function ReassignApproverModal({ approvalRequestId, candidates, stepOrder, stepLabel, onClose }: ReassignApproverModalProps) {
    const [userId, setUserId] = useState('');
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const submit = () => {
        if (submitting || !userId || !note.trim()) return;
        setSubmitting(true);
        router.post(
            route('approval-requests.reassign', approvalRequestId),
            { user_id: Number(userId), note: note.trim(), step_order: stepOrder },
            { preserveScroll: true, onSuccess: onClose, onFinish: () => setSubmitting(false) },
        );
    };

    return (
        <ModalOverlay
            isOpen
            isDismissable={!submitting}
            isKeyboardDismissDisabled={submitting}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <Modal className="sm:max-w-md">
                <Dialog aria-labelledby="reassign-approver-title">
                    <div className="w-full space-y-4 p-6">
                        <div>
                            <h3 id="reassign-approver-title" className="mb-2 text-base font-bold text-slate-900">
                                Alihkan Approver
                            </h3>
                            <p className="text-xs leading-relaxed text-slate-600">
                                Langkah {stepOrder}
                                {stepLabel ? ` (${stepLabel})` : ''} yang sedang menunggu akan dialihkan ke satu user tertentu. Perubahan ini hanya berlaku untuk
                                pengajuan ini dan tercatat di riwayat.
                            </p>
                        </div>
                        <Select
                            label="Alihkan ke"
                            isRequired
                            placeholder="Pilih user..."
                            items={candidates.map((c) => ({ id: String(c.id), label: `${c.name} (${c.role ?? '-'}${c.unit ? `, ${c.unit}` : ''})` }))}
                            selectedKey={userId || null}
                            onSelectionChange={(key) => setUserId(String(key))}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                        <TextArea label="Alasan" isRequired rows={3} maxLength={1000} value={note} onChange={setNote} />
                        <div className="flex items-center justify-end gap-3 pt-2">
                            <Button color="secondary" size="md" isDisabled={submitting} onPress={onClose}>
                                Batal
                            </Button>
                            <Button color="primary" size="md" isLoading={submitting} isDisabled={!userId || !note.trim()} onPress={submit}>
                                Alihkan
                            </Button>
                        </div>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
}
```

- [ ] **Step 5: Verifikasi**

```bash
npx tsc --noEmit
```
Expected: bersih (props kedua modal tidak berubah, sehingga `AssetMutations/Show`, `AssetReports/Show`, `AssetRequests/Show` tetap valid).

- [ ] **Step 6: Commit**

```bash
npm run build 2>&1 | tail -5
git add resources/js/Components/ui/base/input/input.tsx resources/js/lib/penerimaanStatus.ts resources/js/Components/CancelRequestModal.tsx resources/js/Components/ReassignApproverModal.tsx
git commit -m "feat(ui): add the status color map and move the shared approval modals to Untitled UI"
```
---

### Task 2: `Index`

**Files:**
- Modify: `resources/js/Pages/Penerimaan/Index.tsx` (ganti seluruh isi)

**Interfaces:**
- Consumes: `PageHeader`, `Table`, `PaginationPageDefault`, `Badge`, `Button`, `Input`, `Select`, `Tooltip`, `rupiah` (`@/lib/format`), `PENERIMAAN_STATUS_COLOR`; ikon `Eye`, `Plus`, `SearchLg`, `XClose`.

- [ ] **Step 1: Tulis ulang `Index.tsx`**

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
import { rupiah } from '@/lib/format';
import { PENERIMAAN_STATUS_COLOR, PENERIMAAN_STATUS_LABEL, PenerimaanStatusKey, penerimaanStatus } from '@/lib/penerimaanStatus';
import { BeritaAcaraPenerimaan, Paginated, PageProps } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Eye, Plus, SearchLg, XClose } from '@untitledui/icons';
import { FormEvent, useState } from 'react';

interface IndexProps extends PageProps {
    items: Paginated<BeritaAcaraPenerimaan>;
    filters: { search?: string; status?: string; dari?: string; sampai?: string; urut?: string };
    sortOptions: { value: string; label: string }[];
    can: { create: boolean };
}

const ALL = '__all';

const STATUS_ITEMS = [
    { id: ALL, label: 'Semua status' },
    ...(Object.keys(PENERIMAAN_STATUS_LABEL) as PenerimaanStatusKey[]).map((key) => ({ id: key, label: PENERIMAAN_STATUS_LABEL[key] })),
];

export default function Index({ items, filters, sortOptions, can }: IndexProps) {
    const [search, setSearch] = useState(filters.search ?? '');

    const goTo = (changes: Record<string, string | number | undefined>) => {
        const params = { ...filters, search: search || undefined, ...changes };
        const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
        router.get(route('penerimaan-aset.index'), clean, { preserveState: true, preserveScroll: true, replace: true });
    };

    const submitSearch = (e: FormEvent) => {
        e.preventDefault();
        goTo({ page: undefined });
    };

    const hasFilter = Boolean(filters.status || filters.dari || filters.sampai);

    return (
        <AuthenticatedLayout>
            <Head title="Penerimaan Aset" />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Penerimaan Aset' }]}
                    title="Penerimaan Aset Baru"
                    actions={
                        can.create && (
                            <Button color="primary" size="md" iconLeading={Plus} href={route('penerimaan-aset.create')}>
                                Ajukan Penerimaan
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
                            onSelectionChange={(key) => goTo({ status: key === ALL ? undefined : String(key), page: undefined })}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                        <Input
                            label="Dari tanggal"
                            type="date"
                            size="md"
                            value={filters.dari ?? ''}
                            onChange={(v) => goTo({ dari: v || undefined, page: undefined })}
                        />
                        <Input
                            label="Sampai tanggal"
                            type="date"
                            size="md"
                            value={filters.sampai ?? ''}
                            onChange={(v) => goTo({ sampai: v || undefined, page: undefined })}
                        />
                        <Select
                            label="Urutkan"
                            size="md"
                            items={sortOptions.map((o) => ({ id: o.value, label: o.label }))}
                            selectedKey={filters.urut ?? 'terbaru'}
                            onSelectionChange={(key) => goTo({ urut: key === 'terbaru' ? undefined : String(key), page: undefined })}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                    </div>
                    {hasFilter && (
                        <div className="mt-3">
                            <Button
                                color="link-color"
                                size="md"
                                onPress={() => goTo({ status: undefined, dari: undefined, sampai: undefined, page: undefined })}
                            >
                                Reset filter
                            </Button>
                        </div>
                    )}
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    <form onSubmit={submitSearch} className="flex max-w-lg items-center gap-2 border-b border-slate-200 p-4">
                        <div className="flex-1">
                            <Input
                                aria-label="Cari"
                                size="md"
                                icon={SearchLg}
                                placeholder="Cari no. berita acara atau nama aset..."
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
                                    goTo({ search: undefined, page: undefined });
                                }}
                            />
                        )}
                        <Button type="submit" color="secondary" size="md">
                            Cari
                        </Button>
                    </form>

                    <Table aria-label="Daftar penerimaan aset" size="sm">
                        <Table.Header>
                            <Table.Head id="no" label="No. Berita Acara" isRowHeader />
                            <Table.Head id="nama" label="Nama Aset" />
                            <Table.Head id="kategori" label="Kategori" />
                            <Table.Head id="nilai" label="Nilai" />
                            <Table.Head id="pengaju" label="Pengaju" />
                            <Table.Head id="tanggal" label="Tanggal" />
                            <Table.Head id="status" label="Status" />
                            <Table.Head id="aksi" label="Aksi" />
                        </Table.Header>
                        <Table.Body
                            items={items.data}
                            renderEmptyState={() => (
                                <p className="py-14 text-center text-sm text-slate-400">
                                    {hasFilter || filters.search ? 'Tidak ada penerimaan yang cocok dengan filter.' : 'Belum ada pengajuan penerimaan aset.'}
                                </p>
                            )}
                        >
                            {(ba) => {
                                const status = penerimaanStatus(ba);
                                const extra = (ba.items?.length ?? 0) - 1;
                                const nilai = (ba.items ?? []).reduce((sum, i) => sum + Number(i.nilai_per_unit) * i.jumlah_unit, 0);

                                return (
                                    <Table.Row id={ba.id}>
                                        <Table.Cell className="text-slate-800">{ba.no_berita_acara}</Table.Cell>
                                        <Table.Cell className="font-semibold text-slate-900">
                                            {ba.items?.[0]?.nama_aset}
                                            {extra > 0 && <span className="font-normal text-slate-400"> +{extra} lainnya</span>}
                                        </Table.Cell>
                                        <Table.Cell className="text-slate-800">{ba.items?.[0]?.category?.name ?? '—'}</Table.Cell>
                                        <Table.Cell className="whitespace-nowrap text-right tabular-nums text-slate-800">{rupiah(nilai)}</Table.Cell>
                                        <Table.Cell className="text-slate-800">{ba.creator?.name}</Table.Cell>
                                        <Table.Cell className="whitespace-nowrap text-slate-800">
                                            {new Date(ba.tanggal_penerimaan).toLocaleDateString('id-ID')}
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Badge type="color" size="sm" color={PENERIMAAN_STATUS_COLOR[status]} className="rounded-sm">
                                                {PENERIMAAN_STATUS_LABEL[status]}
                                            </Badge>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Tooltip title="Lihat detail">
                                                <Button
                                                    color="secondary-brand"
                                                    size="sm"
                                                    iconLeading={Eye}
                                                    aria-label={`Lihat penerimaan ${ba.no_berita_acara}`}
                                                    href={route('penerimaan-aset.show', ba.id)}
                                                />
                                            </Tooltip>
                                        </Table.Cell>
                                    </Table.Row>
                                );
                            }}
                        </Table.Body>
                    </Table>

                    <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4">
                        <p className="text-xs text-slate-500">
                            Menampilkan{' '}
                            <span className="font-semibold tabular-nums text-slate-800">
                                {items.from ?? 0}-{items.to ?? 0}
                            </span>{' '}
                            dari <span className="font-semibold tabular-nums text-slate-800">{items.total}</span> penerimaan
                        </p>

                        {items.last_page > 1 && (
                            <PaginationPageDefault
                                className="border-t-0 pt-0 md:pt-0"
                                page={items.current_page}
                                total={items.last_page}
                                onPageChange={(page) =>
                                    router.get(route('penerimaan-aset.index'), { ...filters, page }, { preserveState: true, preserveScroll: true })
                                }
                            />
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
```
`actions={can.create && (...)}` menghasilkan `false` saat tanpa izin; `PageHeader` hanya merender bila truthy. Prop yang berbeda dari yang diasumsikan disesuaikan dan dicatat sebagai `Ruling`.

- [ ] **Step 2: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
php artisan test --compact --filter='Penerimaan'
git add resources/js/Pages/Penerimaan/Index.tsx
git commit -m "feat(ui): migrate the receipt list page to Untitled UI components"
```
Expected: bersih; test hijau.

---

### Task 3: `PenerimaanForm`

**Files:**
- Modify: `resources/js/Pages/Penerimaan/PenerimaanForm.tsx` (ganti seluruh isi)

**Interfaces:**
- Consumes: `PageHeader`, `Input` (dengan `list`, Task 1), `Select`, `TextArea`, `Button`, `rupiah`; ikon `Plus`, `Trash01`, `UploadCloud02`. `PenerimaanFormProps` dan ekspor default tidak berubah.

- [ ] **Step 1: Tulis ulang `PenerimaanForm.tsx`**

```tsx
import PageHeader from '@/Components/PageHeader';
import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import { Select } from '@/Components/ui/base/select/select';
import { TextArea } from '@/Components/ui/base/textarea/textarea';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { rupiah } from '@/lib/format';
import { AssetCategory, BeritaAcaraPenerimaan, PageProps } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { Plus, Trash01, UploadCloud02 } from '@untitledui/icons';
import { useRef } from 'react';

export interface PenerimaanFormProps extends PageProps {
    categories: AssetCategory[];
    kondisiOptions: { value: string; label: string }[];
    beritaAcara?: BeritaAcaraPenerimaan;
    existingAssetNames?: Record<number, string[]>;
}

interface ItemForm {
    nama_aset: string;
    merk_type: string;
    category_id: string;
    jumlah_unit: string;
    nilai_per_unit: string;
    kondisi_awal: string;
}

const EMPTY_ITEM: ItemForm = {
    nama_aset: '',
    merk_type: '',
    category_id: '',
    jumlah_unit: '1',
    nilai_per_unit: '',
    kondisi_awal: 'baik',
};

const rupiahHint = (value: string) => (value === '' || Number.isNaN(Number(value)) ? undefined : rupiah(Number(value)));

export default function PenerimaanForm({ categories, kondisiOptions, beritaAcara, existingAssetNames = {} }: PenerimaanFormProps) {
    const isEdit = beritaAcara !== undefined;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const form = useForm({
        no_berita_acara: beritaAcara?.no_berita_acara ?? '',
        tanggal_penerimaan: beritaAcara?.tanggal_penerimaan?.slice(0, 10) ?? '',
        sumber_perolehan: beritaAcara?.sumber_perolehan ?? '',
        no_kontrak_spk: beritaAcara?.no_kontrak_spk ?? '',
        vendor: beritaAcara?.vendor ?? '',
        catatan: beritaAcara?.catatan ?? '',
        status: 'draft' as 'draft' | 'submitted',
        items: (beritaAcara?.items?.map((i) => ({
            nama_aset: i.nama_aset,
            merk_type: i.merk_type ?? '',
            category_id: String(i.category_id),
            jumlah_unit: String(i.jumlah_unit),
            nilai_per_unit: String(Math.round(Number(i.nilai_per_unit))),
            kondisi_awal: i.kondisi_awal,
        })) ?? [EMPTY_ITEM]) as ItemForm[],
        dokumen: [] as File[],
        hapus_dokumen: [] as number[],
    });

    const errors = form.errors as Record<string, string>;
    const errorCount = Object.keys(errors).length;

    const toggleHapusDokumen = (id: number) =>
        form.setData('hapus_dokumen', form.data.hapus_dokumen.includes(id) ? form.data.hapus_dokumen.filter((d) => d !== id) : [...form.data.hapus_dokumen, id]);

    const updateItem = (index: number, field: keyof ItemForm, value: string) => {
        const items = [...form.data.items];
        items[index] = { ...items[index], [field]: value };
        form.setData('items', items);
    };

    const addItem = () => form.setData('items', [...form.data.items, EMPTY_ITEM]);

    const removeItem = (index: number) => form.setData('items', form.data.items.filter((_, i) => i !== index));

    const itemError = (index: number, field: keyof ItemForm): string | undefined => errors[`items.${index}.${field}`];

    const send = (status: 'draft' | 'submitted') => {
        // PHP does not parse multipart bodies on PUT, so edits are POSTed with method spoofing.
        form.transform((data) => (isEdit ? { ...data, status, _method: 'put' } : { ...data, status }));
        form.post(isEdit ? route('penerimaan-aset.update', beritaAcara.id) : route('penerimaan-aset.store'), { forceFormData: true });
    };

    return (
        <AuthenticatedLayout>
            <Head title={isEdit ? 'Edit Draft Penerimaan Aset' : 'Formulir Penerimaan Aset Baru'} />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Penerimaan Aset', href: route('penerimaan-aset.index') }, { label: isEdit ? 'Edit Draft' : 'Ajukan Penerimaan' }]}
                    title={isEdit ? `Edit Draft #${beritaAcara.no_berita_acara}` : 'Formulir Penerimaan Aset Baru'}
                />

                <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
                    <div className="space-y-8 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                        <section className="space-y-4">
                            <h2 className="text-base font-semibold text-slate-900">1. Informasi Berita Acara</h2>
                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                <Input
                                    label="No. Berita Acara"
                                    isRequired
                                    placeholder="BA/xxx/xxx/2025"
                                    value={form.data.no_berita_acara}
                                    onChange={(v) => form.setData('no_berita_acara', v)}
                                    isInvalid={Boolean(errors.no_berita_acara)}
                                    hint={errors.no_berita_acara}
                                />
                                <Input
                                    label="Tanggal Penerimaan"
                                    type="date"
                                    isRequired
                                    value={form.data.tanggal_penerimaan}
                                    onChange={(v) => form.setData('tanggal_penerimaan', v)}
                                    isInvalid={Boolean(errors.tanggal_penerimaan)}
                                    hint={errors.tanggal_penerimaan}
                                />
                                <Input
                                    label="Sumber Perolehan"
                                    placeholder="mis. APBD, Hibah"
                                    value={form.data.sumber_perolehan}
                                    onChange={(v) => form.setData('sumber_perolehan', v)}
                                    isInvalid={Boolean(errors.sumber_perolehan)}
                                    hint={errors.sumber_perolehan}
                                />
                                <Input
                                    label="No. Kontrak/SPK"
                                    isRequired
                                    value={form.data.no_kontrak_spk}
                                    onChange={(v) => form.setData('no_kontrak_spk', v)}
                                    isInvalid={Boolean(errors.no_kontrak_spk)}
                                    hint={errors.no_kontrak_spk}
                                />
                            </div>
                            <Input
                                label="Vendor/Penyedia"
                                value={form.data.vendor}
                                onChange={(v) => form.setData('vendor', v)}
                                isInvalid={Boolean(errors.vendor)}
                                hint={errors.vendor}
                            />
                        </section>

                        <hr className="border-slate-200" />

                        <section className="space-y-4">
                            <h2 className="text-base font-semibold text-slate-900">2. Data Aset yang Diterima</h2>
                            {form.data.items.map((item, index) => (
                                <div key={index} className="space-y-4 rounded-lg bg-slate-50 p-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-bold text-blue-700">Aset #{index + 1}</p>
                                        {form.data.items.length > 1 && (
                                            <Button
                                                color="secondary-destructive"
                                                size="sm"
                                                iconLeading={Trash01}
                                                aria-label={`Hapus aset ${index + 1}`}
                                                onPress={() => removeItem(index)}
                                            >
                                                Hapus
                                            </Button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <Input
                                            label="Nama Barang"
                                            isRequired
                                            list={item.category_id ? `asset-suggestions-${item.category_id}` : undefined}
                                            placeholder="Contoh: Lap Top, P.C Unit, Printer"
                                            value={item.nama_aset}
                                            onChange={(v) => updateItem(index, 'nama_aset', v)}
                                            isInvalid={Boolean(itemError(index, 'nama_aset'))}
                                            hint={itemError(index, 'nama_aset') ?? 'Ketik nama baru atau pilih saran dari aset yang sudah ada agar terstandar.'}
                                        />
                                        <Input
                                            label="Merk/Tipe"
                                            placeholder="Contoh: Asus Vivobook 14, Epson L3210"
                                            value={item.merk_type}
                                            onChange={(v) => updateItem(index, 'merk_type', v)}
                                            isInvalid={Boolean(itemError(index, 'merk_type'))}
                                            hint={itemError(index, 'merk_type')}
                                        />
                                        <Select
                                            label="Subkategori"
                                            isRequired
                                            placeholder="Pilih subkategori..."
                                            items={categories.map((c) => ({ id: String(c.id), label: c.name }))}
                                            selectedKey={item.category_id || null}
                                            onSelectionChange={(key) => updateItem(index, 'category_id', String(key))}
                                            isInvalid={Boolean(itemError(index, 'category_id'))}
                                            hint={itemError(index, 'category_id')}
                                        >
                                            {(opt) => <Select.Item id={opt.id} label={opt.label} />}
                                        </Select>
                                        <Select
                                            label="Kondisi Awal"
                                            isRequired
                                            items={kondisiOptions.map((o) => ({ id: o.value, label: o.label }))}
                                            selectedKey={item.kondisi_awal}
                                            onSelectionChange={(key) => updateItem(index, 'kondisi_awal', String(key))}
                                            isInvalid={Boolean(itemError(index, 'kondisi_awal'))}
                                            hint={itemError(index, 'kondisi_awal')}
                                        >
                                            {(opt) => <Select.Item id={opt.id} label={opt.label} />}
                                        </Select>
                                        <Input
                                            label="Jumlah Unit"
                                            type="number"
                                            inputMode="numeric"
                                            isRequired
                                            inputClassName="tabular-nums"
                                            value={item.jumlah_unit}
                                            onChange={(v) => updateItem(index, 'jumlah_unit', v)}
                                            isInvalid={Boolean(itemError(index, 'jumlah_unit'))}
                                            hint={itemError(index, 'jumlah_unit')}
                                        />
                                        <Input
                                            label="Nilai per Unit (Rp)"
                                            type="number"
                                            inputMode="numeric"
                                            isRequired
                                            inputClassName="tabular-nums"
                                            value={item.nilai_per_unit}
                                            onChange={(v) => updateItem(index, 'nilai_per_unit', v)}
                                            isInvalid={Boolean(itemError(index, 'nilai_per_unit'))}
                                            hint={itemError(index, 'nilai_per_unit') ?? rupiahHint(item.nilai_per_unit)}
                                        />
                                    </div>
                                </div>
                            ))}
                            <Button color="secondary-brand" size="md" iconLeading={Plus} onPress={addItem}>
                                Tambah Barang Lain
                            </Button>

                            {Object.entries(existingAssetNames).map(([catId, names]) => (
                                <datalist key={catId} id={`asset-suggestions-${catId}`}>
                                    {names.map((name) => (
                                        <option key={name} value={name} />
                                    ))}
                                </datalist>
                            ))}
                        </section>

                        <hr className="border-slate-200" />

                        <section className="space-y-4">
                            <h2 className="text-base font-semibold text-slate-900">3. Dokumen Pendukung</h2>
                            <input
                                type="file"
                                ref={fileInputRef}
                                multiple
                                accept=".pdf,.jpg,.jpeg,.png"
                                className="hidden"
                                onChange={(e) => form.setData('dokumen', Array.from(e.target.files ?? []))}
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 p-6 text-center outline-hidden hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
                            >
                                <UploadCloud02 className="size-6 text-slate-400" aria-hidden="true" />
                                <span className="text-sm font-medium text-slate-900">Klik untuk unggah dokumen Berita Acara (PDF/JPG)</span>
                                <span className="text-xs text-slate-500">Maks. 5MB per file</span>
                            </button>
                            {isEdit && (beritaAcara.photos?.length ?? 0) > 0 && (
                                <ul className="space-y-1.5 text-sm">
                                    {beritaAcara.photos?.map((photo) => (
                                        <li key={photo.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
                                            <a
                                                href={`/storage/${photo.path}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className={`truncate text-blue-700 hover:underline ${form.data.hapus_dokumen.includes(photo.id) ? 'line-through opacity-50' : ''}`}
                                            >
                                                {photo.path.split('/').pop()}
                                            </a>
                                            <Button color="link-gray" size="sm" onPress={() => toggleHapusDokumen(photo.id)}>
                                                {form.data.hapus_dokumen.includes(photo.id) ? 'Batal hapus' : 'Hapus'}
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {form.data.dokumen.length > 0 && (
                                <ul className="space-y-1 text-xs text-slate-600">
                                    {form.data.dokumen.map((file, i) => (
                                        <li key={i}>{file.name}</li>
                                    ))}
                                </ul>
                            )}

                            <TextArea
                                label="Catatan / Keterangan"
                                rows={3}
                                value={form.data.catatan}
                                onChange={(v) => form.setData('catatan', v)}
                                isInvalid={Boolean(errors.catatan)}
                                hint={errors.catatan}
                            />
                        </section>
                    </div>

                    {/* Bilah aksi lengket */}
                    <div className="sticky bottom-0 z-20 -mx-6 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur-xs lg:-mx-8 lg:px-8">
                        <div className="flex items-center justify-between gap-3">
                            <p role="alert" className="text-sm font-medium text-red-600">
                                {errorCount > 0 && `${errorCount} isian perlu diperbaiki`}
                            </p>
                            <div className="flex items-center gap-3">
                                <Button color="secondary" size="md" isDisabled={form.processing} onPress={() => send('draft')}>
                                    Simpan Draft
                                </Button>
                                <Button color="primary" size="md" isLoading={form.processing} onPress={() => send('submitted')}>
                                    Ajukan Penerimaan
                                </Button>
                            </div>
                        </div>
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
php artisan test --compact --filter='Penerimaan'
git add resources/js/Pages/Penerimaan/PenerimaanForm.tsx
git commit -m "feat(ui): migrate the receipt form to Untitled UI components"
```
Expected: bersih; test hijau.

---

### Task 4: `Show` dan gerbang

**Files:**
- Modify: `resources/js/Pages/Penerimaan/Show.tsx` (ganti seluruh isi), `resources/js/lib/penerimaanStatus.ts` (hapus `PENERIMAAN_STATUS_STYLE`)

**Interfaces:**
- Consumes: `PageHeader` (dengan `badges`), `ConfirmDialog`, `CancelRequestModal`, `ReassignApproverModal` (Task 1), `Badge`, `Button`, `TextArea`, `ModalOverlay`/`Modal`/`Dialog`, `rupiah`, `PENERIMAAN_STATUS_COLOR`; ikon `Check`.

- [ ] **Step 1: Tulis ulang `Show.tsx`**

```tsx
import CancelRequestModal from '@/Components/CancelRequestModal';
import ConfirmDialog from '@/Components/ConfirmDialog';
import PageHeader from '@/Components/PageHeader';
import ReassignApproverModal from '@/Components/ReassignApproverModal';
import { Dialog, Modal, ModalOverlay } from '@/Components/ui/application/modals/modal';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { TextArea } from '@/Components/ui/base/textarea/textarea';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { rupiah } from '@/lib/format';
import { PENERIMAAN_STATUS_COLOR, PENERIMAAN_STATUS_LABEL, penerimaanStatus } from '@/lib/penerimaanStatus';
import { BeritaAcaraPenerimaan, PageProps, ReassignCandidate } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Check } from '@untitledui/icons';
import { useState } from 'react';

interface ShowProps extends PageProps {
    beritaAcara: BeritaAcaraPenerimaan;
    can: { act: boolean; cancel: boolean; edit: boolean; delete: boolean; reassign: boolean };
    reassignCandidates: ReassignCandidate[];
}

type StepState = 'done' | 'current' | 'upcoming' | 'rejected' | 'cancelled';

const STEP_CIRCLE: Record<StepState, string> = {
    done: 'bg-emerald-100',
    current: 'bg-amber-100',
    upcoming: 'bg-slate-100',
    rejected: 'bg-red-100',
    cancelled: 'bg-slate-200',
};

const STEP_TEXT: Record<StepState, string> = {
    done: 'Selesai',
    current: 'Menunggu',
    upcoming: 'Belum dimulai',
    rejected: 'Ditolak',
    cancelled: 'Dibatalkan',
};

const ACTION_LABEL = { approve: 'Disetujui', reject: 'Ditolak', cancel: 'Dibatalkan', reassign: 'Dialihkan' } as const;
const ACTION_DOT = { approve: 'bg-emerald-600', reject: 'bg-red-600', cancel: 'bg-slate-500', reassign: 'bg-blue-600' } as const;

export default function Show({ beritaAcara, can, reassignCandidates }: ShowProps) {
    const [showReject, setShowReject] = useState(false);
    const [showCancel, setShowCancel] = useState(false);
    const [showReassign, setShowReassign] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const req = beritaAcara.approval_request;
    const steps = req?.steps ?? [];
    const total = (beritaAcara.items ?? []).reduce((sum, i) => sum + Number(i.nilai_per_unit) * i.jumlah_unit, 0);
    const status = penerimaanStatus(beritaAcara);

    const approve = () => {
        if (!req || submitting) return;
        setSubmitting(true);
        router.post(route('approval-requests.approve', req.id), {}, { preserveScroll: true, onFinish: () => setSubmitting(false) });
    };

    const reject = () => {
        if (!req || submitting) return;
        setSubmitting(true);
        router.post(
            route('approval-requests.reject', req.id),
            { note },
            { preserveScroll: true, onSuccess: () => setShowReject(false), onFinish: () => setSubmitting(false) },
        );
    };

    const deleteDraft = () => {
        setSubmitting(true);
        router.delete(route('penerimaan-aset.destroy', beritaAcara.id), {
            onFinish: () => {
                setSubmitting(false);
                setConfirmingDelete(false);
            },
        });
    };

    const stepState = (order: number): StepState => {
        if (!req) return 'upcoming';
        if (req.status === 'approved') return 'done';
        if (order < req.current_step) return 'done';
        if (order === req.current_step) {
            if (req.status === 'rejected') return 'rejected';
            if (req.status === 'cancelled') return 'cancelled';
            return 'current';
        }
        return 'upcoming';
    };

    return (
        <AuthenticatedLayout>
            <Head title={`Penerimaan Aset #${beritaAcara.no_berita_acara}`} />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Penerimaan Aset', href: route('penerimaan-aset.index') }, { label: 'Detail' }]}
                    title={`Penerimaan Aset #${beritaAcara.no_berita_acara}`}
                    badges={
                        <Badge type="color" size="sm" color={PENERIMAAN_STATUS_COLOR[status]} className="rounded-sm">
                            {PENERIMAAN_STATUS_LABEL[status]}
                        </Badge>
                    }
                    actions={
                        <>
                            {can.delete && (
                                <Button color="secondary-destructive" size="md" onPress={() => setConfirmingDelete(true)}>
                                    Hapus Draft
                                </Button>
                            )}
                            {can.edit && (
                                <Button color="secondary-green" size="md" href={route('penerimaan-aset.edit', beritaAcara.id)}>
                                    Edit &amp; Ajukan
                                </Button>
                            )}
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

                {!req && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                        Draft ini belum diajukan. Approver baru dapat melihatnya setelah Anda mengajukannya.
                    </div>
                )}

                {req && (
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                        <p className="mb-4 text-sm font-semibold text-slate-900">Status Alur Persetujuan</p>
                        <ol className="flex items-start overflow-x-auto">
                            {steps.map((step, idx) => {
                                const state = stepState(step.step_order);
                                return (
                                    <li key={step.step_order} className="flex min-w-32 flex-1 flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`flex size-6 items-center justify-center rounded-full ${STEP_CIRCLE[state]}`}>
                                                {state === 'done' && <Check className="size-3.5 text-emerald-700" aria-hidden="true" />}
                                            </div>
                                            {idx < steps.length - 1 && <div className="h-px flex-1 bg-slate-200" />}
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-slate-900">
                                                Step {step.step_order}: {step.label}
                                            </p>
                                            <p className="text-[11px] text-slate-500">{STEP_TEXT[state]}</p>
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                        <p className="mb-3 text-base font-semibold text-slate-900">Detail Penerimaan</p>
                        <dl className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 text-sm">
                            {(
                                [
                                    ['No. Berita Acara', beritaAcara.no_berita_acara],
                                    ['Tanggal Pengajuan', new Date(beritaAcara.tanggal_penerimaan).toLocaleDateString('id-ID')],
                                    ['Sumber Perolehan', beritaAcara.sumber_perolehan ?? '—'],
                                    ['No. Kontrak/SPK', beritaAcara.no_kontrak_spk],
                                    ['Vendor/Penyedia', beritaAcara.vendor ?? '—'],
                                    ['Total Nilai', rupiah(total)],
                                ] as [string, string][]
                            ).map(([label, value], i) => (
                                <div key={label} className={`flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:gap-4 ${i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                                    <dt className="shrink-0 font-medium text-slate-500 sm:w-40">{label}</dt>
                                    <dd className="text-slate-900">{value}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                        <p className="mb-3 text-base font-semibold text-slate-900">Rincian Barang Diterima</p>
                        <div className="space-y-3">
                            {beritaAcara.items?.map((item) => (
                                <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-900">{item.nama_aset}</p>
                                            <p className="text-xs text-slate-500">{item.merk_type}</p>
                                        </div>
                                        <div className="shrink-0 text-right text-sm">
                                            <p className="font-semibold tabular-nums text-slate-900">{rupiah(Number(item.nilai_per_unit))} / unit</p>
                                            <p className="text-xs tabular-nums text-slate-500">{item.jumlah_unit} unit</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {req && (
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                        <p className="mb-4 text-base font-semibold text-slate-900">Riwayat Aktivitas</p>
                        <ol className="space-y-4 border-l border-slate-200 pl-5">
                            <li className="relative">
                                <span className="absolute left-[-25px] top-1 size-2.5 rounded-full bg-blue-600" />
                                <p className="text-sm font-semibold text-slate-900">Pengajuan Dibuat</p>
                                <p className="text-xs text-slate-500">oleh {beritaAcara.creator?.name}</p>
                            </li>
                            {req.actions?.map((action) => (
                                <li key={action.id} className="relative">
                                    <span className={`absolute left-[-25px] top-1 size-2.5 rounded-full ${ACTION_DOT[action.action]}`} />
                                    <p className="text-sm font-semibold text-slate-900">
                                        {ACTION_LABEL[action.action]} oleh {action.user?.name}
                                    </p>
                                    {action.note && <p className="text-xs text-slate-500">{action.note}</p>}
                                </li>
                            ))}
                        </ol>
                    </div>
                )}
            </div>

            {confirmingDelete && (
                <ConfirmDialog
                    title="Hapus Draft"
                    confirmLabel="Ya, Hapus Draft"
                    isLoading={submitting}
                    onConfirm={deleteDraft}
                    onClose={() => setConfirmingDelete(false)}
                >
                    Hapus draft ini?
                </ConfirmDialog>
            )}

            {showCancel && req && (
                <CancelRequestModal
                    approvalRequestId={req.id}
                    onClose={() => setShowCancel(false)}
                    description="Pengajuan akan dihentikan dan tidak lagi muncul di kotak persetujuan. Persetujuan yang sudah diberikan ikut hangus."
                />
            )}

            {showReassign && req && (
                <ReassignApproverModal
                    approvalRequestId={req.id}
                    candidates={reassignCandidates}
                    stepOrder={req.current_step}
                    stepLabel={steps.find((st) => st.step_order === req.current_step)?.label}
                    onClose={() => setShowReassign(false)}
                />
            )}

            <ModalOverlay isOpen={showReject} isDismissable={!submitting} isKeyboardDismissDisabled={submitting} onOpenChange={setShowReject}>
                <Modal className="sm:max-w-md">
                    <Dialog aria-labelledby="reject-title">
                        <div className="w-full p-6">
                            <h3 id="reject-title" className="mb-3 text-base font-bold text-slate-900">
                                Tolak Pengajuan
                            </h3>
                            <TextArea
                                aria-label="Alasan penolakan"
                                isRequired
                                rows={3}
                                placeholder="Alasan penolakan (wajib diisi)"
                                value={note}
                                onChange={setNote}
                            />
                            <div className="mt-4 flex justify-end gap-3">
                                <Button color="secondary" size="md" isDisabled={submitting} onPress={() => setShowReject(false)}>
                                    Batal
                                </Button>
                                <Button color="primary-destructive" size="md" isLoading={submitting} isDisabled={!note.trim()} onPress={reject}>
                                    Ya, Tolak
                                </Button>
                            </div>
                        </div>
                    </Dialog>
                </Modal>
            </ModalOverlay>
        </AuthenticatedLayout>
    );
}
```
`ConfirmDialog` memakai varian bahaya yang berkata "Tindakan ini tidak dapat dibatalkan." (sesuai teks lama "Hapus draft ini? Tindakan ini tidak dapat dibatalkan."), sehingga isi dialog cukup "Hapus draft ini?".

- [ ] **Step 2: Hapus `PENERIMAAN_STATUS_STYLE`**

Di `lib/penerimaanStatus.ts` hapus konstanta `PENERIMAAN_STATUS_STYLE` (tidak ada lagi pemakai setelah `Index` dan `Show` dimigrasi).

- [ ] **Step 3: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
grep -rn "PENERIMAAN_STATUS_STYLE\|window.confirm\|@/Components/Icons" resources/js/Pages/Penerimaan resources/js/lib/penerimaanStatus.ts
php artisan test --compact --filter='Penerimaan|Approval|Persetujuan'
git add resources/js/Pages/Penerimaan/Show.tsx resources/js/lib/penerimaanStatus.ts
git commit -m "feat(ui): migrate the receipt detail page to Untitled UI components"
```
Expected: bersih; `grep` kosong; test hijau.

- [ ] **Step 4: Cek runtime singkat dan GERBANG PENERIMAAN — berhenti**

Cek di browser headless (akun yang berhak, mis. `admin.kelurahan@simaset.test` atau super-admin): daftar (filter, pencarian, pagination), formulir Tambah (ulangan barang, saran nama, dokumen; kirim kosong untuk galat tanpa menyimpan), Detail (alur persetujuan, dialog Batalkan/Alihkan/Tolak tanpa dikonfirmasi), dan satu halaman lain yang memakai modal bersama (mis. detail Mutasi atau Permohonan).

Laporkan hasil Task 1–4, `Ruling`, dan hal yang tak bisa diverifikasi tanpa browser pengguna. Minta pengguna memeriksa:
- **Daftar**: filter Status/Tanggal/Urutkan dan Reset, pencarian (Enter dan tombol Cari), tabel muat tanpa gulir samping pada lebar laptop, badge status berwarna (Draft abu, Diajukan biru, Diverifikasi kuning, Disetujui hijau, Ditolak merah, Dibatalkan abu), nilai rata kanan, pagination yang mempertahankan filter.
- **Formulir**: tambah/hapus barang, saran nama barang muncul setelah memilih subkategori, pratinjau Rupiah di nilai per unit, unggah dokumen, edit draft (dokumen lama bisa ditandai hapus/batal hapus), galat per field dan ringkasan di bilah lengket, Simpan Draft dan Ajukan Penerimaan.
- **Detail**: badge status di samping judul; tombol sesuai izin dan status; stepper alur; dialog Hapus Draft, Batalkan (alasan wajib), Alihkan Approver (user dan alasan wajib), Tolak (alasan wajib); riwayat aktivitas.
- **Modal bersama di modul lain** (Mutasi/Permohonan/Lapor): dialog Batalkan dan Alihkan tampil dengan gaya baru dan tetap berfungsi.
- Keyboard (Tab/Spasi/Esc), layar 375 px, cincin fokus.
**Jangan memulai modul berikutnya** sebelum pengguna menyatakan lolos.

## Catatan Review (ponytail + impeccable, sudah diterapkan)

- Tidak ada komponen baru; modal bersama dimigrasi di tempat (props tetap), timeline/riwayat tetap inline (ekstraksi ditunda sampai ada konsumen kedua).
- Ponytail: `rupiahHint` dan peta `STEP_CIRCLE`/`ACTION_DOT` kecil dan dipakai; tidak ada abstraksi spekulatif. Tidak ada test frontend baru (hanya tampilan; logika backend sudah dicakup `PenerimaanAset*Test`).
- Impeccable: hierarki heading formulir "1./2./3." konsisten; galat per field di `hint` + ringkasan di bilah lengket; aksi destruktif (Hapus Draft, Tolak) memakai dialog dengan alasan/konfirmasi; fokus terkelola oleh React Aria.
- Asumsi terverifikasi: default urutan server `terbaru`; `Input icon`, `Tooltip title`, `ConfirmDialog` sesuai pemakaian di halaman Pengguna.
- Review formal (ponytail): tidak ada yang layak dihapus; dua cangkang modal mirip tetap tidak diekstrak (satu halaman aksi per modal, tunda sampai konsumen kedua dimigrasi). Total nilai berjalan di formulir sengaja tidak ditambah (di luar lingkup migrasi).
- Review formal (impeccable, mode Operate): diterapkan — pesan kosong berbeda saat ada filter/pencarian, stepper bisa digulir (`min-w-32`) di 375 px, `role="alert"` tunggal di bilah lengket. Dicek saat eksekusi: header kolom Nilai sebaiknya rata kanan seperti selnya (jika `Table.Head` menerima `className`); input angka tidak berubah oleh roda mouse.
