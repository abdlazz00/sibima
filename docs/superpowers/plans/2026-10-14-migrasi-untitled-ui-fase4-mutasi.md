# Migrasi Untitled UI, Fase 4: Mutasi Aset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memigrasikan modul Mutasi Aset (`Index`, `Create`, `Show`) ke komponen Untitled UI tanpa mengubah logika, props Inertia, atau backend. Di jalur yang sama, tiga komponen bersama yang dipakai banyak modul transaksi dimigrasikan dan diekstrak sekali (konsumen kedua sudah ada): `AssetSelectModal`, stepper alur persetujuan, linimasa riwayat, dan modal Tolak.

**Architecture:** Hanya frontend. `Index` dan `Create` mengikuti pola Penerimaan (Table rapat, `PaginationPageDefault`, `Select`/`Input`/`TextArea`, bilah aksi lengket). `AssetSelectModal` memakai pemilihan baris bawaan React Aria `Table` (`selectionMode`), bukan checkbox buatan sendiri. `Show` dan `Penerimaan/Show` memakai `ApprovalStepper`, `ApprovalTimeline`, dan `RejectRequestModal` bersama. Halaman Lapor Rusak/Hilang (`AssetReports/Create`) dan Permohonan (`AssetRequests/Show`) ikut mendapat tampilan baru `AssetSelectModal` tanpa perubahan props.

**Tech Stack:** React 19, Inertia 2, Tailwind 4, Untitled UI (React Aria Components), `@untitledui/icons`.

**Spec:** `docs/superpowers/specs/2026-10-14-migrasi-untitled-ui-design.md` §3.5 butir 3 (Transaksi, satu modul per langkah atas permintaan pengguna). Pola acuan: plan Penerimaan (`2026-10-14-migrasi-untitled-ui-fase4-penerimaan.md`).

## Global Constraints

- Hanya komponen Untitled UI gratis. Panduan UI/UX menang untuk identitas; Untitled UI menang untuk semantik, keyboard, fokus.
- Logika tidak berubah: `useForm` mutasi, `handleTypeChange`, `destinationOptions`, `availableAssets`, `targetPegawaiOptions`, `transform` (konversi angka, filter item kosong, `target_holder_id` null saat pengembalian), `approve`/`reject`/`cancel`/`reassign`, `stepState`, props Inertia, nama berkas. `ListFilters.tsx` dan `lib/pagination.ts` tidak diubah (masih dipakai halaman lain).
- Props `AssetSelectModal` (`isOpen`, `onClose`, `assets`, `selectedIds`, `onConfirm`, `mode`, `maxSelection`, `title`, `description`, `disabledIds`) dan ekspor `SelectableAsset` tidak berubah; tiga konsumen tidak disentuh.
- Warna tombol: Ajukan/Setujui/Kirim `primary`; Lihat `secondary-brand`; Cetak `secondary-violet`; Batalkan/Alihkan/Kembali/Batal `secondary`; Tolak, hapus baris `secondary-destructive`; Tambah/Ubah pilihan aset `secondary-brand`. Badge `type="color" size="sm" className="rounded-sm"`.
- `Input` Untitled tidak meneruskan atribut `min`; server memvalidasi. Kunci kosong tidak valid pada `Select`: belum dipilih memakai `selectedKey={… || null}` dengan `placeholder`; pilihan "Inventaris Unit" memakai kunci `__none`.
- Impor `@/Components/...` berhuruf besar; tanpa komponen Breeze atau `@/Components/Icons`; tanpa dependensi baru.
- Teks tampilan tidak diubah, kecuali: salah-ketik `&bull;` yang tampil harfiah di Show diperbaiki, deskripsi bawah judul di Create dihapus (sudah ada hint per bagian), dan kartu "Informasi Pengajuan Dokumen" kehilangan label "SIMASET ID #" (sisa nama lama; diganti "ID #").
- Verifikasi: `npx tsc --noEmit`, `npm run build`, test backend `--filter='Mutation|Mutasi|Penerimaan|Approval|Persetujuan|AssetReport|AssetRequest'`. Cek runtime singkat di browser diperbolehkan untuk menangkap error (tanpa menyimpan data permanen); penilaian visual oleh pengguna di gerbang.
- Git: commit per task di `main`, tanpa trailer Co-Authored-By, stage dengan path eksplisit, tanpa push.

## Review Focus

1. **`AssetSelectModal` dipakai 3 halaman** (Mutasi Create, Lapor Create, Permohonan Show). Props tetap; mode `single` (satu pilihan) dan `multiple` dengan `maxSelection` ("harus tepat N") dan `disabledIds` harus berperilaku sama. Pagar: Task 1; butir gerbang memeriksa satu halaman lain.
2. **Pilihan lintas halaman**: pencarian dan paginasi 10 per halaman tidak boleh menghapus pilihan di halaman lain. Pagar: handler `onSelectionChange` menggabungkan pilihan halaman aktif dengan pilihan di luar halaman (Task 1).
3. **Pilih-semua** di mode `multiple` hanya memilih baris halaman aktif dan menghormati `maxSelection`. Pagar: Task 1.
4. **Perubahan jenis mutasi** mereset pemegang dan aset yang tak sah (pengembalian butuh pemegang). Pagar: `handleTypeChange` tidak diubah (Task 4).
5. **Pemegang baru**: wajib untuk `internal`, opsional (Inventaris Unit) untuk jenis lain, tidak ada untuk `pengembalian`. Pagar: item `__none` hanya selain internal; kolom disembunyikan saat pengembalian (Task 4).
6. **Stepper dan linimasa dipakai ulang** oleh Penerimaan Show: tampilan Penerimaan ikut berubah (lebih kaya: nama approver di langkah selesai, waktu proses, warna catatan). Status Dibatalkan sekarang tampil pada langkah berjalan di kedua modul. Pagar: Task 2 + butir gerbang.
7. **Cetak (`window.print()`)**: bagian layar (`print:hidden`) tidak boleh ikut tercetak, judul cetak tetap muncul. Pagar: kelas `print:hidden`/`hidden print:block` dipertahankan (Task 5); butir gerbang memeriksa pratinjau cetak.
8. **Tabel Show tanpa `tfoot`**: Untitled `Table` tidak punya footer. Jumlah item dan total nilai sudah ada di kartu metrik atas, jadi baris total di bawah tabel dihapus (tidak diduplikasi). Pagar: Task 5; butir gerbang memeriksa tampilan cetak.
9. **Lightbox foto** dapat dibuka dengan keyboard dan ditutup dengan Esc. Pagar: foto menjadi `button`, lightbox berbasis `ModalOverlay` (Task 5).
10. **Tindakan sesuai izin**: Batalkan/Alihkan/Tolak/Setujui hanya tampil sesuai `can.*` dan `mutation.status === 'pending'`. Pagar: kondisi dipertahankan persis (Task 5).

---

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `resources/js/lib/format.ts` | Tambah `tanggal`, `tanggalWaktu` |
| `resources/js/lib/mutasi.ts` | Label dan warna jenis/status mutasi (dipakai Index dan Show) |
| `resources/js/Components/AssetSelectModal.tsx` | Modal pilih aset berbasis `Table` selection |
| `resources/js/Components/RejectRequestModal.tsx` | Modal Tolak bersama |
| `resources/js/Components/ApprovalStepper.tsx` | Kartu "Tahapan Alur Persetujuan" bersama |
| `resources/js/Components/ApprovalTimeline.tsx` | Kartu riwayat persetujuan bersama |
| `resources/js/Pages/Penerimaan/Show.tsx` | Memakai komponen bersama di atas |
| `resources/js/Pages/AssetMutations/{Index,Create,Show}.tsx` | Halaman Mutasi |

---

### Task 1: Fondasi (format, label mutasi, `AssetSelectModal`, `RejectRequestModal`, stepper, linimasa)

**Files:**
- Modify: `resources/js/lib/format.ts`, `resources/js/Components/AssetSelectModal.tsx`
- Create: `resources/js/lib/mutasi.ts`, `resources/js/Components/RejectRequestModal.tsx`, `resources/js/Components/ApprovalStepper.tsx`, `resources/js/Components/ApprovalTimeline.tsx`

**Interfaces:**
- Produces: `tanggal(value?)`, `tanggalWaktu(value?)`; `MUTATION_TYPE_LABEL/COLOR`, `MUTATION_STATUS_LABEL/COLOR`; `RejectRequestModal({ approvalRequestId, onClose, description })`; `ApprovalStepper({ request, titleFor? })`; `ApprovalTimeline({ request, createdTitle, creatorName?, createdAt? })`.

- [ ] **Step 1: `lib/format.ts`**

Tambahkan di akhir berkas:
```ts
/** "2026-10-14" -> "14 Oktober 2026". */
export const tanggal = (value?: string | null): string =>
    value ? new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

/** "2026-10-14T08:30:00Z" -> "14 Okt 2026 15.30". */
export const tanggalWaktu = (value?: string | null): string =>
    value
        ? new Date(value).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '—';
```

- [ ] **Step 2: `lib/mutasi.ts`**

```ts
import { MutationStatus, MutationType } from '@/types';

export const MUTATION_TYPE_LABEL: Record<MutationType, string> = {
    kec_ke_kel: 'Kecamatan ke Kelurahan',
    antar_kel: 'Antar Kelurahan',
    retur_kel_ke_kec: 'Retur ke Kecamatan',
    internal: 'Mutasi Internal',
    pengembalian: 'Pengembalian ke Inventaris',
};

export const MUTATION_TYPE_COLOR: Record<MutationType, 'indigo' | 'blue' | 'purple' | 'gray' | 'warning'> = {
    kec_ke_kel: 'indigo',
    antar_kel: 'blue',
    retur_kel_ke_kec: 'purple',
    internal: 'gray',
    pengembalian: 'warning',
};

export const MUTATION_STATUS_LABEL: Record<MutationStatus, string> = {
    pending: 'Menunggu Persetujuan',
    approved: 'Disetujui',
    rejected: 'Ditolak',
    cancelled: 'Dibatalkan',
};

export const MUTATION_STATUS_COLOR: Record<MutationStatus, 'warning' | 'success' | 'error' | 'gray'> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'error',
    cancelled: 'gray',
};
```

- [ ] **Step 3: `RejectRequestModal.tsx`**

```tsx
import { Dialog, Modal, ModalOverlay } from '@/Components/ui/application/modals/modal';
import { Button } from '@/Components/ui/base/buttons/button';
import { TextArea } from '@/Components/ui/base/textarea/textarea';
import { router } from '@inertiajs/react';
import { useState } from 'react';

interface RejectRequestModalProps {
    approvalRequestId: number;
    onClose: () => void;
    description: string;
}

export default function RejectRequestModal({ approvalRequestId, onClose, description }: RejectRequestModalProps) {
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const reject = () => {
        if (submitting || !note.trim()) return;
        setSubmitting(true);
        router.post(
            route('approval-requests.reject', approvalRequestId),
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
                <Dialog aria-labelledby="reject-request-title">
                    <div className="w-full p-6">
                        <h3 id="reject-request-title" className="mb-2 text-base font-bold text-slate-900">
                            Tolak Pengajuan
                        </h3>
                        <p className="mb-4 text-xs leading-relaxed text-slate-600">{description}</p>
                        <TextArea label="Alasan Penolakan" isRequired rows={4} maxLength={1000} value={note} onChange={setNote} />
                        <div className="mt-6 flex items-center justify-end gap-3">
                            <Button color="secondary" size="md" isDisabled={submitting} onPress={onClose}>
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
    );
}
```

- [ ] **Step 4: `ApprovalStepper.tsx`**

```tsx
import { ApprovalRequestSummary, ApprovalStep } from '@/types';
import { Check, XClose } from '@untitledui/icons';

type StepState = 'done' | 'current' | 'upcoming' | 'rejected' | 'cancelled';

const CIRCLE: Record<StepState, string> = {
    done: 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-500/20',
    current: 'bg-amber-100 text-amber-800 ring-4 ring-amber-400/30',
    upcoming: 'bg-slate-100 text-slate-500',
    rejected: 'bg-red-100 text-red-800 ring-4 ring-red-400/30',
    cancelled: 'bg-slate-200 text-slate-600',
};

function stepState(request: ApprovalRequestSummary, order: number): StepState {
    if (request.status === 'approved') return 'done';
    if (order < request.current_step) return 'done';
    if (order === request.current_step) {
        if (request.status === 'rejected') return 'rejected';
        if (request.status === 'cancelled') return 'cancelled';
        return 'current';
    }
    return 'upcoming';
}

export default function ApprovalStepper({
    request,
    titleFor = (step) => step.label,
}: {
    request: ApprovalRequestSummary;
    titleFor?: (step: ApprovalStep) => string;
}) {
    const steps = request.steps ?? [];

    if (steps.length === 0) {
        return null;
    }

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs print:hidden">
            <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-sm font-bold text-slate-900">Tahapan Alur Persetujuan</h2>
                    <p className="text-xs text-slate-500">Alur verifikasi berjenjang sesuai kewenangan unit kerja</p>
                </div>
                <span className="shrink-0 text-xs font-medium text-slate-500">
                    Langkah {request.current_step} dari {steps.length}
                </span>
            </div>

            <ol className="flex flex-col gap-6 md:flex-row md:items-start">
                {steps.map((step, idx) => {
                    const state = stepState(request, step.step_order);
                    const approver = request.actions?.find((a) => a.action === 'approve' && a.step_order === step.step_order)?.user?.name;

                    return (
                        <li key={step.step_order} className="relative flex flex-1 flex-col gap-2">
                            <div className="flex items-center gap-3">
                                <div className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${CIRCLE[state]}`}>
                                    {state === 'done' ? (
                                        <Check className="size-4" aria-hidden="true" />
                                    ) : state === 'rejected' || state === 'cancelled' ? (
                                        <XClose className="size-4" aria-hidden="true" />
                                    ) : (
                                        step.step_order
                                    )}
                                </div>
                                {idx < steps.length - 1 && (
                                    <div className={`hidden h-0.5 flex-1 md:block ${state === 'done' ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                                )}
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-slate-900">{titleFor(step)}</p>
                                <p className="mt-0.5 text-[11px] text-slate-500">
                                    {state === 'done' && <span className="text-emerald-700">Disetujui{approver ? ` (${approver})` : ''}</span>}
                                    {state === 'rejected' && <span className="text-red-700">Ditolak</span>}
                                    {state === 'cancelled' && <span className="text-slate-600">Dibatalkan</span>}
                                    {state === 'current' && <span className="font-medium text-amber-700">Menunggu Persetujuan</span>}
                                    {state === 'upcoming' && 'Belum dimulai'}
                                </p>
                            </div>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
```

- [ ] **Step 5: `ApprovalTimeline.tsx`**

```tsx
import { tanggal, tanggalWaktu } from '@/lib/format';
import { ApprovalRequestSummary } from '@/types';

const ACTION_TITLE = {
    approve: 'Persetujuan Diberikan',
    reassign: 'Approver Dialihkan',
    cancel: 'Pengajuan Dibatalkan',
    reject: 'Pengajuan Ditolak',
} as const;

const ACTION_DOT = { approve: 'bg-emerald-600', reassign: 'bg-blue-600', cancel: 'bg-slate-500', reject: 'bg-red-600' } as const;

const NOTE_STYLE = {
    approve: 'border-emerald-100 bg-emerald-50/50 text-emerald-900',
    reassign: 'border-slate-200 bg-slate-50 text-slate-800',
    cancel: 'border-slate-200 bg-slate-50 text-slate-800',
    reject: 'border-red-100 bg-red-50/70 text-red-900',
} as const;

export default function ApprovalTimeline({
    request,
    createdTitle,
    creatorName,
    createdAt,
}: {
    request: ApprovalRequestSummary;
    createdTitle: string;
    creatorName?: string;
    createdAt?: string;
}) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <h2 className="mb-1 text-base font-bold text-slate-900">Riwayat Persetujuan &amp; Log Aktivitas</h2>
            <p className="mb-6 text-xs text-slate-500">Catatan audit trail seluruh tindakan pada pengajuan ini</p>

            <ol className="relative space-y-6 border-l border-slate-200 pl-6">
                <li className="relative">
                    <span className="absolute -left-[31px] top-0.5 size-4 rounded-full bg-blue-600 ring-4 ring-white" />
                    <p className="text-sm font-bold text-slate-900">{createdTitle}</p>
                    <p className="text-xs text-slate-500">
                        Diajukan oleh <span className="font-semibold text-slate-700">{creatorName ?? 'Pengguna'}</span>
                        {createdAt && <> pada {tanggal(createdAt)}</>}
                    </p>
                </li>

                {request.actions?.map((action) => (
                    <li key={action.id} className="relative space-y-1">
                        <span className={`absolute -left-[31px] top-0.5 size-4 rounded-full ring-4 ring-white ${ACTION_DOT[action.action]}`} />
                        <p className="text-sm font-bold text-slate-900">{ACTION_TITLE[action.action]}</p>
                        <p className="text-xs text-slate-500">
                            Diproses oleh <span className="font-semibold text-slate-700">{action.user?.name ?? 'Pejabat Pemeriksa'}</span> pada{' '}
                            {tanggalWaktu(action.created_at)}
                        </p>
                        {action.note && (
                            <div className={`mt-2 rounded-lg border p-3 text-xs ${NOTE_STYLE[action.action]}`}>
                                <span className="font-semibold">Catatan:</span> {action.note}
                            </div>
                        )}
                    </li>
                ))}
            </ol>
        </div>
    );
}
```

- [ ] **Step 6: `AssetSelectModal.tsx` (ganti seluruh isi)**

```tsx
import { Dialog, Modal, ModalOverlay } from '@/Components/ui/application/modals/modal';
import { PaginationPageDefault } from '@/Components/ui/application/pagination/pagination';
import { Table } from '@/Components/ui/application/table/table';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import { KONDISI_BADGE_COLOR, KONDISI_LABEL } from '@/lib/assetReport';
import { SearchLg } from '@untitledui/icons';
import { useEffect, useMemo, useState } from 'react';
import type { Selection } from 'react-aria-components';

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

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return assets;
        return assets.filter(
            (a) =>
                a.nama_aset?.toLowerCase().includes(q) ||
                a.kode_barang?.toLowerCase().includes(q) ||
                String(a.nomor_register).includes(q) ||
                a.merk_type?.toLowerCase().includes(q) ||
                a.holder?.toLowerCase().includes(q),
        );
    }, [assets, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const paginated = useMemo(() => filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE), [filtered, page]);
    const pageIds = paginated.map((a) => a.id);

    // Pilihan di halaman lain dipertahankan; "pilih semua" hanya mencakup halaman aktif.
    const handleSelectionChange = (keys: Selection) => {
        const picked = keys === 'all' ? pageIds : [...keys].map(Number);

        if (mode === 'single') {
            setTempSelected(picked.slice(-1));
            return;
        }

        const merged = [...tempSelected.filter((id) => !pageIds.includes(id)), ...picked.filter((id) => pageIds.includes(id))];
        setTempSelected(maxSelection ? merged.slice(0, maxSelection) : merged);
    };

    const handleConfirm = () => {
        onConfirm(assets.filter((a) => tempSelected.includes(a.id)));
        onClose();
    };

    const isExceeding = maxSelection !== undefined && tempSelected.length > maxSelection;
    const isConfirmDisabled = tempSelected.length === 0 || (maxSelection !== undefined && tempSelected.length !== maxSelection);

    return (
        <ModalOverlay
            isOpen={isOpen}
            isDismissable
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <Modal className="sm:max-w-4xl">
                <Dialog aria-label={title} className="flex flex-col overflow-hidden">
                    <div className="border-b border-slate-200 px-6 py-4">
                        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
                        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
                    </div>

                    <div className="space-y-2 border-b border-slate-100 bg-slate-50/70 px-6 py-3">
                        <Input
                            aria-label="Cari aset"
                            size="md"
                            icon={SearchLg}
                            autoFocus
                            placeholder="Cari berdasarkan nama aset, kode barang, no. register, merk..."
                            value={search}
                            onChange={(v) => {
                                setSearch(v);
                                setPage(1);
                            }}
                        />
                        <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>Menampilkan {filtered.length} aset yang sesuai</span>
                            {mode === 'multiple' && maxSelection && (
                                <span className="font-semibold text-blue-700">Batas pilihan: tepat {maxSelection} aset</span>
                            )}
                        </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div className="py-12 text-center">
                                <p className="text-sm font-semibold text-slate-700">Tidak ada aset ditemukan</p>
                                <p className="mt-1 text-xs text-slate-400">Coba ubah kata kunci pencarian Anda</p>
                            </div>
                        ) : (
                            <Table
                                aria-label="Daftar aset yang dapat dipilih"
                                size="sm"
                                selectionMode={mode === 'single' ? 'single' : 'multiple'}
                                selectedKeys={new Set<number | string>(tempSelected)}
                                disabledKeys={disabledIds}
                                onSelectionChange={handleSelectionChange}
                            >
                                <Table.Header>
                                    <Table.Head id="kode" label="Kode & Register" isRowHeader />
                                    <Table.Head id="nama" label="Nama Barang & Merk" />
                                    <Table.Head id="kondisi" label="Kondisi" />
                                    <Table.Head id="pemegang" label="Pemegang Saat Ini" />
                                </Table.Header>
                                <Table.Body items={paginated}>
                                    {(asset) => (
                                        <Table.Row id={asset.id}>
                                            <Table.Cell className="whitespace-nowrap">
                                                <span className="font-mono text-xs text-slate-700">{asset.kode_barang}</span>
                                                <span className="block text-[11px] font-semibold text-slate-500">
                                                    Reg. #{String(asset.nomor_register).padStart(4, '0')}
                                                </span>
                                            </Table.Cell>
                                            <Table.Cell>
                                                <span className="font-semibold text-slate-900">{asset.nama_aset}</span>
                                                <span className="block text-xs text-slate-500">{asset.merk_type || '—'}</span>
                                            </Table.Cell>
                                            <Table.Cell>
                                                <Badge type="color" size="sm" color={KONDISI_BADGE_COLOR[asset.kondisi] ?? 'gray'} className="rounded-sm">
                                                    {KONDISI_LABEL[asset.kondisi] ?? asset.kondisi}
                                                </Badge>
                                            </Table.Cell>
                                            <Table.Cell className="whitespace-nowrap text-xs">
                                                {asset.holder ? (
                                                    <span className="font-medium text-slate-900">{asset.holder}</span>
                                                ) : (
                                                    <span className="italic text-slate-400">Inventaris Unit</span>
                                                )}
                                            </Table.Cell>
                                        </Table.Row>
                                    )}
                                </Table.Body>
                            </Table>
                        )}
                    </div>

                    {totalPages > 1 && (
                        <div className="border-t border-slate-200 px-6 py-3">
                            <PaginationPageDefault className="border-t-0 pt-0 md:pt-0" page={page} total={totalPages} onPageChange={setPage} />
                        </div>
                    )}

                    <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                        <p className="text-sm font-medium">
                            {mode === 'single' ? (
                                <span>{tempSelected.length === 1 ? '1 aset dipilih' : 'Pilih 1 aset'}</span>
                            ) : (
                                <span className={isExceeding ? 'font-bold text-red-600' : 'text-slate-700'}>
                                    {tempSelected.length} aset dipilih
                                    {maxSelection && ` (harus tepat ${maxSelection})`}
                                </span>
                            )}
                        </p>
                        <div className="flex items-center gap-3">
                            <Button color="secondary" size="md" onPress={onClose}>
                                Batal
                            </Button>
                            <Button color="primary" size="md" isDisabled={isConfirmDisabled} onPress={handleConfirm}>
                                Gunakan {tempSelected.length > 0 ? `(${tempSelected.length}) ` : ''}Aset Terpilih
                            </Button>
                        </div>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
}
```
Catatan: bila `Dialog` + `overflow-hidden` menggulir seluruh dialog alih-alih hanya tabel, pindahkan batas tinggi ke pembungkus (`max-h-[calc(var(--visual-viewport-height)-64px)]`); dicatat sebagai `Ruling` saat eksekusi.

- [ ] **Step 7: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
git add resources/js/lib/format.ts resources/js/lib/mutasi.ts resources/js/Components/AssetSelectModal.tsx resources/js/Components/RejectRequestModal.tsx resources/js/Components/ApprovalStepper.tsx resources/js/Components/ApprovalTimeline.tsx
git commit -m "feat(ui): add shared approval flow components and move the asset picker to Untitled UI"
```
Expected: `tsc` bersih (tiga konsumen `AssetSelectModal` tetap valid karena props tidak berubah); build berhasil.

---

### Task 2: `Penerimaan/Show` memakai komponen bersama

**Files:**
- Modify: `resources/js/Pages/Penerimaan/Show.tsx`

**Interfaces:**
- Consumes: `ApprovalStepper`, `ApprovalTimeline`, `RejectRequestModal` (Task 1). Perilaku dan `can.*` tidak berubah.

- [ ] **Step 1: Ganti isi `Show.tsx`**

```tsx
import ApprovalStepper from '@/Components/ApprovalStepper';
import ApprovalTimeline from '@/Components/ApprovalTimeline';
import CancelRequestModal from '@/Components/CancelRequestModal';
import ConfirmDialog from '@/Components/ConfirmDialog';
import PageHeader from '@/Components/PageHeader';
import ReassignApproverModal from '@/Components/ReassignApproverModal';
import RejectRequestModal from '@/Components/RejectRequestModal';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { rupiah } from '@/lib/format';
import { PENERIMAAN_STATUS_COLOR, PENERIMAAN_STATUS_LABEL, penerimaanStatus } from '@/lib/penerimaanStatus';
import { BeritaAcaraPenerimaan, PageProps, ReassignCandidate } from '@/types';
import { Head, router } from '@inertiajs/react';
import { useState } from 'react';

interface ShowProps extends PageProps {
    beritaAcara: BeritaAcaraPenerimaan;
    can: { act: boolean; cancel: boolean; edit: boolean; delete: boolean; reassign: boolean };
    reassignCandidates: ReassignCandidate[];
}

export default function Show({ beritaAcara, can, reassignCandidates }: ShowProps) {
    const [showReject, setShowReject] = useState(false);
    const [showCancel, setShowCancel] = useState(false);
    const [showReassign, setShowReassign] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
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

    const deleteDraft = () => {
        setSubmitting(true);
        router.delete(route('penerimaan-aset.destroy', beritaAcara.id), {
            onFinish: () => {
                setSubmitting(false);
                setConfirmingDelete(false);
            },
        });
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

                {req && <ApprovalStepper request={req} />}

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

                {req && <ApprovalTimeline request={req} createdTitle="Pengajuan Dibuat" creatorName={beritaAcara.creator?.name} />}
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

            {showReject && req && (
                <RejectRequestModal
                    approvalRequestId={req.id}
                    onClose={() => setShowReject(false)}
                    description="Tuliskan alasan penolakan secara jelas. Alasan ini akan terlihat oleh pengaju."
                />
            )}
        </AuthenticatedLayout>
    );
}
```
Berbeda dari sebelumnya: modal Tolak sekarang komponen bersama dengan teks pengantar; stepper/linimasa mengikuti versi bersama.

- [ ] **Step 2: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
php artisan test --compact --filter='Penerimaan|Approval|Persetujuan'
git add resources/js/Pages/Penerimaan/Show.tsx
git commit -m "refactor(ui): use the shared approval flow components on the receipt detail page"
```
Expected: bersih; test hijau.

---

### Task 3: `AssetMutations/Index`

**Files:**
- Modify: `resources/js/Pages/AssetMutations/Index.tsx` (ganti seluruh isi)

**Interfaces:**
- Consumes: `PageHeader`, `Table`, `PaginationPageDefault`, `Badge`, `Button`, `Input`, `Select`, `Tooltip`, `lib/mutasi`; ikon `ArrowRight`, `Eye`, `Plus`, `SearchLg`, `XClose`.

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
import { MUTATION_STATUS_COLOR, MUTATION_STATUS_LABEL, MUTATION_TYPE_COLOR, MUTATION_TYPE_LABEL } from '@/lib/mutasi';
import { AssetMutation, MutationType, Paginated, PageProps } from '@/types';
import { Head, router } from '@inertiajs/react';
import { ArrowRight, Eye, Plus, SearchLg, XClose } from '@untitledui/icons';
import { FormEvent, useState } from 'react';

interface IndexProps extends PageProps {
    mutations: Paginated<AssetMutation>;
    filters?: { search?: string; jenis?: string; urut?: string };
    sortOptions: { value: string; label: string }[];
    can: { create: boolean };
}

const ALL = '__all';

const JENIS_ITEMS = [
    { id: ALL, label: 'Semua alur' },
    ...(Object.keys(MUTATION_TYPE_LABEL) as MutationType[]).map((type) => ({ id: type, label: MUTATION_TYPE_LABEL[type] })),
];

export default function Index({ mutations, filters = {}, sortOptions, can }: IndexProps) {
    const [search, setSearch] = useState(filters.search ?? '');

    const go = (changes: Record<string, string | number | undefined>) => {
        const params = { ...filters, search: search || undefined, ...changes };
        const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
        router.get(route('asset-mutations.index'), clean, { preserveState: true, preserveScroll: true, replace: true });
    };

    const submitSearch = (e: FormEvent) => {
        e.preventDefault();
        go({ page: undefined });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Mutasi Aset" />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Mutasi Aset' }]}
                    title="Daftar Mutasi Aset"
                    actions={
                        can.create && (
                            <Button color="primary" size="md" iconLeading={Plus} href={route('asset-mutations.create')}>
                                Ajukan Mutasi Aset
                            </Button>
                        )
                    }
                />

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Select
                            label="Jenis alur"
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
                                placeholder="Cari no. mutasi, nama aset, atau unit..."
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

                    <Table aria-label="Daftar mutasi aset" size="sm">
                        <Table.Header>
                            <Table.Head id="nomor" label="No. Mutasi & Tanggal" isRowHeader />
                            <Table.Head id="jenis" label="Jenis Mutasi" />
                            <Table.Head id="alur" label="Alur Unit (Asal → Tujuan)" />
                            <Table.Head id="aset" label="Aset yang Dimutasi" />
                            <Table.Head id="status" label="Status" />
                            <Table.Head id="aksi" label="Aksi" />
                        </Table.Header>
                        <Table.Body
                            items={mutations.data}
                            renderEmptyState={() => (
                                <div className="py-14 text-center">
                                    <p className="text-sm font-semibold text-slate-900">
                                        {search || filters.jenis ? 'Tidak ada mutasi yang cocok dengan filter' : 'Belum ada transaksi mutasi'}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">Pengajuan mutasi aset antar unit atau internal akan tampil di sini.</p>
                                    {can.create && !search && !filters.jenis && (
                                        <Button className="mt-3" color="link-color" size="md" iconLeading={Plus} href={route('asset-mutations.create')}>
                                            Buat Pengajuan Pertama
                                        </Button>
                                    )}
                                </div>
                            )}
                        >
                            {(mutation) => {
                                const firstItem = mutation.items?.[0];
                                const extraItems = (mutation.items?.length ?? 0) - 1;
                                const sameUnit = mutation.jenis_mutasi === 'internal' || mutation.jenis_mutasi === 'pengembalian';

                                return (
                                    <Table.Row id={mutation.id}>
                                        <Table.Cell className="whitespace-nowrap">
                                            <span className="font-semibold text-slate-900">{mutation.nomor_mutasi}</span>
                                            <span className="block text-xs text-slate-500">
                                                {new Date(mutation.tanggal_mutasi).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </span>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Badge type="color" size="sm" color={MUTATION_TYPE_COLOR[mutation.jenis_mutasi]} className="rounded-sm">
                                                {MUTATION_TYPE_LABEL[mutation.jenis_mutasi]}
                                            </Badge>
                                        </Table.Cell>
                                        <Table.Cell className="text-slate-800">
                                            {sameUnit ? (
                                                <span className="font-medium text-slate-900">
                                                    {mutation.origin_unit?.name} ({mutation.jenis_mutasi === 'pengembalian' ? 'Ke Inventaris' : 'Internal'})
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1.5 text-xs">
                                                    <span className="font-medium text-slate-900">{mutation.origin_unit?.name}</span>
                                                    <ArrowRight className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                                                    <span className="font-medium text-blue-700">{mutation.destination_unit?.name}</span>
                                                </span>
                                            )}
                                        </Table.Cell>
                                        <Table.Cell className="text-slate-800">
                                            {firstItem ? (
                                                <>
                                                    <span className="font-medium text-slate-900">{firstItem.asset?.nama_aset ?? `Aset #${firstItem.asset_id}`}</span>
                                                    {extraItems > 0 && <span className="ml-1 text-xs text-slate-500">+{extraItems} aset lainnya</span>}
                                                </>
                                            ) : (
                                                <span className="text-xs text-slate-400">—</span>
                                            )}
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Badge type="color" size="sm" color={MUTATION_STATUS_COLOR[mutation.status]} className="rounded-sm">
                                                {MUTATION_STATUS_LABEL[mutation.status]}
                                            </Badge>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Tooltip title="Lihat detail mutasi">
                                                <Button
                                                    color="secondary-brand"
                                                    size="sm"
                                                    iconLeading={Eye}
                                                    aria-label={`Lihat mutasi ${mutation.nomor_mutasi}`}
                                                    href={route('asset-mutations.show', mutation.id)}
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
                                {mutations.from ?? 0}-{mutations.to ?? 0}
                            </span>{' '}
                            dari <span className="font-semibold tabular-nums text-slate-800">{mutations.total}</span> mutasi
                        </p>

                        {mutations.last_page > 1 && (
                            <PaginationPageDefault
                                className="border-t-0 pt-0 md:pt-0"
                                page={mutations.current_page}
                                total={mutations.last_page}
                                onPageChange={(page) =>
                                    router.get(route('asset-mutations.index'), { ...filters, page }, { preserveState: true, preserveScroll: true })
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
Prop yang berbeda dari yang diasumsikan (mis. `Button className`) disesuaikan dan dicatat sebagai `Ruling`.

- [ ] **Step 2: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
php artisan test --compact --filter='Mutation|Mutasi'
git add resources/js/Pages/AssetMutations/Index.tsx
git commit -m "feat(ui): migrate the mutation list page to Untitled UI components"
```
Expected: bersih; test hijau.

---

### Task 4: `AssetMutations/Create`

**Files:**
- Modify: `resources/js/Pages/AssetMutations/Create.tsx` (ganti seluruh isi)

**Interfaces:**
- Consumes: `PageHeader`, `Input`, `Select`, `TextArea`, `Button`, `Table`, `Badge`, `AssetSelectModal` (Task 1); ikon `Plus`, `Trash01`. Seluruh logika (hook, memo, handler, `transform`) disalin tanpa perubahan.

- [ ] **Step 1: Tulis ulang `Create.tsx`**

```tsx
import AssetSelectModal, { SelectableAsset } from '@/Components/AssetSelectModal';
import PageHeader from '@/Components/PageHeader';
import { Table } from '@/Components/ui/application/table/table';
import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import { Select } from '@/Components/ui/base/select/select';
import { TextArea } from '@/Components/ui/base/textarea/textarea';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Asset, MutationType, PageProps, Pegawai } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { Plus, Trash01 } from '@untitledui/icons';
import { useMemo, useState } from 'react';

interface UnitOption {
    id: number;
    name: string;
    type: 'kecamatan' | 'kelurahan';
}

interface CreateProps extends PageProps {
    units: UnitOption[];
    allUnits: UnitOption[];
    assets: Asset[];
    pegawais: Pegawai[];
}

interface ItemForm {
    asset_id: string | number;
    target_holder_id: string | number;
    catatan: string;
}

const EMPTY_ITEM: ItemForm = {
    asset_id: '',
    target_holder_id: '',
    catatan: '',
};

const NONE = '__none';

const KECAMATAN_TYPES = [
    { id: 'kec_ke_kel', label: 'Mutasi Kecamatan ke Kelurahan' },
    { id: 'internal', label: 'Mutasi Internal Kecamatan' },
    { id: 'pengembalian', label: 'Pengembalian ke Inventaris' },
];

const KELURAHAN_TYPES = [
    { id: 'antar_kel', label: 'Mutasi Antar Kelurahan' },
    { id: 'retur_kel_ke_kec', label: 'Retur Kelurahan ke Kecamatan' },
    { id: 'internal', label: 'Mutasi Internal Kelurahan' },
    { id: 'pengembalian', label: 'Pengembalian ke Inventaris' },
];

export default function Create({ units, allUnits, assets, pegawais, auth }: CreateProps) {
    // Default origin to user's assigned unit or first accessible unit
    const defaultOriginId = auth.user?.unit?.id ?? units[0]?.id ?? 1;
    const defaultOriginUnit = allUnits.find((u) => u.id === defaultOriginId);
    const isOriginKecamatan = defaultOriginUnit?.type === 'kecamatan';

    // Auto-generate suggested document number
    const todayStr = new Date().toISOString().slice(0, 10);
    const dateNum = todayStr.replace(/-/g, '');
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const defaultDocNumber = `MUT/${dateNum}/${randNum}`;

    const [isModalOpen, setIsModalOpen] = useState(false);

    const form = useForm({
        nomor_mutasi: defaultDocNumber,
        tanggal_mutasi: todayStr,
        jenis_mutasi: (isOriginKecamatan ? 'kec_ke_kel' : 'antar_kel') as MutationType,
        origin_unit_id: defaultOriginId,
        destination_unit_id: '' as string | number,
        keterangan: '',
        items: [{ ...EMPTY_ITEM }] as ItemForm[],
    });

    const errors = form.errors as Record<string, string>;
    const isReturn = form.data.jenis_mutasi === 'pengembalian';
    const isInternal = form.data.jenis_mutasi === 'internal';
    const sameUnit = isInternal || isReturn;

    const originUnit = useMemo(() => allUnits.find((u) => u.id === Number(form.data.origin_unit_id)), [allUnits, form.data.origin_unit_id]);

    // Eligible destination units based on mutation type & origin unit
    const destinationOptions = useMemo(() => {
        const originId = Number(form.data.origin_unit_id);

        if (sameUnit) {
            const origin = allUnits.find((u) => u.id === originId);
            return origin ? [origin] : [];
        }

        if (form.data.jenis_mutasi === 'kec_ke_kel') {
            return allUnits.filter((u) => u.type === 'kelurahan');
        }

        if (form.data.jenis_mutasi === 'retur_kel_ke_kec') {
            return allUnits.filter((u) => u.type === 'kecamatan');
        }

        if (form.data.jenis_mutasi === 'antar_kel') {
            return allUnits.filter((u) => u.type === 'kelurahan' && u.id !== originId);
        }

        return allUnits.filter((u) => u.id !== originId);
    }, [allUnits, form.data.jenis_mutasi, form.data.origin_unit_id]);

    // Available assets from selected origin unit
    const availableAssets = useMemo(() => {
        const originId = Number(form.data.origin_unit_id);
        return assets.filter((a) => a.unit_id === originId && a.status === 'aktif' && (!isReturn || a.current_holder != null));
    }, [assets, form.data.origin_unit_id, isReturn]);

    // Eligible pegawais for target holder dropdown
    const targetPegawaiOptions = useMemo(() => {
        const destId = sameUnit ? Number(form.data.origin_unit_id) : Number(form.data.destination_unit_id);

        if (!destId) return [];
        return pegawais.filter((p) => p.unit_id === destId);
    }, [pegawais, form.data.jenis_mutasi, form.data.origin_unit_id, form.data.destination_unit_id]);

    // Handle change of mutation type
    const handleTypeChange = (newType: MutationType) => {
        form.setData((data) => {
            let nextDest = data.destination_unit_id;
            const originId = Number(data.origin_unit_id);

            if (newType === 'internal' || newType === 'pengembalian') {
                nextDest = originId;
            } else if (newType === 'retur_kel_ke_kec') {
                const kec = allUnits.find((u) => u.type === 'kecamatan');
                nextDest = kec ? kec.id : '';
            } else if (nextDest === originId) {
                nextDest = '';
            }

            return {
                ...data,
                jenis_mutasi: newType,
                destination_unit_id: nextDest,
                // reset holders on type change
                items: data.items.map((i) => {
                    const held = assets.find((a) => a.id === Number(i.asset_id))?.current_holder != null;
                    return {
                        ...i,
                        target_holder_id: '',
                        asset_id: newType === 'pengembalian' && !held ? '' : i.asset_id,
                    };
                }),
            };
        });
    };

    const updateItem = (index: number, field: keyof ItemForm, value: string | number) => {
        const newItems = [...form.data.items];
        newItems[index] = { ...newItems[index], [field]: value };
        form.setData('items', newItems);
    };

    const selectableAssets: SelectableAsset[] = useMemo(() => {
        return availableAssets.map((a) => ({
            id: a.id,
            kode_barang: a.kode_barang,
            nomor_register: a.nomor_register,
            nama_aset: a.nama_aset,
            merk_type: a.merk_type,
            kondisi: a.kondisi,
            holder: a.current_holder?.nama,
            unit_id: a.unit_id,
        }));
    }, [availableAssets]);

    const handleConfirmAssets = (newSelected: SelectableAsset[]) => {
        const prevMap = new Map(form.data.items.map((i) => [Number(i.asset_id), i]));

        const nextItems: ItemForm[] = newSelected.map((asset) => {
            const existing = prevMap.get(asset.id);
            if (existing) {
                return existing;
            }
            return {
                asset_id: asset.id,
                target_holder_id: '',
                catatan: '',
            };
        });

        form.setData('items', nextItems.length > 0 ? nextItems : [{ ...EMPTY_ITEM }]);
    };

    const removeItem = (index: number) => {
        const next = form.data.items.filter((_, i) => i !== index);
        form.setData('items', next.length > 0 ? next : [{ ...EMPTY_ITEM }]);
    };

    const hasSelectedAssets = form.data.items.length > 0 && form.data.items.some((i) => Boolean(i.asset_id));

    const submit = () => {
        if (isInternal && form.data.items.some((i) => i.asset_id && !i.target_holder_id)) {
            form.setError('items', 'Mutasi internal wajib menentukan pegawai pemegang baru untuk setiap aset.');
            return;
        }

        // Convert string numbers to integers
        form.transform((data) => ({
            ...data,
            origin_unit_id: Number(data.origin_unit_id),
            destination_unit_id:
                data.jenis_mutasi === 'internal' || data.jenis_mutasi === 'pengembalian' ? Number(data.origin_unit_id) : Number(data.destination_unit_id),
            items: data.items
                .filter((item) => Boolean(item.asset_id))
                .map((item) => ({
                    asset_id: Number(item.asset_id),
                    target_holder_id: data.jenis_mutasi !== 'pengembalian' && item.target_holder_id ? Number(item.target_holder_id) : null,
                    catatan: item.catatan || null,
                })),
        }));

        form.post(route('asset-mutations.store'));
    };

    // Selected asset IDs to prevent picking duplicate assets in multi-item
    const selectedAssetIds = useMemo(() => form.data.items.map((i) => Number(i.asset_id)).filter(Boolean), [form.data.items]);

    const errorCount = Object.keys(errors).length;

    return (
        <AuthenticatedLayout>
            <Head title="Formulir Pengajuan Mutasi Aset" />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Mutasi Aset', href: route('asset-mutations.index') }, { label: 'Ajukan Mutasi' }]}
                    title="Formulir Pengajuan Mutasi Aset"
                />

                <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                        <div className="border-b border-slate-100 pb-3">
                            <h2 className="text-base font-semibold text-slate-900">Informasi Dokumen &amp; Alur Mutasi</h2>
                            <p className="text-xs text-slate-500">Identitas surat pengajuan dan relasi unit kerja yang terlibat</p>
                        </div>

                        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
                            <Input
                                label="Nomor Dokumen Mutasi"
                                isRequired
                                placeholder="MUT/YYYYMMDD/XXXX"
                                value={form.data.nomor_mutasi}
                                onChange={(v) => form.setData('nomor_mutasi', v)}
                                isInvalid={Boolean(errors.nomor_mutasi)}
                                hint={errors.nomor_mutasi}
                            />
                            <Input
                                label="Tanggal Mutasi"
                                type="date"
                                isRequired
                                value={form.data.tanggal_mutasi}
                                onChange={(v) => form.setData('tanggal_mutasi', v)}
                                isInvalid={Boolean(errors.tanggal_mutasi)}
                                hint={errors.tanggal_mutasi}
                            />
                            <Select
                                label="Jenis Mutasi"
                                isRequired
                                items={originUnit?.type === 'kecamatan' ? KECAMATAN_TYPES : KELURAHAN_TYPES}
                                selectedKey={form.data.jenis_mutasi}
                                onSelectionChange={(key) => handleTypeChange(String(key) as MutationType)}
                                isInvalid={Boolean(errors.jenis_mutasi)}
                                hint={
                                    errors.jenis_mutasi ??
                                    (isReturn
                                        ? 'Aset kembali menjadi stok unit setelah disetujui. Untuk memindahkan langsung ke pegawai lain gunakan Mutasi Internal.'
                                        : undefined)
                                }
                            >
                                {(item) => <Select.Item id={item.id} label={item.label} />}
                            </Select>
                            <Select
                                label="Unit Asal"
                                isRequired
                                items={units.map((u) => ({ id: String(u.id), label: u.name }))}
                                selectedKey={String(form.data.origin_unit_id)}
                                isDisabled={units.length <= 1}
                                onSelectionChange={(key) => {
                                    const newOriginId = Number(key);
                                    form.setData((d) => ({
                                        ...d,
                                        origin_unit_id: newOriginId,
                                        destination_unit_id: d.jenis_mutasi === 'internal' || d.jenis_mutasi === 'pengembalian' ? newOriginId : '',
                                        items: [{ ...EMPTY_ITEM }],
                                    }));
                                }}
                            >
                                {(item) => <Select.Item id={item.id} label={item.label} />}
                            </Select>

                            {!sameUnit && (
                                <div className="md:col-span-2">
                                    <Select
                                        label="Unit Tujuan"
                                        isRequired
                                        placeholder="Pilih unit tujuan..."
                                        items={destinationOptions.map((u) => ({ id: String(u.id), label: `${u.name} (${u.type})` }))}
                                        selectedKey={form.data.destination_unit_id ? String(form.data.destination_unit_id) : null}
                                        onSelectionChange={(key) => form.setData('destination_unit_id', String(key))}
                                        isInvalid={Boolean(errors.destination_unit_id)}
                                        hint={errors.destination_unit_id}
                                    >
                                        {(item) => <Select.Item id={item.id} label={item.label} />}
                                    </Select>
                                </div>
                            )}

                            <div className="md:col-span-2">
                                <TextArea
                                    label={`Keterangan / Alasan ${isReturn ? 'Pengembalian' : 'Mutasi'}`}
                                    isRequired={isReturn}
                                    rows={2}
                                    placeholder="Tuliskan catatan atau latar belakang pengalihan aset ini..."
                                    value={form.data.keterangan}
                                    onChange={(v) => form.setData('keterangan', v)}
                                    isInvalid={Boolean(errors.keterangan)}
                                    hint={errors.keterangan}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                        <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-base font-semibold text-slate-900">Daftar Aset yang Dimutasi</h2>
                                <p className="text-xs text-slate-500">
                                    Pilih barang aktif yang akan diserahterimakan (tersedia {availableAssets.length} aset aktif di {originUnit?.name}).
                                </p>
                            </div>
                            {hasSelectedAssets && (
                                <Button color="secondary-brand" size="md" iconLeading={Plus} onPress={() => setIsModalOpen(true)}>
                                    Tambah / Ubah Pilihan Aset
                                </Button>
                            )}
                        </div>

                        {errors.items && <p className="mt-3 text-xs font-medium text-red-600">{errors.items}</p>}

                        {!hasSelectedAssets ? (
                            <div className="mt-6 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-8 text-center">
                                <h3 className="text-base font-bold text-slate-900">Belum Ada Aset yang Dipilih</h3>
                                <p className="mt-1 max-w-md text-xs text-slate-500">
                                    Pilih satu atau beberapa aset aktif di {originUnit?.name ?? 'unit asal'} yang akan dialihkan ke unit tujuan.
                                </p>
                                <Button className="mt-4" color="primary" size="md" iconLeading={Plus} onPress={() => setIsModalOpen(true)}>
                                    Buka Daftar &amp; Pilih Aset ({availableAssets.length} Tersedia)
                                </Button>
                            </div>
                        ) : (
                            <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                                <Table aria-label="Aset yang akan dimutasi" size="sm">
                                    <Table.Header>
                                        <Table.Head id="aset" label="Barang / Aset" isRowHeader />
                                        <Table.Head id="asal" label="Pemegang Asal" />
                                        {!isReturn && <Table.Head id="baru" label="Pemegang Baru di Tujuan" />}
                                        <Table.Head id="catatan" label="Catatan Barang" />
                                        <Table.Head id="aksi" label="Aksi" />
                                    </Table.Header>
                                    <Table.Body items={form.data.items.filter((item) => assets.some((a) => a.id === Number(item.asset_id)))}>
                                        {(item) => {
                                            const idx = form.data.items.indexOf(item);
                                            const selectedAsset = assets.find((a) => a.id === Number(item.asset_id))!;
                                            const holderError = errors[`items.${idx}.target_holder_id`];

                                            return (
                                                <Table.Row id={selectedAsset.id}>
                                                    <Table.Cell>
                                                        <span className="font-semibold text-slate-900">{selectedAsset.nama_aset}</span>
                                                        <span className="mt-0.5 block text-xs text-slate-500">
                                                            <span className="font-mono">{selectedAsset.kode_barang}</span> • Reg. #
                                                            {String(selectedAsset.nomor_register).padStart(4, '0')}
                                                            {selectedAsset.merk_type && <> • {selectedAsset.merk_type}</>}
                                                        </span>
                                                    </Table.Cell>
                                                    <Table.Cell className="whitespace-nowrap text-xs">
                                                        {selectedAsset.current_holder ? (
                                                            <span className="font-medium text-slate-800">{selectedAsset.current_holder.nama}</span>
                                                        ) : (
                                                            <span className="italic text-slate-400">Inventaris Unit</span>
                                                        )}
                                                    </Table.Cell>
                                                    {!isReturn && (
                                                        <Table.Cell className="min-w-56">
                                                            <Select
                                                                aria-label={`Pemegang baru ${selectedAsset.nama_aset}`}
                                                                size="sm"
                                                                placeholder="Pilih pegawai baru"
                                                                items={[
                                                                    ...(isInternal ? [] : [{ id: NONE, label: 'Inventaris Unit' }]),
                                                                    ...targetPegawaiOptions.map((p) => ({ id: String(p.id), label: `${p.nama} (${p.jabatan})` })),
                                                                ]}
                                                                selectedKey={item.target_holder_id ? String(item.target_holder_id) : isInternal ? null : NONE}
                                                                onSelectionChange={(key) => updateItem(idx, 'target_holder_id', key === NONE ? '' : String(key))}
                                                                isInvalid={Boolean(holderError)}
                                                                hint={holderError}
                                                            >
                                                                {(opt) => <Select.Item id={opt.id} label={opt.label} />}
                                                            </Select>
                                                        </Table.Cell>
                                                    )}
                                                    <Table.Cell className="min-w-48">
                                                        <Input
                                                            aria-label={`Catatan ${selectedAsset.nama_aset}`}
                                                            size="sm"
                                                            placeholder="Catatan kondisi/kelengkapan..."
                                                            value={item.catatan}
                                                            onChange={(v) => updateItem(idx, 'catatan', v)}
                                                        />
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <Button
                                                            color="secondary-destructive"
                                                            size="sm"
                                                            iconLeading={Trash01}
                                                            aria-label={`Hapus ${selectedAsset.nama_aset} dari mutasi`}
                                                            onPress={() => removeItem(idx)}
                                                        />
                                                    </Table.Cell>
                                                </Table.Row>
                                            );
                                        }}
                                    </Table.Body>
                                </Table>
                            </div>
                        )}
                    </div>

                    <div className="sticky bottom-0 z-20 -mx-6 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur-xs lg:-mx-8 lg:px-8">
                        <div className="flex items-center justify-between gap-3">
                            <p role="alert" className="text-sm font-medium text-red-600">
                                {errorCount > 0 && `${errorCount} isian perlu diperbaiki`}
                            </p>
                            <div className="flex items-center gap-3">
                                <Button color="secondary" size="md" href={route('asset-mutations.index')}>
                                    Batal
                                </Button>
                                <Button color="primary" size="md" isLoading={form.processing} onPress={submit}>
                                    Kirim Pengajuan Mutasi
                                </Button>
                            </div>
                        </div>
                    </div>
                </form>

                <AssetSelectModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    assets={selectableAssets}
                    selectedIds={selectedAssetIds}
                    onConfirm={handleConfirmAssets}
                    mode="multiple"
                    title={`Pilih Aset dari ${originUnit?.name ?? 'Unit Asal'}`}
                    description={`Centang aset yang ingin dipindahkan (${availableAssets.length} aset aktif tersedia).`}
                />
            </div>
        </AuthenticatedLayout>
    );
}
```
Perbedaan perilaku yang disengaja: validasi `required` bawaan browser diganti validasi server (pesan tampil di bawah field dan ringkasan di bilah lengket), sama seperti formulir Penerimaan. Server (`StoreAssetMutationRequest`) mewajibkan `keterangan` untuk pengembalian; "pegawai baru wajib" pada Mutasi Internal hanya dijaga `AssetMutationService` (melempar galat setelah kirim), sehingga `submit` menambah pemeriksaan klien kecil (`form.setError('items', …)`) agar pesannya tampil seketika tanpa perjalanan ke server.

- [ ] **Step 2: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
php artisan test --compact --filter='Mutation|Mutasi'
git add resources/js/Pages/AssetMutations/Create.tsx
git commit -m "feat(ui): migrate the mutation form to Untitled UI components"
```
Expected: bersih; test hijau.

---

### Task 5: `AssetMutations/Show` dan gerbang

**Files:**
- Modify: `resources/js/Pages/AssetMutations/Show.tsx` (ganti seluruh isi)

**Interfaces:**
- Consumes: `PageHeader`, `ApprovalStepper`, `ApprovalTimeline`, `RejectRequestModal`, `CancelRequestModal`, `ReassignApproverModal`, `Table`, `Badge`, `Button`, `ModalOverlay`/`Modal`/`Dialog`, `rupiah`/`tanggal`/`tanggalWaktu`, `lib/mutasi`, `KONDISI_*` dari `lib/assetReport`; ikon `ArrowRight`, `Eye`, `Printer`, `XClose`.

- [ ] **Step 1: Tulis ulang `Show.tsx`**

```tsx
import ApprovalStepper from '@/Components/ApprovalStepper';
import ApprovalTimeline from '@/Components/ApprovalTimeline';
import CancelRequestModal from '@/Components/CancelRequestModal';
import PageHeader from '@/Components/PageHeader';
import ReassignApproverModal from '@/Components/ReassignApproverModal';
import RejectRequestModal from '@/Components/RejectRequestModal';
import { Dialog, Modal, ModalOverlay } from '@/Components/ui/application/modals/modal';
import { Table } from '@/Components/ui/application/table/table';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_BADGE_COLOR, KONDISI_LABEL } from '@/lib/assetReport';
import { rupiah, tanggal, tanggalWaktu } from '@/lib/format';
import { MUTATION_STATUS_COLOR, MUTATION_STATUS_LABEL, MUTATION_TYPE_COLOR, MUTATION_TYPE_LABEL } from '@/lib/mutasi';
import { ApprovalStep, AssetMutation, AssetPhoto, PageProps, Pegawai, ReassignCandidate } from '@/types';
import { Head, router } from '@inertiajs/react';
import { ArrowRight, Eye, Printer, XClose } from '@untitledui/icons';
import { useState } from 'react';

interface ShowProps extends PageProps {
    mutation: AssetMutation;
    can: { act: boolean; cancel: boolean; reassign: boolean };
    reassignCandidates: ReassignCandidate[];
}

export default function Show({ mutation, can, reassignCandidates }: ShowProps) {
    const [showReject, setShowReject] = useState(false);
    const [showCancel, setShowCancel] = useState(false);
    const [showReassign, setShowReassign] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [activePhoto, setActivePhoto] = useState<AssetPhoto | null>(null);

    const req = mutation.approval_request;
    const steps = req?.steps ?? [];
    const items = mutation.items ?? [];
    const isPending = mutation.status === 'pending';

    const totalNilaiPerolehan = items.reduce((sum, item) => sum + Number(item.asset?.nilai_perolehan ?? 0), 0);

    const approve = () => {
        if (!req || submitting) return;
        setSubmitting(true);
        router.post(route('approval-requests.approve', req.id), {}, { preserveScroll: true, onFinish: () => setSubmitting(false) });
    };

    const stepTitle = (step: ApprovalStep): string => {
        if (step.unit_scope === 'origin' && mutation.origin_unit?.name) return `${step.label} (${mutation.origin_unit.name})`;
        if (step.unit_scope === 'destination' && mutation.destination_unit?.name) return `${step.label} (${mutation.destination_unit.name})`;
        return step.label;
    };

    const rejectionAction = req?.actions?.find((a) => a.action === 'reject');
    const cancelAction = req?.actions?.find((a) => a.action === 'cancel');

    return (
        <AuthenticatedLayout>
            <Head title={`Mutasi Aset #${mutation.nomor_mutasi}`} />

            <div className="space-y-6">
                <div className="print:hidden">
                    <PageHeader
                        crumbs={[{ label: 'Mutasi Aset', href: route('asset-mutations.index') }, { label: 'Detail' }]}
                        title={`Mutasi #${mutation.nomor_mutasi}`}
                        badges={
                            <>
                                <Badge type="color" size="sm" color={MUTATION_STATUS_COLOR[mutation.status]} className="rounded-sm">
                                    {MUTATION_STATUS_LABEL[mutation.status]}
                                </Badge>
                                <Badge type="color" size="sm" color={MUTATION_TYPE_COLOR[mutation.jenis_mutasi]} className="rounded-sm">
                                    {MUTATION_TYPE_LABEL[mutation.jenis_mutasi]}
                                </Badge>
                            </>
                        }
                        actions={
                            <>
                                <Button color="secondary-violet" size="md" iconLeading={Printer} onPress={() => window.print()}>
                                    Cetak
                                </Button>
                                {can.cancel && isPending && (
                                    <Button color="secondary" size="md" onPress={() => setShowCancel(true)}>
                                        Batalkan Pengajuan
                                    </Button>
                                )}
                                {can.reassign && isPending && (
                                    <Button color="secondary" size="md" onPress={() => setShowReassign(true)}>
                                        Alihkan Approver
                                    </Button>
                                )}
                                {can.act && isPending && (
                                    <>
                                        <Button color="secondary-destructive" size="md" isDisabled={submitting} onPress={() => setShowReject(true)}>
                                            Tolak
                                        </Button>
                                        <Button color="primary" size="md" isLoading={submitting} onPress={approve}>
                                            Setujui
                                        </Button>
                                    </>
                                )}
                                <Button color="secondary" size="md" href={route('asset-mutations.index')}>
                                    Kembali
                                </Button>
                            </>
                        }
                    />
                </div>

                {/* Judul cetak (hanya tampil saat dicetak) */}
                <div className="hidden border-b border-slate-300 pb-4 print:block">
                    <h1 className="text-xl font-bold uppercase text-slate-900">Berita Acara Mutasi Aset</h1>
                    <p className="text-xs text-slate-600">
                        Nomor: {mutation.nomor_mutasi} • Tanggal: {tanggal(mutation.tanggal_mutasi)}
                    </p>
                </div>

                {mutation.status === 'rejected' && rejectionAction && (
                    <div className="rounded-xl border border-red-200 bg-red-50/70 p-4 text-sm text-red-900 shadow-xs">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                                <XClose className="size-3.5" aria-hidden="true" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-semibold text-red-900">Pengajuan Mutasi Ini Ditolak</h3>
                                <p className="text-xs text-red-700">
                                    Ditolak oleh <span className="font-medium">{rejectionAction.user?.name ?? 'Pejabat Pemeriksa'}</span> pada{' '}
                                    {tanggalWaktu(rejectionAction.created_at)}
                                </p>
                                {rejectionAction.note && (
                                    <div className="mt-2 rounded-lg border border-red-200/60 bg-white p-3 text-xs italic text-red-800">
                                        &ldquo;{rejectionAction.note}&rdquo;
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {mutation.status === 'cancelled' && cancelAction && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800 shadow-xs">
                        <h3 className="font-semibold">Pengajuan Mutasi Ini Dibatalkan</h3>
                        <p className="text-xs text-slate-600">
                            Dibatalkan oleh <span className="font-medium">{cancelAction.user?.name ?? 'pengaju'}</span> pada{' '}
                            {tanggalWaktu(cancelAction.created_at)}
                        </p>
                        {cancelAction.note && (
                            <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3 text-xs italic">&ldquo;{cancelAction.note}&rdquo;</div>
                        )}
                    </div>
                )}

                {req && <ApprovalStepper request={req} titleFor={stepTitle} />}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                            <h2 className="text-sm font-bold text-slate-900">Informasi Pengajuan Dokumen</h2>
                            <span className="text-xs text-slate-400">ID #{mutation.id}</span>
                        </div>

                        <dl className="divide-y divide-slate-100 text-sm">
                            <div className="flex items-center justify-between py-2.5">
                                <dt className="font-medium text-slate-500">Nomor Mutasi</dt>
                                <dd className="font-mono font-semibold text-slate-900">{mutation.nomor_mutasi}</dd>
                            </div>
                            <div className="flex items-center justify-between py-2.5">
                                <dt className="font-medium text-slate-500">Tanggal Mutasi</dt>
                                <dd className="text-slate-900">{tanggal(mutation.tanggal_mutasi)}</dd>
                            </div>
                            <div className="flex items-center justify-between py-2.5">
                                <dt className="font-medium text-slate-500">Jenis Perpindahan</dt>
                                <dd>
                                    <Badge type="color" size="sm" color={MUTATION_TYPE_COLOR[mutation.jenis_mutasi]} className="rounded-sm">
                                        {MUTATION_TYPE_LABEL[mutation.jenis_mutasi]}
                                    </Badge>
                                </dd>
                            </div>
                            <div className="flex items-center justify-between py-2.5">
                                <dt className="font-medium text-slate-500">Diajukan Oleh</dt>
                                <dd className="font-medium text-slate-900">{mutation.creator?.name ?? '—'}</dd>
                            </div>
                            <div className="py-2.5">
                                <dt className="mb-1 font-medium text-slate-500">Catatan / Keterangan Mutasi</dt>
                                <dd className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
                                    {mutation.keterangan || 'Tidak ada catatan tambahan untuk mutasi ini.'}
                                </dd>
                            </div>
                        </dl>
                    </div>

                    <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                        <div>
                            <div className="mb-4 border-b border-slate-100 pb-3">
                                <h2 className="text-sm font-bold text-slate-900">Alur Pemindahan Unit Kerja</h2>
                                <p className="text-xs text-slate-500">Perpindahan kepemilikan dan penatausahaan aset</p>
                            </div>

                            <div className="my-4 flex flex-col items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/70 p-5 sm:flex-row">
                                <div className="w-full text-center sm:w-5/12 sm:text-left">
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Unit Asal (Pengirim)</span>
                                    <p className="mt-1 text-base font-bold text-slate-900">{mutation.origin_unit?.name ?? '—'}</p>
                                    <Badge type="color" size="sm" color="gray" className="mt-1 rounded-sm capitalize">
                                        {mutation.origin_unit?.type ?? 'Unit'}
                                    </Badge>
                                </div>

                                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 max-sm:rotate-90">
                                    <ArrowRight className="size-5" aria-hidden="true" />
                                </div>

                                <div className="w-full text-center sm:w-5/12 sm:text-right">
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Unit Tujuan (Penerima)</span>
                                    <p className="mt-1 text-base font-bold text-slate-900">{mutation.destination_unit?.name ?? '—'}</p>
                                    <Badge type="color" size="sm" color="blue" className="mt-1 rounded-sm capitalize">
                                        {mutation.destination_unit?.type ?? 'Unit'}
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-3">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <span className="text-xs text-slate-500">Jumlah Aset Dipindahkan</span>
                                <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{items.length} Item</p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <span className="text-xs text-slate-500">Total Nilai Perolehan</span>
                                <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{rupiah(totalNilaiPerolehan)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    <div className="border-b border-slate-200 px-6 py-4">
                        <h2 className="text-base font-bold text-slate-900">Daftar Aset yang Dimutasi</h2>
                        <p className="text-xs text-slate-500">Rincian fisik, nilai perolehan, dan peralihan pemegang aset</p>
                    </div>

                    <Table aria-label="Aset yang dimutasi" size="sm">
                        <Table.Header>
                            <Table.Head id="no" label="No" isRowHeader />
                            <Table.Head id="kode" label="Kode & Register" />
                            <Table.Head id="nama" label="Nama & Kategori Aset" />
                            <Table.Head id="nilai" label="Nilai Perolehan" />
                            <Table.Head id="pemegang" label="Peralihan Pemegang" />
                            <Table.Head id="kondisi" label="Kondisi" />
                            <Table.Head id="catatan" label="Catatan Item" />
                        </Table.Header>
                        <Table.Body
                            items={items}
                            renderEmptyState={() => <p className="py-8 text-center text-sm text-slate-500">Tidak ada aset yang terdaftar pada mutasi ini.</p>}
                        >
                            {(item) => {
                                const asset = item.asset;
                                const oldHolder =
                                    item.origin_holder ?? asset?.current_holder ?? (asset as unknown as { currentHolder?: Pegawai })?.currentHolder;
                                const newHolder = item.target_holder ?? (item as unknown as { targetHolder?: Pegawai })?.targetHolder;
                                const kondisi = asset?.kondisi ?? 'baik';

                                return (
                                    <Table.Row id={item.id}>
                                        <Table.Cell className="font-medium tabular-nums text-slate-500">{items.indexOf(item) + 1}</Table.Cell>
                                        <Table.Cell>
                                            <span className="font-mono text-xs font-bold text-slate-900">{asset?.kode_barang ?? '—'}</span>
                                            <span className="block font-mono text-[11px] text-slate-500">
                                                Reg: {asset?.nomor_register != null ? String(asset.nomor_register).padStart(4, '0') : '—'}
                                            </span>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <span className="font-semibold text-slate-900">{asset?.nama_aset ?? '—'}</span>
                                            <span className="block text-xs text-slate-500">
                                                {asset?.category?.name ?? 'Tanpa Kategori'}
                                                {asset?.merk_type ? ` • ${asset.merk_type}` : ''}
                                            </span>
                                        </Table.Cell>
                                        <Table.Cell className="whitespace-nowrap text-right font-medium tabular-nums text-slate-900">
                                            {asset?.nilai_perolehan ? rupiah(Number(asset.nilai_perolehan)) : '—'}
                                        </Table.Cell>
                                        <Table.Cell>
                                            <span className="flex items-center gap-1.5 text-xs">
                                                <span className={`font-medium ${oldHolder?.nama ? 'text-slate-800' : 'italic text-slate-400'}`}>
                                                    {oldHolder?.nama ?? 'Belum ada'}
                                                </span>
                                                <ArrowRight className="size-3.5 shrink-0 text-blue-600" aria-hidden="true" />
                                                <span className={`font-medium ${newHolder?.nama ? 'text-blue-900' : 'italic text-slate-500'}`}>
                                                    {newHolder?.nama ??
                                                        (mutation.jenis_mutasi === 'pengembalian'
                                                            ? 'Inventaris unit'
                                                            : (mutation.destination_unit?.name ?? 'Unit Penerima'))}
                                                </span>
                                            </span>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Badge type="color" size="sm" color={KONDISI_BADGE_COLOR[kondisi] ?? 'gray'} className="rounded-sm">
                                                {KONDISI_LABEL[kondisi] ?? kondisi}
                                            </Badge>
                                        </Table.Cell>
                                        <Table.Cell className="text-xs text-slate-600">{item.catatan || '—'}</Table.Cell>
                                    </Table.Row>
                                );
                            }}
                        </Table.Body>
                    </Table>

                </div>

                {mutation.photos && mutation.photos.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                        <h2 className="mb-1 text-base font-bold text-slate-900">Lampiran Dokumentasi Fisik &amp; Berkas</h2>
                        <p className="mb-4 text-xs text-slate-500">Dokumentasi foto kondisi aset saat proses mutasi</p>

                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                            {mutation.photos.map((photo, idx) => (
                                <button
                                    key={photo.id}
                                    type="button"
                                    onClick={() => setActivePhoto(photo)}
                                    aria-label={`Perbesar foto dokumentasi ${idx + 1}`}
                                    className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-slate-100 outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
                                >
                                    <img src={photo.url} alt="" className="size-full object-cover" />
                                    <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                                        <Eye className="size-6 text-white" aria-hidden="true" />
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {req && (
                    <ApprovalTimeline
                        request={req}
                        createdTitle="Pengajuan Mutasi Dibuat"
                        creatorName={mutation.creator?.name}
                        createdAt={mutation.tanggal_mutasi}
                    />
                )}
            </div>

            {showCancel && req && (
                <CancelRequestModal
                    approvalRequestId={req.id}
                    onClose={() => setShowCancel(false)}
                    description="Pengajuan dihentikan dan aset yang diajukan dikembalikan ke status Aktif di unit asal. Persetujuan yang sudah diberikan ikut hangus."
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

            {showReject && req && (
                <RejectRequestModal
                    approvalRequestId={req.id}
                    onClose={() => setShowReject(false)}
                    description="Silakan tuliskan alasan penolakan mutasi secara jelas. Aset yang diajukan akan otomatis dikembalikan ke status “Aktif” di unit asal."
                />
            )}

            <ModalOverlay isOpen={activePhoto !== null} isDismissable onOpenChange={(open) => !open && setActivePhoto(null)}>
                <Modal className="sm:max-w-3xl">
                    <Dialog aria-label="Foto dokumentasi mutasi">
                        {activePhoto && <img src={activePhoto.url} alt="Foto dokumentasi mutasi" className="max-h-[80vh] w-full rounded-xl object-contain" />}
                    </Dialog>
                </Modal>
            </ModalOverlay>
        </AuthenticatedLayout>
    );
}
```
Perbedaan perilaku yang disengaja: `Cetak`/`Kembali` kini di dalam pembungkus `print:hidden` (sama dengan sebelumnya); modal Tolak memakai komponen bersama (tombol "Ya, Tolak" menggantikan "Ya, Tolak Mutasi"); status Dibatalkan pada stepper tampil di langkah berjalan; `&bull;` literal diperbaiki.

- [ ] **Step 2: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
grep -rn "@/Components/Icons\|window.confirm" resources/js/Pages/AssetMutations resources/js/Components/AssetSelectModal.tsx resources/js/Components/RejectRequestModal.tsx resources/js/Components/ApprovalStepper.tsx resources/js/Components/ApprovalTimeline.tsx
php artisan test --compact --filter='Mutation|Mutasi|Penerimaan|Approval|Persetujuan|AssetReport|AssetRequest'
git add resources/js/Pages/AssetMutations/Show.tsx
git commit -m "feat(ui): migrate the mutation detail page to Untitled UI components"
```
Expected: bersih; `grep` kosong; test hijau.

- [ ] **Step 3: Cek runtime singkat dan GERBANG MUTASI — berhenti**

Cek di browser headless (super-admin untuk daftar/detail; `admin.kecamatan@simaset.test` / `password` untuk formulir bila akunnya ada): daftar (filter, pencarian, pagination), formulir (jenis berganti, buka dialog pilih aset, pilih/hapus, kirim kosong untuk galat tanpa menyimpan), detail (stepper, linimasa, dialog Batalkan/Alihkan/Tolak tanpa dikonfirmasi, lightbox bila ada foto), serta Penerimaan Show, Lapor Create, dan Permohonan Show (dialog pilih aset).

Laporkan hasil Task 1–5, `Ruling`, dan hal yang tak bisa diverifikasi tanpa browser pengguna. Minta pengguna memeriksa:
- **Daftar**: filter Jenis alur/Urutkan, pencarian, badge jenis (indigo/biru/ungu/abu/kuning) dan status, kolom Alur dengan panah, tabel muat tanpa gulir samping di laptop, pagination yang mempertahankan filter.
- **Formulir**: pilihan Jenis Mutasi mengikuti jenis unit asal, Unit Tujuan hanya untuk jenis lintas unit, dialog pilih aset (cari, centang, pilih semua halaman, pindah halaman tanpa kehilangan pilihan, "Gunakan (N) Aset Terpilih"), tabel aset terpilih (pegawai baru wajib untuk Internal, "Inventaris Unit" untuk jenis lain, hilang untuk Pengembalian), galat per field dan ringkasan di bilah lengket.
- **Detail**: badge status+jenis di samping judul, tombol sesuai izin dan status, banner Ditolak/Dibatalkan, stepper (nama approver di langkah selesai), kartu alur unit, tabel aset dengan total di bawah, galeri foto + lightbox, linimasa, dialog Batalkan/Alihkan/Tolak, **pratinjau cetak** (hanya judul cetak dan isi, tanpa tombol).
- **Efek ke halaman lain**: Penerimaan Show (stepper/linimasa/dialog Tolak versi bersama), Lapor Create dan Permohonan Show (dialog pilih aset).
- Keyboard (Tab/Spasi/Esc), layar 375 px, cincin fokus.
**Jangan memulai modul berikutnya** sebelum pengguna menyatakan lolos.

---

## Catatan Review (ponytail + impeccable, sudah diterapkan)

- Ponytail: komponen bersama baru (`RejectRequestModal`, `ApprovalStepper`, `ApprovalTimeline`, `lib/mutasi.ts`) masing-masing sudah punya ≥2 konsumen (Mutasi + Penerimaan) atau akan segera (Permohonan, Lapor), jadi tidak spekulatif. Baris total di bawah tabel Show dihapus karena duplikat kartu metrik (−8 baris, tanpa pengganti `tfoot`).
- Impeccable (mode Operate): pemilihan aset memakai seleksi bawaan React Aria (keyboard, pilih-semua, status terbaca pembaca layar) alih-alih checkbox buatan; pilihan lintas halaman dipertahankan. Mode `single` tetap menampilkan kotak centang di tiap baris (tidak ada radio di `Table`); diterima karena hanya satu baris yang bisa terpilih dan jumlah terpilih tampil di footer. Aturan Mutasi Internal (pegawai baru wajib) dicek di klien agar galat tampil seketika; sumbernya dicek: hanya dijaga service, bukan form request.
- Dicek saat eksekusi: tinggi dialog `AssetSelectModal` (hanya tabel yang menggulir), `Button className` dan `Select` ukuran `sm` di sel tabel, pratinjau cetak Show.
