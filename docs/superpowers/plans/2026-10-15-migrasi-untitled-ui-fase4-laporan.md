# Migrasi Untitled UI, Fase 4: Laporan (Aset, Mutasi, Rusak & Hilang) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memigrasikan tiga halaman Laporan (`LaporanAset/Index`, `LaporanMutasi/Index`, `LaporanRusakHilang/Index`) ke komponen Untitled UI tanpa mengubah perilaku, props Inertia, atau backend. Ketiganya hampir kembar (bilah filter dengan "Terapkan filter" + "Unduh Excel", kartu ringkasan, donat + legenda, tabel rekap dengan baris total, tabel rinci yang bisa diurutkan dan dibuka per baris, paginasi), jadi logika dan potongan tampilan yang berulang diekstrak sekali.

**Architecture:** Hanya frontend. Satu hook (`lib/use-laporan-filters.ts`) memindahkan logika filter/urut/unduh yang kini disalin tiga kali, tanpa mengubah perilakunya. Lima komponen bersama (`ReportFilterBar`, `StatCard`, `ChartLegend`, `ReportCard`, `SummaryTable`, `ReportDetailTable`) dipakai ketiga halaman. Grafik (`Components/Charts/*`) tidak diubah; warna grafik dibahas pada modul Dashboard.

**Tech Stack:** React 19, Inertia 2, Tailwind 4, Untitled UI (React Aria Components), `@untitledui/icons`.

**Spec:** `docs/superpowers/specs/2026-10-14-migrasi-untitled-ui-design.md` §3.5 butir 4 (Laporan). Pola acuan: plan Mutasi dan Penerimaan.

## Global Constraints

- Hanya komponen Untitled UI gratis. Perilaku tidak berubah: filter diterapkan hanya saat "Terapkan filter" ditekan (`dirty` menonaktifkan unduhan), `visit` dengan `preserveState: 'errors'`, `replace`, `urut`/`arah` terbawa, urut klik kolom (naik lalu turun), paginasi, banner galat dari `errors`, `downloadUrl` dari filter yang sudah diterapkan, baris rinci yang bisa dibuka, props Inertia, nama berkas. `Components/Charts/*`, `lib/chartColors.ts`, `ListFilters.tsx`, `lib/pagination.ts` tidak diubah.
- **Unduhan bukan kunjungan Inertia**: "Unduh Excel" memakai `window.location.href = downloadUrl` (pola `ImportExportButtons`), bukan `Button href` (yang lewat `RouterProvider` dan akan menjadi kunjungan Inertia untuk respons berkas).
- Warna tombol: "Terapkan filter" `secondary`; "Unduh Excel" `primary` (aksi utama halaman laporan); tombol buka-baris `tertiary`. Badge `type="color" size="sm" className="rounded-sm"`; kondisi memakai `KONDISI_BADGE_COLOR`, status memakai `MUTATION_STATUS_COLOR` (peta sama untuk status laporan: pending/approved/rejected/cancelled).
- Kunci kosong tidak valid pada `Select`: filter memakai kunci `__all` yang dipetakan ke `''`. `Input type="date"` tidak meneruskan atribut tambahan; tidak diperlukan.
- Perbedaan perilaku yang disengaja: (1) baris rinci dibuka lewat tombol panah di kolom "No" (bukan klik di seluruh baris), supaya tombol punya `aria-expanded` dan dapat difokus; (2) baris Total pada tabel rekap tidak tampil bila tabelnya kosong (sebelumnya menampilkan nol); (3) tabel bersarang di panel rinci Mutasi tetap `<table>` HTML biasa (bukan `Table` React Aria) agar tidak ada grid di dalam grid.
- Impor `@/Components/...` berhuruf besar; tanpa `@/Components/Icons`; tanpa dependensi baru.
- Verifikasi: `npx tsc --noEmit`, `npm run build`, test backend `--filter='Laporan'`. Cek runtime singkat diperbolehkan; penilaian visual oleh pengguna di gerbang.
- Git: commit per task di `main`, tanpa trailer Co-Authored-By, stage dengan path eksplisit, tanpa push.

## Review Focus

1. **Hook `useLaporanFilters`** harus identik dengan logika lama (`clean`, `signature`, `visit`, `set`, `sortBy`, `downloadUrl`). Pagar: kode disalin apa adanya (Task 1); test backend + butir gerbang (terapkan filter, urut, paginasi).
2. **Urut kolom**: `Table` React Aria memberi arah berikutnya sendiri, tetapi hook menghitung arah dari `sort` (naik bila bukan kolom aktif atau sedang turun, turun bila sedang naik) agar sama dengan perilaku lama; `onSortChange` hanya meneruskan kolom. Pagar: Task 1 (`ReportDetailTable`).
3. **Baris rinci yang dibuka** memakai baris tambahan `colSpan` penuh; tinggi baris `h-auto`. Pagar: Task 1; butir gerbang.
4. **Unduh Excel** nonaktif saat `dirty` atau `total === 0`; unduhan tidak boleh memicu modal galat Inertia. Pagar: Task 1 (`window.location.href`).
5. **Tabel rekap bertingkat** (kategori → subkategori): indentasi subkategori dan total tetap terbaca. Pagar: Task 2.
6. **Tampilan cetak/layar lebar**: kartu ringkasan 5 kolom (Mutasi/Rusak) tidak boleh memotong angka rupiah panjang. Pagar: `StatCard` memakai `break-words`/`tabular-nums` (Task 1); butir gerbang pada lebar laptop.

---

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `resources/js/lib/use-laporan-filters.ts` | Logika filter/urut/unduh bersama |
| `resources/js/lib/format.ts` | Tambah `tanggalSingkat` |
| `resources/js/Components/ReportFilterBar.tsx` | Kartu filter + Terapkan + hitungan + Unduh, banner galat, `ReportSelect`, `ReportDate` |
| `resources/js/Components/StatCard.tsx` | Kartu angka ringkasan |
| `resources/js/Components/ChartLegend.tsx` | Legenda donat |
| `resources/js/Components/ReportCard.tsx` | Kartu berjudul (berisi grafik atau tabel) |
| `resources/js/Components/SummaryTable.tsx` | Tabel ringkas dengan baris total opsional |
| `resources/js/Components/ReportDetailTable.tsx` | Tabel rinci terurut, baris bisa dibuka, paginasi |
| `resources/js/Pages/Laporan{Aset,Mutasi,RusakHilang}/Index.tsx` | Tiga halaman |

---

### Task 1: Fondasi bersama

**Files:**
- Create: `resources/js/lib/use-laporan-filters.ts`, `resources/js/Components/{ReportFilterBar,StatCard,ChartLegend,ReportCard,SummaryTable,ReportDetailTable}.tsx`
- Modify: `resources/js/lib/format.ts`

- [ ] **Step 1: `lib/format.ts`**

Tambahkan di akhir berkas:
```ts
/** "2026-10-14" -> "14/10/2026"; kosong -> "—". */
export const tanggalSingkat = (value?: string | null): string => (value ? new Date(value).toLocaleDateString('id-ID') : '—');
```

- [ ] **Step 2: `lib/use-laporan-filters.ts`**

```ts
import { router } from '@inertiajs/react';
import { useState } from 'react';

export type ReportFilters = Record<string, string | number | undefined>;

export interface ReportSort {
    urut: string;
    arah: 'asc' | 'desc';
}

const clean = (data: ReportFilters) => Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== ''));

const signature = (data: ReportFilters) =>
    JSON.stringify(
        Object.entries(clean(data))
            .map(([k, v]) => [k, String(v)])
            .sort(),
    );

export function useLaporanFilters(routeName: string, downloadRouteName: string, filters: ReportFilters, sort: ReportSort) {
    const [form, setForm] = useState<ReportFilters>(filters);
    const dirty = signature(form) !== signature(filters);

    const visit = (extra: ReportFilters, base: ReportFilters = filters) =>
        router.get(route(routeName), clean({ ...base, urut: sort.urut, arah: sort.arah, ...extra }), {
            preserveScroll: true,
            preserveState: 'errors',
            replace: true,
        });

    const set = (key: string, value: string) => setForm((cur) => ({ ...cur, [key]: value }));
    const sortBy = (column: string) => visit({ urut: column, arah: sort.urut === column && sort.arah === 'asc' ? 'desc' : 'asc', page: undefined });
    const apply = () => visit({ page: undefined }, form);

    const downloadUrl = `${route(downloadRouteName)}?${new URLSearchParams(
        Object.entries(clean(filters)).map(([k, v]) => [k, String(v)]),
    ).toString()}`;

    return { form, set, dirty, visit, sortBy, apply, downloadUrl };
}
```

- [ ] **Step 3: `StatCard.tsx`, `ChartLegend.tsx`, `ReportCard.tsx`**

`StatCard.tsx`:
```tsx
export default function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-2 break-words text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
            {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
        </div>
    );
}
```

`ChartLegend.tsx`:
```tsx
export default function ChartLegend({
    items,
    unit,
}: {
    items: { label: string; jumlah: number; persen: number; color: string }[];
    unit: string;
}) {
    return (
        <ul className="mt-4 space-y-2 text-sm">
            {items.map((i) => (
                <li key={i.label} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-slate-800">
                        <span className="size-3 rounded-xs" style={{ backgroundColor: i.color }} aria-hidden="true" />
                        {i.label}
                    </span>
                    <span className="tabular-nums text-slate-600">
                        {i.jumlah.toLocaleString('id-ID')} {unit} · {i.persen.toLocaleString('id-ID')}%
                    </span>
                </li>
            ))}
        </ul>
    );
}
```

`ReportCard.tsx`:
```tsx
import { ReactNode } from 'react';

export default function ReportCard({
    title,
    description,
    aside,
    flush = false,
    className = '',
    children,
}: {
    title: string;
    description?: string;
    aside?: ReactNode;
    /** Tanpa padding isi (untuk tabel); judul diberi garis bawah. */
    flush?: boolean;
    className?: string;
    children: ReactNode;
}) {
    return (
        <div className={`rounded-xl border border-slate-200 bg-white shadow-xs ${flush ? 'overflow-hidden' : 'p-5'} ${className}`}>
            <div className={flush ? 'flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-5 py-4' : 'mb-4'}>
                <div>
                    <p className="text-lg font-semibold text-slate-900">{title}</p>
                    {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
                </div>
                {aside}
            </div>
            {children}
        </div>
    );
}
```

- [ ] **Step 4: `ReportFilterBar.tsx`**

```tsx
import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import { Select } from '@/Components/ui/base/select/select';
import { PageProps } from '@/types';
import { usePage } from '@inertiajs/react';
import { Download01 } from '@untitledui/icons';
import { ReactNode } from 'react';

const ALL = '__all';

export function ReportSelect({
    label,
    value,
    onChange,
    allLabel,
    options,
}: {
    label: string;
    value?: string | number;
    onChange: (value: string) => void;
    allLabel: string;
    options: { value: string | number; label: string }[];
}) {
    return (
        <Select
            label={label}
            size="md"
            items={[{ id: ALL, label: allLabel }, ...options.map((o) => ({ id: String(o.value), label: o.label }))]}
            selectedKey={value ? String(value) : ALL}
            onSelectionChange={(key) => onChange(key === ALL ? '' : String(key))}
        >
            {(item) => <Select.Item id={item.id} label={item.label} />}
        </Select>
    );
}

export function ReportDate({ label, value, onChange }: { label: string; value?: string | number; onChange: (value: string) => void }) {
    return <Input label={label} type="date" size="md" value={value ? String(value) : ''} onChange={onChange} />;
}

export default function ReportFilterBar({
    children,
    dirty,
    total,
    downloadUrl,
    onApply,
}: {
    children: ReactNode;
    dirty: boolean;
    total: number;
    downloadUrl: string;
    onApply: () => void;
}) {
    const { errors } = usePage<PageProps & { errors: Record<string, string> }>().props;
    const errorMessages = Object.values(errors ?? {});

    return (
        <>
            {errorMessages.length > 0 && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    {errorMessages.map((m) => (
                        <p key={m}>{m}</p>
                    ))}
                </div>
            )}

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    onApply();
                }}
                className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
            >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <Button type="submit" color="secondary" size="md">
                        Terapkan filter
                    </Button>
                    <div className="flex flex-wrap items-center gap-4">
                        <p className={`text-sm text-slate-600 ${dirty ? 'opacity-50' : ''}`}>
                            <span className="font-semibold tabular-nums text-slate-900">{total}</span> baris akan diunduh
                            {dirty && <span className="ml-2 text-amber-700">(terapkan filter dulu)</span>}
                        </p>
                        <Button
                            color="primary"
                            size="md"
                            iconLeading={Download01}
                            isDisabled={total === 0 || dirty}
                            onPress={() => {
                                window.location.href = downloadUrl;
                            }}
                        >
                            Unduh Excel
                        </Button>
                    </div>
                </div>
            </form>
        </>
    );
}
```

- [ ] **Step 5: `SummaryTable.tsx`**

```tsx
import { Table } from '@/Components/ui/application/table/table';
import { cx } from '@/lib/cx';
import { ReactNode } from 'react';

export interface SummaryColumn<T> {
    key: string;
    label: string;
    align?: 'right';
    isRowHeader?: boolean;
    render: (row: T) => ReactNode;
}

export default function SummaryTable<T extends { id: string | number }>({
    ariaLabel,
    columns,
    rows,
    total,
    emptyText,
}: {
    ariaLabel: string;
    columns: SummaryColumn<T>[];
    rows: T[];
    /** Baris Total, ditambahkan di akhir bila `rows` tidak kosong. */
    total?: T;
    emptyText: string;
}) {
    const items = total && rows.length > 0 ? [...rows, total] : rows;

    return (
        <Table aria-label={ariaLabel} size="sm">
            <Table.Header>
                {columns.map((c) => (
                    <Table.Head key={c.key} id={c.key} label={c.label} isRowHeader={c.isRowHeader} className={cx(c.align === 'right' && '[&>div]:justify-end')} />
                ))}
            </Table.Header>
            <Table.Body items={items} renderEmptyState={() => <p className="py-8 text-center text-sm text-slate-400">{emptyText}</p>}>
                {(row) => (
                    <Table.Row id={row.id} className={cx(row === total && 'bg-slate-50')}>
                        {columns.map((c) => (
                            <Table.Cell
                                key={c.key}
                                className={cx(c.align === 'right' && 'text-right tabular-nums', row === total ? 'font-semibold text-slate-900' : 'text-slate-800')}
                            >
                                {c.render(row)}
                            </Table.Cell>
                        ))}
                    </Table.Row>
                )}
            </Table.Body>
        </Table>
    );
}
```

- [ ] **Step 6: `ReportDetailTable.tsx`**

```tsx
import { PaginationPageDefault } from '@/Components/ui/application/pagination/pagination';
import { Table } from '@/Components/ui/application/table/table';
import { Button } from '@/Components/ui/base/buttons/button';
import { cx } from '@/lib/cx';
import { ReportSort } from '@/lib/use-laporan-filters';
import { ChevronDown, ChevronRight } from '@untitledui/icons';
import { ReactNode } from 'react';

export interface DetailColumn<T> {
    key: string;
    label: string;
    /** Nama kolom urut di server; bila ada, kolom bisa diurutkan. */
    sort?: string;
    align?: 'right';
    render: (row: T) => ReactNode;
}

interface Paginator {
    from: number | null;
    to: number | null;
    total: number;
    current_page: number;
    last_page: number;
}

type Item<T> = { id: string; kind: 'row'; row: T; no: number } | { id: string; kind: 'detail'; row: T };

export default function ReportDetailTable<T extends { id: number }>({
    ariaLabel,
    columns,
    rows,
    paginator,
    unit,
    sort,
    onSort,
    onPage,
    openId,
    onToggle,
    rowLabel,
    renderDetail,
    emptyText,
}: {
    ariaLabel: string;
    columns: DetailColumn<T>[];
    rows: T[];
    paginator: Paginator;
    /** Satuan di keterangan jumlah, mis. "aset", "mutasi", "laporan". */
    unit: string;
    sort: ReportSort;
    onSort: (column: string) => void;
    onPage: (page: number) => void;
    openId: number | null;
    onToggle: (id: number) => void;
    rowLabel: (row: T) => string;
    renderDetail: (row: T) => ReactNode;
    emptyText: string;
}) {
    const items = rows.flatMap((row, i): Item<T>[] => {
        const main: Item<T> = { id: `row-${row.id}`, kind: 'row', row, no: (paginator.from ?? 1) + i };

        return openId === row.id ? [main, { id: `detail-${row.id}`, kind: 'detail', row }] : [main];
    });

    return (
        <>
            <Table
                aria-label={ariaLabel}
                size="sm"
                sortDescriptor={{ column: sort.urut, direction: sort.arah === 'asc' ? 'ascending' : 'descending' }}
                onSortChange={(descriptor) => onSort(String(descriptor.column))}
            >
                <Table.Header>
                    <Table.Head id="no" label="No" isRowHeader />
                    {columns.map((c) => (
                        <Table.Head
                            key={c.key}
                            id={c.sort ?? c.key}
                            label={c.label}
                            allowsSorting={Boolean(c.sort)}
                            className={cx(c.align === 'right' && '[&>div]:justify-end')}
                        />
                    ))}
                </Table.Header>
                <Table.Body items={items} renderEmptyState={() => <p className="py-10 text-center text-sm text-slate-400">{emptyText}</p>}>
                    {(item) =>
                        item.kind === 'detail' ? (
                            <Table.Row id={item.id} className="h-auto bg-slate-50 hover:bg-slate-50">
                                <Table.Cell colSpan={columns.length + 1} className="whitespace-normal py-4">
                                    {renderDetail(item.row)}
                                </Table.Cell>
                            </Table.Row>
                        ) : (
                            <Table.Row id={item.id}>
                                <Table.Cell className="whitespace-nowrap tabular-nums">
                                    <span className="flex items-center gap-1">
                                        <Button
                                            color="tertiary"
                                            size="sm"
                                            iconLeading={openId === item.row.id ? ChevronDown : ChevronRight}
                                            aria-expanded={openId === item.row.id}
                                            aria-label={`Detail ${rowLabel(item.row)}`}
                                            onPress={() => onToggle(item.row.id)}
                                        />
                                        {item.no}
                                    </span>
                                </Table.Cell>
                                {columns.map((c) => (
                                    <Table.Cell key={c.key} className={cx('text-slate-800', c.align === 'right' && 'text-right tabular-nums')}>
                                        {c.render(item.row)}
                                    </Table.Cell>
                                ))}
                            </Table.Row>
                        )
                    }
                </Table.Body>
            </Table>

            <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4">
                <p className="text-xs text-slate-500">
                    Menampilkan{' '}
                    <span className="font-semibold tabular-nums text-slate-800">
                        {paginator.from ?? 0}-{paginator.to ?? 0}
                    </span>{' '}
                    dari <span className="font-semibold tabular-nums text-slate-800">{paginator.total}</span> {unit}
                </p>
                {paginator.last_page > 1 && (
                    <PaginationPageDefault className="border-t-0 pt-0 md:pt-0" page={paginator.current_page} total={paginator.last_page} onPageChange={onPage} />
                )}
            </div>
        </>
    );
}
```
Catatan: `onSort` menerima kolom saja; hook `sortBy` menghitung arah (lihat Review Focus 2), jadi arah dari React Aria diabaikan.

- [ ] **Step 7: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
git add resources/js/lib/format.ts resources/js/lib/use-laporan-filters.ts resources/js/Components/ReportFilterBar.tsx resources/js/Components/StatCard.tsx resources/js/Components/ChartLegend.tsx resources/js/Components/ReportCard.tsx resources/js/Components/SummaryTable.tsx resources/js/Components/ReportDetailTable.tsx
git commit -m "feat(ui): add shared report components and the report filter hook"
```
Expected: bersih (komponen belum dipakai halaman). Penyesuaian tipe `Table`/`Table.Head` yang berbeda dari yang diasumsikan dicatat sebagai `Ruling`.

---

### Task 2: `LaporanAset/Index`

**Files:**
- Modify: `resources/js/Pages/LaporanAset/Index.tsx` (ganti seluruh isi)

- [ ] **Step 1: Tulis ulang `Index.tsx`**

```tsx
import ChartLegend from '@/Components/ChartLegend';
import DonutChart from '@/Components/Charts/DonutChart';
import TrenAsetChart from '@/Components/Charts/TrenAsetChart';
import PageHeader from '@/Components/PageHeader';
import ReportCard from '@/Components/ReportCard';
import ReportDetailTable, { DetailColumn } from '@/Components/ReportDetailTable';
import ReportFilterBar, { ReportSelect } from '@/Components/ReportFilterBar';
import StatCard from '@/Components/StatCard';
import SummaryTable, { SummaryColumn } from '@/Components/SummaryTable';
import { Badge } from '@/Components/ui/base/badges/badges';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_BADGE_COLOR, KONDISI_LABEL } from '@/lib/assetReport';
import { KONDISI_COLOR } from '@/lib/chartColors';
import { rupiah } from '@/lib/format';
import { useLaporanFilters } from '@/lib/use-laporan-filters';
import { LaporanAsetData, LaporanAsetRow, PageProps } from '@/types';
import { Head } from '@inertiajs/react';
import { useState } from 'react';

interface RekapRow {
    id: string | number;
    nama: string;
    level: 0 | 1;
    jumlah: number;
    nilai_perolehan: number;
    nilai_buku: number;
}

const rekapColumns = (label: string): SummaryColumn<RekapRow>[] => [
    {
        key: 'nama',
        label,
        isRowHeader: true,
        render: (r) => <span className={r.level === 1 ? 'pl-5 text-slate-600' : 'font-semibold'}>{r.nama}</span>,
    },
    { key: 'jumlah', label: 'Jumlah', align: 'right', render: (r) => r.jumlah.toLocaleString('id-ID') },
    { key: 'nilai_perolehan', label: 'Nilai Perolehan', align: 'right', render: (r) => rupiah(r.nilai_perolehan) },
    { key: 'nilai_buku', label: 'Nilai Buku', align: 'right', render: (r) => rupiah(r.nilai_buku) },
];

const asetColumns: DetailColumn<LaporanAsetRow>[] = [
    { key: 'kode_barang', label: 'Kode Barang', sort: 'kode_barang', render: (a) => <span className="tabular-nums">{a.kode_barang}</span> },
    { key: 'nomor_register', label: 'No. Register', sort: 'nomor_register', render: (a) => <span className="tabular-nums">{a.nomor_register}</span> },
    {
        key: 'nama_aset',
        label: 'Nama / Merk',
        sort: 'nama_aset',
        render: (a) => (
            <>
                <span className="font-medium text-slate-900">{a.nama_aset}</span>
                {a.merk_type && <span className="block text-xs text-slate-500">{a.merk_type}</span>}
            </>
        ),
    },
    {
        key: 'kategori',
        label: 'Kategori',
        render: (a) => (
            <>
                {a.kategori}
                {a.subkategori && <span className="block text-xs text-slate-500">{a.subkategori}</span>}
            </>
        ),
    },
    { key: 'unit', label: 'Unit', render: (a) => a.unit },
    { key: 'tahun', label: 'Tahun', sort: 'tanggal_perolehan', render: (a) => <span className="tabular-nums">{a.tahun_perolehan}</span> },
    {
        key: 'kondisi',
        label: 'Kondisi',
        sort: 'kondisi',
        render: (a) => (
            <Badge type="color" size="sm" color={KONDISI_BADGE_COLOR[a.kondisi] ?? 'gray'} className="rounded-sm">
                {KONDISI_LABEL[a.kondisi] ?? a.kondisi}
            </Badge>
        ),
    },
    { key: 'nilai_perolehan', label: 'Nilai Perolehan', sort: 'nilai_perolehan', align: 'right', render: (a) => rupiah(a.nilai_perolehan) },
    { key: 'nilai_buku', label: 'Nilai Buku', sort: 'nilai_buku', align: 'right', render: (a) => rupiah(a.nilai_buku) },
];

function DetailItem({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
    return (
        <div className={wide ? 'sm:col-span-2 lg:col-span-4' : undefined}>
            <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
            <dd className="whitespace-pre-line text-slate-900">{children}</dd>
        </div>
    );
}

export default function Index(props: PageProps & LaporanAsetData) {
    const { filters, sort, ringkasan, kondisi, tren, rekap_kategori: rekapKategori, rekap_unit: rekapUnit, asets, units, categories, kondisiOptions } = props;
    const { form, set, dirty, visit, sortBy, apply, downloadUrl } = useLaporanFilters('laporan-aset.index', 'laporan-aset.download', filters, sort);
    const [open, setOpen] = useState<number | null>(null);

    const legendItems = kondisi.map((k) => ({ label: KONDISI_LABEL[k.kondisi] ?? k.label, jumlah: k.jumlah, persen: k.persen, color: KONDISI_COLOR[k.kondisi] }));

    const kategoriRows: RekapRow[] = rekapKategori.grup.flatMap((g) => [
        { id: `g-${g.id}`, nama: g.nama, level: 0 as const, jumlah: g.jumlah, nilai_perolehan: g.nilai_perolehan, nilai_buku: g.nilai_buku },
        ...g.anak.map((a) => ({ id: `a-${a.id}`, nama: a.nama, level: 1 as const, jumlah: a.jumlah, nilai_perolehan: a.nilai_perolehan, nilai_buku: a.nilai_buku })),
    ]);

    return (
        <AuthenticatedLayout>
            <Head title="Laporan Aset" />

            <div className="space-y-6">
                <PageHeader crumbs={[{ label: 'Laporan' }, { label: 'Laporan Aset' }]} title="Laporan Aset" />

                <ReportFilterBar dirty={dirty} total={asets.total} downloadUrl={downloadUrl} onApply={apply}>
                    {units.length > 0 && (
                        <ReportSelect
                            label="Unit"
                            allLabel="Semua unit"
                            value={form.unit_id}
                            onChange={(v) => set('unit_id', v)}
                            options={units.map((u) => ({ value: u.id, label: u.name }))}
                        />
                    )}
                    <ReportSelect
                        label="Kategori"
                        allLabel="Semua kategori"
                        value={form.category_id}
                        onChange={(v) => set('category_id', v)}
                        options={categories.map((c) => ({ value: c.id, label: c.name }))}
                    />
                    <ReportSelect label="Kondisi" allLabel="Semua kondisi" value={form.kondisi} onChange={(v) => set('kondisi', v)} options={kondisiOptions} />
                </ReportFilterBar>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <StatCard label="Jumlah Aset" value={ringkasan.jumlah.toLocaleString('id-ID')} />
                    <StatCard label="Total Nilai Perolehan" value={rupiah(ringkasan.nilai_perolehan)} />
                    <StatCard label="Total Nilai Buku" value={rupiah(ringkasan.nilai_buku)} />
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <ReportCard title="Persentase per Kondisi">
                        <DonutChart ariaLabel="Grafik persentase aset menurut kondisi" data={legendItems} />
                        <ChartLegend unit="aset" items={legendItems} />
                    </ReportCard>
                    <ReportCard title="Tren per Tahun Perolehan" className="lg:col-span-2">
                        <TrenAsetChart data={tren} />
                    </ReportCard>
                </div>

                <ReportCard title="Rekap per Kategori" flush>
                    <SummaryTable
                        ariaLabel="Rekap aset per kategori"
                        columns={rekapColumns('Kategori')}
                        rows={kategoriRows}
                        total={{ id: 'total', nama: 'Total', level: 0, ...rekapKategori.total }}
                        emptyText="Belum ada data."
                    />
                </ReportCard>

                {rekapUnit && (
                    <ReportCard title="Rekap per Unit" flush>
                        <SummaryTable
                            ariaLabel="Rekap aset per unit"
                            columns={rekapColumns('Unit')}
                            rows={rekapUnit.baris.map((u) => ({ id: u.id, nama: u.nama, level: 0 as const, jumlah: u.jumlah, nilai_perolehan: u.nilai_perolehan, nilai_buku: u.nilai_buku }))}
                            total={{ id: 'total', nama: 'Total', level: 0, ...rekapUnit.total }}
                            emptyText="Belum ada data."
                        />
                    </ReportCard>
                )}

                <ReportCard title="Daftar Rinci" flush>
                    <ReportDetailTable
                        ariaLabel="Daftar rinci aset"
                        columns={asetColumns}
                        rows={asets.data}
                        paginator={asets}
                        unit="aset"
                        sort={sort}
                        onSort={sortBy}
                        onPage={(page) => visit({ page })}
                        openId={open}
                        onToggle={(id) => setOpen(open === id ? null : id)}
                        rowLabel={(a) => a.nama_aset}
                        emptyText="Tidak ada aset yang cocok."
                        renderDetail={(a) => (
                            <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                                <DetailItem label="Pemegang">{a.detail.pemegang ?? '—'}</DetailItem>
                                <DetailItem label="Status">{a.detail.status === 'aktif' ? 'Aktif' : 'Dalam Proses'}</DetailItem>
                                <DetailItem label="Sumber Perolehan">{a.detail.sumber_perolehan ?? '—'}</DetailItem>
                                <DetailItem label="No. Dokumen">{a.detail.no_dokumen ?? '—'}</DetailItem>
                                <DetailItem label="Keterangan" wide>
                                    {a.detail.keterangan ?? '—'}
                                </DetailItem>
                            </dl>
                        )}
                    />
                </ReportCard>
            </div>
        </AuthenticatedLayout>
    );
}
```
`React.ReactNode` pada `DetailItem` diganti `ReactNode` dengan `import { ReactNode, useState } from 'react'` bila `tsc` mengeluh. `DonutChart` menerima `{ label, jumlah, persen, color }` (sama dengan sebelumnya).

- [ ] **Step 2: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
php artisan test --compact --filter='Laporan'
git add resources/js/Pages/LaporanAset/Index.tsx
git commit -m "feat(ui): migrate the asset report page to Untitled UI components"
```
Expected: bersih; test hijau.

---

### Task 3: `LaporanMutasi/Index`

**Files:**
- Modify: `resources/js/Pages/LaporanMutasi/Index.tsx` (ganti seluruh isi)

- [ ] **Step 1: Tulis ulang `Index.tsx`**

```tsx
import ChartLegend from '@/Components/ChartLegend';
import DonutChart from '@/Components/Charts/DonutChart';
import TrenMutasiChart from '@/Components/Charts/TrenMutasiChart';
import PageHeader from '@/Components/PageHeader';
import ReportCard from '@/Components/ReportCard';
import ReportDetailTable, { DetailColumn } from '@/Components/ReportDetailTable';
import ReportFilterBar, { ReportDate, ReportSelect } from '@/Components/ReportFilterBar';
import StatCard from '@/Components/StatCard';
import SummaryTable, { SummaryColumn } from '@/Components/SummaryTable';
import { Badge } from '@/Components/ui/base/badges/badges';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_LABEL } from '@/lib/assetReport';
import { JENIS_COLOR, STATUS_COLOR } from '@/lib/chartColors';
import { rupiah, tanggalSingkat } from '@/lib/format';
import { MUTATION_STATUS_COLOR } from '@/lib/mutasi';
import { useLaporanFilters } from '@/lib/use-laporan-filters';
import { LaporanMutasiData, LaporanMutasiRow, PageProps } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';

type MasihBerjalan = LaporanMutasiData['masih_berjalan'][number];
type ArusRow = { id: string; asal: string; tujuan: string; jumlah_mutasi: number; aset: number; nilai: number };

const AKSI_LABEL: Record<string, string> = {
    approve: 'Disetujui',
    reject: 'Ditolak',
    cancel: 'Dibatalkan',
    reassign: 'Approver dialihkan',
};

const arusColumns: SummaryColumn<ArusRow>[] = [
    { key: 'asal', label: 'Unit Asal', isRowHeader: true, render: (r) => <span className="font-medium">{r.asal}</span> },
    { key: 'tujuan', label: 'Unit Tujuan', render: (r) => r.tujuan },
    { key: 'jumlah_mutasi', label: 'Mutasi', align: 'right', render: (r) => r.jumlah_mutasi.toLocaleString('id-ID') },
    { key: 'aset', label: 'Aset', align: 'right', render: (r) => r.aset.toLocaleString('id-ID') },
    { key: 'nilai', label: 'Nilai Perolehan', align: 'right', render: (r) => rupiah(r.nilai) },
];

const berjalanColumns: SummaryColumn<MasihBerjalan>[] = [
    {
        key: 'nomor',
        label: 'Nomor',
        isRowHeader: true,
        render: (m) => (
            <Link href={m.url} className="font-medium tabular-nums text-blue-700 hover:underline">
                {m.nomor}
            </Link>
        ),
    },
    { key: 'jenis', label: 'Jenis', render: (m) => m.jenis },
    { key: 'alur', label: 'Asal → Tujuan', render: (m) => `${m.asal} → ${m.tujuan}` },
    { key: 'langkah', label: 'Langkah', render: (m) => m.langkah ?? '—' },
    { key: 'menunggu', label: 'Menunggu', render: (m) => m.menunggu ?? '—' },
    { key: 'umur', label: 'Umur', align: 'right', render: (m) => `${m.umur_hari} hari` },
];

export default function Index(props: PageProps & LaporanMutasiData) {
    const { filters, sort, ringkasan, status, jenis, tren, arus, masih_berjalan: masihBerjalan, jumlah_masih_berjalan: jumlahBerjalan, mutasis, unitOptions, jenisOptions, statusOptions } = props;
    const { form, set, dirty, visit, sortBy, apply, downloadUrl } = useLaporanFilters('laporan-mutasi.index', 'laporan-mutasi.download', filters, sort);
    const [open, setOpen] = useState<number | null>(null);

    const statusLabel = Object.fromEntries(statusOptions.map((s) => [s.value, s.label]));
    const unitOpts = unitOptions.map((u) => ({ value: u.id, label: u.name }));
    const statusItems = status.map((s) => ({ label: s.label, jumlah: s.jumlah, persen: s.persen, color: STATUS_COLOR[s.status] }));
    const jenisItems = jenis.map((j) => ({ label: j.label, jumlah: j.jumlah, persen: j.persen, color: JENIS_COLOR[j.jenis] }));
    const rataProses = ringkasan.rata_lama_proses === null ? '—' : `${ringkasan.rata_lama_proses.toLocaleString('id-ID')} hari`;
    const terlamaProses = ringkasan.terlama_proses === null ? '—' : `${ringkasan.terlama_proses.toLocaleString('id-ID')} hari`;

    const columns: DetailColumn<LaporanMutasiRow>[] = [
        { key: 'nomor', label: 'Nomor', sort: 'nomor_mutasi', render: (m) => <span className="font-medium tabular-nums">{m.nomor_mutasi}</span> },
        { key: 'tanggal', label: 'Tanggal', sort: 'tanggal_mutasi', render: (m) => <span className="tabular-nums">{tanggalSingkat(m.tanggal_mutasi)}</span> },
        { key: 'jenis', label: 'Jenis', render: (m) => m.jenis_label },
        { key: 'asal', label: 'Asal', render: (m) => m.asal },
        { key: 'tujuan', label: 'Tujuan', render: (m) => m.tujuan },
        { key: 'jumlah', label: 'Jumlah Aset', sort: 'jumlah_aset', align: 'right', render: (m) => m.jumlah_aset },
        { key: 'nilai', label: 'Nilai', sort: 'nilai', align: 'right', render: (m) => rupiah(m.nilai) },
        {
            key: 'status',
            label: 'Status',
            sort: 'status',
            render: (m) => (
                <Badge type="color" size="sm" color={MUTATION_STATUS_COLOR[m.status]} className="rounded-sm">
                    {statusLabel[m.status] ?? m.status}
                </Badge>
            ),
        },
        { key: 'pengaju', label: 'Pengaju', render: (m) => m.pengaju ?? '—' },
    ];

    return (
        <AuthenticatedLayout>
            <Head title="Laporan Mutasi" />

            <div className="space-y-6">
                <PageHeader crumbs={[{ label: 'Laporan' }, { label: 'Laporan Mutasi' }]} title="Laporan Mutasi" />

                <ReportFilterBar dirty={dirty} total={mutasis.total} downloadUrl={downloadUrl} onApply={apply}>
                    <ReportDate label="Dari tanggal" value={form.dari} onChange={(v) => set('dari', v)} />
                    <ReportDate label="Sampai tanggal" value={form.sampai} onChange={(v) => set('sampai', v)} />
                    <ReportSelect label="Jenis" allLabel="Semua jenis" value={form.jenis_mutasi} onChange={(v) => set('jenis_mutasi', v)} options={jenisOptions} />
                    <ReportSelect label="Status" allLabel="Semua status" value={form.status} onChange={(v) => set('status', v)} options={statusOptions} />
                    <ReportSelect label="Unit Asal" allLabel="Semua unit asal" value={form.asal_id} onChange={(v) => set('asal_id', v)} options={unitOpts} />
                    <ReportSelect label="Unit Tujuan" allLabel="Semua unit tujuan" value={form.tujuan_id} onChange={(v) => set('tujuan_id', v)} options={unitOpts} />
                </ReportFilterBar>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <StatCard label="Jumlah Mutasi" value={ringkasan.jumlah_mutasi.toLocaleString('id-ID')} note="Semua status" />
                    <StatCard label="Mutasi Disetujui" value={ringkasan.disetujui.toLocaleString('id-ID')} />
                    <StatCard label="Aset Berpindah" value={ringkasan.aset_berpindah.toLocaleString('id-ID')} note="Hanya mutasi Disetujui" />
                    <StatCard label="Nilai Perolehan Aset Berpindah" value={rupiah(ringkasan.nilai_perolehan)} note="Hanya mutasi Disetujui" />
                    <StatCard label="Rata-rata Lama Proses" value={rataProses} />
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <ReportCard title="Komposisi per Status">
                        <DonutChart unit="mutasi" ariaLabel="Grafik komposisi mutasi menurut status" data={statusItems} />
                        <ChartLegend unit="mutasi" items={statusItems} />
                    </ReportCard>
                    <ReportCard title="Komposisi per Jenis Mutasi">
                        <DonutChart unit="mutasi" ariaLabel="Grafik komposisi mutasi menurut jenis" data={jenisItems} />
                        <ChartLegend unit="mutasi" items={jenisItems} />
                    </ReportCard>
                </div>

                <ReportCard title="Tren Mutasi per Bulan" description="Hanya mutasi Disetujui, menurut tanggal mutasi.">
                    <TrenMutasiChart data={tren} />
                </ReportCard>

                <ReportCard title="Arus Antar Unit" flush>
                    <SummaryTable
                        ariaLabel="Arus mutasi antar unit"
                        columns={arusColumns}
                        rows={arus.baris.map((r) => ({ id: `${r.asal_id}-${r.tujuan_id}`, asal: r.asal, tujuan: r.tujuan, jumlah_mutasi: r.jumlah_mutasi, aset: r.aset, nilai: r.nilai }))}
                        total={{ id: 'total', asal: 'Total', tujuan: '', ...arus.total }}
                        emptyText="Belum ada mutasi yang disetujui."
                    />
                </ReportCard>

                <ReportCard
                    title="Kinerja Persetujuan"
                    flush
                    aside={
                        <p className="text-sm tabular-nums text-slate-600">
                            Rata-rata {rataProses} · Terlama {terlamaProses}
                        </p>
                    }
                >
                    <p className="px-5 pt-4 text-sm font-semibold text-slate-900">Masih Berjalan</p>
                    <SummaryTable ariaLabel="Mutasi yang masih berjalan" columns={berjalanColumns} rows={masihBerjalan} emptyText="Tidak ada mutasi yang masih berjalan." />
                    {jumlahBerjalan > masihBerjalan.length && (
                        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                            Menampilkan {masihBerjalan.length} terlama dari {jumlahBerjalan} mutasi yang masih berjalan.
                        </p>
                    )}
                </ReportCard>

                <ReportCard title="Daftar Rinci" flush>
                    <ReportDetailTable
                        ariaLabel="Daftar rinci mutasi"
                        columns={columns}
                        rows={mutasis.data}
                        paginator={mutasis}
                        unit="mutasi"
                        sort={sort}
                        onSort={sortBy}
                        onPage={(page) => visit({ page })}
                        openId={open}
                        onToggle={(id) => setOpen(open === id ? null : id)}
                        rowLabel={(m) => m.nomor_mutasi}
                        emptyText="Tidak ada mutasi yang cocok."
                        renderDetail={(m) => (
                            <div className="space-y-4">
                                <div>
                                    <p className="text-xs font-semibold uppercase text-slate-500">Keterangan</p>
                                    <p className="whitespace-pre-line text-sm text-slate-900">{m.detail.keterangan ?? '—'}</p>
                                </div>

                                <div>
                                    <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Aset yang dimutasi</p>
                                    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                                        <table className="w-full border-collapse text-left text-xs">
                                            <thead>
                                                <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                                    <th className="px-3 py-2">Kode Barang</th>
                                                    <th className="px-3 py-2">Nama Aset</th>
                                                    <th className="px-3 py-2">Kategori</th>
                                                    <th className="px-3 py-2">Kondisi</th>
                                                    <th className="px-3 py-2 text-right">Nilai</th>
                                                    <th className="px-3 py-2">Pemegang Tujuan</th>
                                                    <th className="px-3 py-2">Catatan</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-slate-800">
                                                {m.detail.aset.map((a, idx) => (
                                                    <tr key={`${a.kode_barang}-${idx}`}>
                                                        <td className="px-3 py-2 tabular-nums">{a.kode_barang ?? '—'}</td>
                                                        <td className="px-3 py-2 font-medium">{a.nama_aset ?? '—'}</td>
                                                        <td className="px-3 py-2">{a.kategori ?? '—'}</td>
                                                        <td className="px-3 py-2">{a.kondisi ? (KONDISI_LABEL[a.kondisi] ?? a.kondisi) : '—'}</td>
                                                        <td className="px-3 py-2 text-right tabular-nums">{rupiah(a.nilai_perolehan)}</td>
                                                        <td className="px-3 py-2">{a.pemegang_tujuan ?? '—'}</td>
                                                        <td className="px-3 py-2">{a.catatan ?? '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div>
                                    <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Riwayat persetujuan</p>
                                    {m.detail.persetujuan.length === 0 ? (
                                        <p className="text-sm text-slate-500">Belum ada aksi persetujuan.</p>
                                    ) : (
                                        <ol className="space-y-2 border-l border-slate-200 pl-4 text-sm">
                                            {m.detail.persetujuan.map((p, idx) => (
                                                <li key={idx}>
                                                    <p className="font-medium text-slate-900">
                                                        {AKSI_LABEL[p.aksi] ?? p.aksi}
                                                        {p.langkah ? ` — ${p.langkah}` : ''}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {p.oleh ?? '—'}
                                                        {p.waktu && ` · ${new Date(p.waktu).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}`}
                                                    </p>
                                                    {p.catatan && <p className="text-xs text-slate-600">{p.catatan}</p>}
                                                </li>
                                            ))}
                                        </ol>
                                    )}
                                </div>
                            </div>
                        )}
                    />
                </ReportCard>
            </div>
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 2: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
php artisan test --compact --filter='Laporan'
git add resources/js/Pages/LaporanMutasi/Index.tsx
git commit -m "feat(ui): migrate the mutation report page to Untitled UI components"
```
Expected: bersih; test hijau.

---

### Task 4: `LaporanRusakHilang/Index` dan gerbang

**Files:**
- Modify: `resources/js/Pages/LaporanRusakHilang/Index.tsx` (ganti seluruh isi)

- [ ] **Step 1: Tulis ulang `Index.tsx`**

```tsx
import ChartLegend from '@/Components/ChartLegend';
import DonutChart from '@/Components/Charts/DonutChart';
import TrenInsidenChart from '@/Components/Charts/TrenInsidenChart';
import PageHeader from '@/Components/PageHeader';
import ReportCard from '@/Components/ReportCard';
import ReportDetailTable, { DetailColumn } from '@/Components/ReportDetailTable';
import ReportFilterBar, { ReportDate, ReportSelect } from '@/Components/ReportFilterBar';
import StatCard from '@/Components/StatCard';
import SummaryTable, { SummaryColumn } from '@/Components/SummaryTable';
import { Badge } from '@/Components/ui/base/badges/badges';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_BADGE_COLOR } from '@/lib/assetReport';
import { KONDISI_COLOR, STATUS_COLOR } from '@/lib/chartColors';
import { rupiah, tanggalSingkat } from '@/lib/format';
import { MUTATION_STATUS_COLOR } from '@/lib/mutasi';
import { useLaporanFilters } from '@/lib/use-laporan-filters';
import { LaporanRusakHilangData, LaporanRusakHilangRow, PageProps } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';

type MasihBerjalan = LaporanRusakHilangData['masih_berjalan'][number];
type SebaranRow = { id: string | number; name: string; jumlah_rusak: number; jumlah_hilang: number; total: number; nilai_buku: number };

const sebaranColumns: SummaryColumn<SebaranRow>[] = [
    { key: 'name', label: 'Unit Kerja', isRowHeader: true, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'jumlah_rusak', label: 'Rusak', align: 'right', render: (r) => r.jumlah_rusak.toLocaleString('id-ID') },
    { key: 'jumlah_hilang', label: 'Hilang', align: 'right', render: (r) => r.jumlah_hilang.toLocaleString('id-ID') },
    { key: 'total', label: 'Total Insiden', align: 'right', render: (r) => <span className="font-semibold">{r.total.toLocaleString('id-ID')}</span> },
    { key: 'nilai_buku', label: 'Nilai Buku Terdampak', align: 'right', render: (r) => rupiah(r.nilai_buku) },
];

const berjalanColumns: SummaryColumn<MasihBerjalan>[] = [
    {
        key: 'nomor',
        label: 'Nomor Laporan',
        isRowHeader: true,
        render: (m) => (
            <Link href={m.url} className="font-medium tabular-nums text-blue-700 hover:underline">
                {m.nomor}
            </Link>
        ),
    },
    { key: 'kondisi', label: 'Kondisi', render: (m) => m.kondisi_label },
    { key: 'aset', label: 'Aset', render: (m) => m.nama_aset ?? '—' },
    { key: 'unit', label: 'Unit', render: (m) => m.unit ?? '—' },
    { key: 'pemegang', label: 'Pemegang', render: (m) => m.pemegang ?? '—' },
    { key: 'langkah', label: 'Langkah', render: (m) => m.langkah ?? '—' },
    { key: 'menunggu', label: 'Menunggu', render: (m) => m.menunggu ?? '—' },
    { key: 'umur', label: 'Umur', align: 'right', render: (m) => `${m.umur_hari} hari` },
];

export default function Index(props: PageProps & LaporanRusakHilangData) {
    const {
        filters,
        sort,
        ringkasan,
        status,
        kondisi,
        tren,
        sebaran_unit: sebaranUnit,
        masih_berjalan: masihBerjalan,
        jumlah_masih_berjalan: jumlahBerjalan,
        reports,
        unitOptions,
        categoryOptions,
        kondisiOptions,
        statusOptions,
    } = props;
    const { form, set, dirty, visit, sortBy, apply, downloadUrl } = useLaporanFilters('laporan-rusak-hilang.index', 'laporan-rusak-hilang.download', filters, sort);
    const [open, setOpen] = useState<number | null>(null);

    const statusLabel = Object.fromEntries(statusOptions.map((s) => [s.value, s.label]));
    const kondisiLabel = Object.fromEntries(kondisiOptions.map((k) => [k.value, k.label]));
    const statusItems = status.map((s) => ({ label: s.label, jumlah: s.jumlah, persen: s.persen, color: STATUS_COLOR[s.status] || '#94A3B8' }));
    const kondisiItems = kondisi.map((k) => ({ label: k.label, jumlah: k.jumlah, persen: k.persen, color: KONDISI_COLOR[k.kondisi] || '#94A3B8' }));
    const rataProses = ringkasan.rata_lama_proses === null ? '—' : `${ringkasan.rata_lama_proses.toLocaleString('id-ID')} hari`;
    const terlamaProses = ringkasan.terlama_proses === null ? '—' : `${ringkasan.terlama_proses.toLocaleString('id-ID')} hari`;

    const columns: DetailColumn<LaporanRusakHilangRow>[] = [
        { key: 'nomor', label: 'No. Laporan', sort: 'nomor_laporan', render: (r) => <span className="font-medium tabular-nums">{r.nomor_laporan}</span> },
        { key: 'tanggal', label: 'Tgl Kejadian', sort: 'tanggal_kejadian', render: (r) => <span className="tabular-nums">{tanggalSingkat(r.tanggal_kejadian)}</span> },
        { key: 'nama_aset', label: 'Aset', sort: 'nama_aset', render: (r) => <span className="font-medium text-slate-900">{r.nama_aset ?? '—'}</span> },
        { key: 'kategori', label: 'Kategori', render: (r) => r.kategori ?? '—' },
        { key: 'unit', label: 'Unit', render: (r) => r.unit ?? '—' },
        { key: 'pemegang', label: 'Pemegang', render: (r) => r.pemegang ?? '—' },
        {
            key: 'kondisi',
            label: 'Kondisi',
            sort: 'kondisi_baru',
            render: (r) =>
                r.kondisi_baru ? (
                    <Badge type="color" size="sm" color={KONDISI_BADGE_COLOR[r.kondisi_baru] ?? 'gray'} className="rounded-sm">
                        {kondisiLabel[r.kondisi_baru] ?? r.kondisi_label ?? r.kondisi_baru}
                    </Badge>
                ) : (
                    '—'
                ),
        },
        { key: 'nilai_perolehan', label: 'Nilai Perolehan', sort: 'nilai_perolehan', align: 'right', render: (r) => rupiah(r.nilai_perolehan) },
        { key: 'nilai_buku', label: 'Nilai Buku', sort: 'nilai_buku', align: 'right', render: (r) => rupiah(r.nilai_buku) },
        {
            key: 'status',
            label: 'Status',
            sort: 'status',
            render: (r) =>
                r.status ? (
                    <Badge type="color" size="sm" color={MUTATION_STATUS_COLOR[r.status]} className="rounded-sm">
                        {statusLabel[r.status] ?? r.status_label ?? r.status}
                    </Badge>
                ) : (
                    '—'
                ),
        },
    ];

    return (
        <AuthenticatedLayout>
            <Head title="Laporan Rusak & Hilang" />

            <div className="space-y-6">
                <PageHeader crumbs={[{ label: 'Laporan' }, { label: 'Laporan Rusak & Hilang' }]} title="Laporan Rusak & Hilang" />

                <ReportFilterBar dirty={dirty} total={reports.total} downloadUrl={downloadUrl} onApply={apply}>
                    <ReportDate label="Dari Tanggal" value={form.dari} onChange={(v) => set('dari', v)} />
                    <ReportDate label="Sampai Tanggal" value={form.sampai} onChange={(v) => set('sampai', v)} />
                    <ReportSelect label="Kondisi" allLabel="Semua kondisi" value={form.kondisi} onChange={(v) => set('kondisi', v)} options={kondisiOptions} />
                    <ReportSelect label="Status" allLabel="Semua status" value={form.status} onChange={(v) => set('status', v)} options={statusOptions} />
                    {unitOptions.length > 1 && (
                        <ReportSelect
                            label="Unit Kerja"
                            allLabel="Semua unit kerja"
                            value={form.unit_id}
                            onChange={(v) => set('unit_id', v)}
                            options={unitOptions.map((u) => ({ value: u.id, label: u.name }))}
                        />
                    )}
                    <ReportSelect
                        label="Kategori Aset"
                        allLabel="Semua kategori aset"
                        value={form.category_id}
                        onChange={(v) => set('category_id', v)}
                        options={categoryOptions.map((c) => ({ value: c.id, label: c.name }))}
                    />
                </ReportFilterBar>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <StatCard label="Jumlah Laporan" value={ringkasan.jumlah_laporan.toLocaleString('id-ID')} note="Semua status" />
                    <StatCard label="Laporan Disetujui" value={ringkasan.disetujui.toLocaleString('id-ID')} />
                    <StatCard label="Nilai Perolehan Terdampak" value={rupiah(ringkasan.nilai_perolehan)} note="Hanya laporan Disetujui" />
                    <StatCard label="Nilai Buku Terdampak" value={rupiah(ringkasan.nilai_buku)} note="Hanya laporan Disetujui" />
                    <StatCard
                        label="Rata-rata Lama Proses"
                        value={rataProses}
                        note={ringkasan.terlama_proses !== null ? `Terlama: ${ringkasan.terlama_proses.toLocaleString('id-ID')} hari` : undefined}
                    />
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <ReportCard title="Komposisi per Status">
                        <DonutChart unit="laporan" ariaLabel="Grafik komposisi laporan menurut status persetujuan" data={statusItems} />
                        <ChartLegend unit="laporan" items={statusItems} />
                    </ReportCard>
                    <ReportCard title="Komposisi per Kondisi Insiden">
                        <DonutChart unit="laporan" ariaLabel="Grafik komposisi laporan menurut kondisi insiden" data={kondisiItems} />
                        <ChartLegend unit="laporan" items={kondisiItems} />
                    </ReportCard>
                </div>

                <ReportCard title="Tren Insiden per Bulan" description="Hanya laporan Disetujui, menurut tanggal kejadian.">
                    <TrenInsidenChart data={tren} />
                </ReportCard>

                {sebaranUnit && (
                    <ReportCard title="Sebaran Insiden per Unit Kerja" flush>
                        <SummaryTable
                            ariaLabel="Sebaran insiden per unit kerja"
                            columns={sebaranColumns}
                            rows={sebaranUnit.baris.map((r) => ({ id: r.id, name: r.name, jumlah_rusak: r.jumlah_rusak, jumlah_hilang: r.jumlah_hilang, total: r.total, nilai_buku: r.nilai_buku }))}
                            total={{ id: 'total', name: 'Total', ...sebaranUnit.total }}
                            emptyText="Belum ada laporan yang disetujui."
                        />
                    </ReportCard>
                )}

                <ReportCard
                    title="Kinerja Persetujuan"
                    flush
                    aside={
                        <p className="text-sm tabular-nums text-slate-600">
                            Rata-rata {rataProses} · Terlama {terlamaProses}
                        </p>
                    }
                >
                    <p className="px-5 pt-4 text-sm font-semibold text-slate-900">Masih Berjalan</p>
                    <SummaryTable ariaLabel="Laporan yang masih berjalan" columns={berjalanColumns} rows={masihBerjalan} emptyText="Tidak ada laporan yang masih berjalan." />
                    {jumlahBerjalan > masihBerjalan.length && (
                        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                            Menampilkan {masihBerjalan.length} terlama dari {jumlahBerjalan} laporan yang masih berjalan.
                        </p>
                    )}
                </ReportCard>

                <ReportCard title="Daftar Rinci" flush>
                    <ReportDetailTable
                        ariaLabel="Daftar rinci laporan rusak dan hilang"
                        columns={columns}
                        rows={reports.data}
                        paginator={reports}
                        unit="laporan"
                        sort={sort}
                        onSort={sortBy}
                        onPage={(page) => visit({ page })}
                        openId={open}
                        onToggle={(id) => setOpen(open === id ? null : id)}
                        rowLabel={(r) => r.nomor_laporan}
                        emptyText="Tidak ada laporan yang cocok."
                        renderDetail={(r) => (
                            <div className="space-y-4">
                                <div>
                                    <p className="text-xs font-semibold uppercase text-slate-500">Kronologi Kejadian</p>
                                    <p className="whitespace-pre-line text-sm text-slate-900">{r.detail.kronologi ?? '—'}</p>
                                </div>

                                {r.detail.photos && r.detail.photos.length > 0 && (
                                    <div>
                                        <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Foto Bukti Insiden</p>
                                        <div className="flex flex-wrap gap-3">
                                            {r.detail.photos.map((p) => (
                                                <a
                                                    key={p.id}
                                                    href={p.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    aria-label="Buka foto bukti insiden di tab baru"
                                                    className="group block overflow-hidden rounded-lg border border-slate-200 outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
                                                >
                                                    <img src={p.url} alt="" className="size-24 object-cover transition-transform group-hover:scale-105" />
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Riwayat Persetujuan</p>
                                    {r.detail.riwayat_persetujuan.length === 0 ? (
                                        <p className="text-sm text-slate-500">Belum ada aksi persetujuan.</p>
                                    ) : (
                                        <ol className="space-y-2 border-l border-slate-200 pl-4 text-sm">
                                            {r.detail.riwayat_persetujuan.map((p, idx) => (
                                                <li key={idx}>
                                                    <p className="font-medium text-slate-900">
                                                        {p.action_label ?? p.action}
                                                        {p.langkah ? ` — ${p.langkah}` : ''}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {p.user ?? '—'}
                                                        {p.created_at && ` · ${p.created_at}`}
                                                    </p>
                                                    {p.note && <p className="text-xs text-slate-600">{p.note}</p>}
                                                </li>
                                            ))}
                                        </ol>
                                    )}
                                </div>
                            </div>
                        )}
                    />
                </ReportCard>
            </div>
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 2: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
grep -rn "@/Components/Icons\|pageNumbersWithGaps" resources/js/Pages/Laporan* resources/js/Components/Report*.tsx resources/js/Components/SummaryTable.tsx
php artisan test --compact --filter='Laporan'
git add resources/js/Pages/LaporanRusakHilang/Index.tsx
git commit -m "feat(ui): migrate the damage and loss report page to Untitled UI components"
```
Expected: bersih; `grep` kosong; test hijau.

- [ ] **Step 3: Cek runtime singkat dan GERBANG LAPORAN — berhenti**

Cek di browser headless dengan super-admin (atau akun dengan `laporan.*`): tiga halaman memuat tanpa error; terapkan satu filter; klik satu header kolom untuk mengurutkan (URL berubah `urut`/`arah`); buka satu baris rinci; pastikan tombol Unduh Excel aktif setelah filter diterapkan dan nonaktif saat ada perubahan filter yang belum diterapkan (jangan mengunduh).

Laporkan hasil Task 1–4, `Ruling`, dan hal yang tak bisa diverifikasi. Minta pengguna memeriksa:
- **Ketiga halaman**: bilah filter (Terapkan filter, hitungan baris, Unduh Excel nonaktif saat filter belum diterapkan, unduhan berjalan dan tidak menampilkan modal galat), kartu ringkasan (angka rupiah panjang tidak terpotong di lebar laptop), donat + legenda, tabel rekap dengan baris Total tebal, kartu Kinerja Persetujuan.
- **Daftar Rinci**: urut kolom (panah naik/turun, urutan benar), tombol panah membuka/menutup panel rinci (isi panel lengkap: Aset — detail; Mutasi — keterangan, tabel aset, riwayat; Rusak/Hilang — kronologi, foto, riwayat), paginasi mempertahankan filter dan urutan.
- **Halaman Aset**: tabel Rekap per Kategori bertingkat (subkategori menjorok), Rekap per Unit hanya untuk yang berhak.
- Banner galat filter (mis. rentang tanggal terbalik) tampil dan filter tidak hilang.
- Keyboard (Tab/Spasi/Enter/Esc), layar 375 px (tabel menggulir ke samping), cincin fokus.
**Jangan memulai modul berikutnya** sebelum pengguna menyatakan lolos.

---

## Catatan Review (ponytail + impeccable, sudah diterapkan)

- Ponytail: tiap komponen/hook bersama punya tiga konsumen (tiga halaman laporan) dan menggantikan salinan yang sama persis, jadi bukan abstraksi spekulatif. Tidak ada yang layak dihapus tambahan. `ReportDate` (pembungkus satu baris) dipertahankan karena dipakai empat kali dan menjaga pemetaan nilai kosong.
- Impeccable (Operate): "Unduh Excel" `primary` dengan ikon, nonaktif saat filter belum diterapkan dan hitungan baris meredup (umpan balik jelas sebelum unduhan); unduhan lewat `window.location.href` agar tidak jadi kunjungan Inertia; tabel rekap memakai baris Total tebal; panel rinci dibuka lewat tombol panah dengan `aria-expanded` (lebih mudah diakses daripada baris yang bisa diklik seluruhnya). Dicek saat eksekusi: indeks `Download01` ada, perataan header kolom angka (`[&>div]:justify-end`), tinggi baris `h-auto` pada panel rinci, dan arah urut sesuai perilaku lama.
