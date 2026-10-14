# Migrasi Untitled UI, Fase 4: Kategori Aset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memigrasikan halaman Kategori Aset (`Index`, `Create`, `Edit`) ke komponen Untitled UI tanpa mengubah logika, props Inertia, atau nama berkas.

**Architecture:** `Create` dan `Edit` hampir identik (±300 baris JSX ganda), jadi form dipindah ke satu partial `Partials/CategoryForm.tsx` (pola yang sama dengan `AssetForm`); `Create`/`Edit` tetap memegang `useForm`, `transform`, dan pengiriman masing-masing. `Index` memakai `Table` React Aria dengan baris pohon yang diratakan, `PaginationPageDefault`, dan `ConfirmDialog`.

**Tech Stack:** React 19, Inertia 2, Tailwind 4, Untitled UI (React Aria Components), `@untitledui/icons`.

**Spec:** `docs/superpowers/specs/2026-10-14-migrasi-untitled-ui-design.md` §3.5 butir 2 (Master data, dikerjakan satu modul per langkah atas permintaan pengguna). Komponen bersama: `PageHeader`, `ConfirmDialog`, `TextArea` (commit `c1c16e8`). Pola acuan: `docs/superpowers/plans/2026-10-14-migrasi-untitled-ui-fase4-aset.md`.

Plan ini sudah memuat hasil review ponytail dan impeccable (2026-10-14).

## Global Constraints

- Hanya komponen Untitled UI gratis. Panduan UI/UX menang untuk identitas (Sapphire, `tabular-nums`, badge radius 4px, tanpa kartu di dalam kartu); Untitled UI menang untuk semantik, keyboard, fokus.
- Logika tidak berubah: `useForm`, `transform` (induk → `parent_id: null`), `put`/`post`, pagination sisi klien 5 induk per halaman, buka/tutup induk (default terbuka), `can.*`, pesan hapus, dan props Inertia. Nama berkas tidak berubah.
- Tidak mencampur komponen Breeze (`InputError`, dst.) dan tidak memakai ikon SVG lokal; impor memakai `@/Components/...` berhuruf besar.
- Galat validasi lewat `hint={errors.x}` + `isInvalid={Boolean(errors.x)}`; teks bantuan biasa saat tidak ada galat (`hint={errors.x ?? 'bantuan'}`).
- Warna tombol: tambah `primary`; ubah `secondary-green`; hapus `secondary-destructive`; Batal `secondary`; Impor/Ekspor lewat `ImportExportButtons` (sudah `secondary-brand`).
- Tabel: kerapatan baris bawaan Untitled UI, `Table.Head` ber-`id` unik, kunci baris unik antara induk dan anak.
- Tanpa dependensi baru. Verifikasi: `npx tsc --noEmit`, `npm run build`, test backend `AssetCategoryManagement|ImportKategori`. Agen tidak menguji lewat browser kecuali pengguna mengizinkan; cek visual oleh pengguna di gerbang.
- Git: commit per task di `main`, tanpa trailer Co-Authored-By, stage dengan path eksplisit, tanpa push.

## Review Focus

1. **Kunci baris pohon**: induk dan anak berasal dari tabel berbeda sehingga id bisa sama (mis. induk 3 dan anak 3). Pagar: kunci `p-<id>` / `c-<id>` (Task 2).
2. **Buka/tutup induk lewat keyboard dan pembaca layar**: tombol harus punya `aria-label` dan `aria-expanded` yang benar. Pagar: Task 2.
3. **Select Kategori Induk bernilai angka/kosong**: `parent_id` bertipe `number | ''`, React Aria tidak menerima kunci `''`. Pagar: `selectedKey={data.parent_id === '' ? null : data.parent_id}` dan `Number(key)` (Task 1).
4. **Radio Jenis Kategori**: opsi "Subkategori" harus nonaktif di Edit bila kategori punya anak, disertai penjelasan, dan pilihan Induk/Sub harus tetap mengubah field yang tampil (Kategori Induk + Kode vs Kode saja). Pagar: `childDisabled` (Task 1).
5. **Kirim sebagai Induk membuang `parent_id`**: logika `transform` di `Create`/`Edit` tidak boleh berubah. Pagar: `transform` tetap di halaman, bukan di `CategoryForm` (Task 2).
6. **Hapus kategori**: dialog tidak bisa tertutup saat permintaan berjalan; kategori yang punya anak atau dipakai aset ditolak server dengan `errors.category` yang tetap tampil di banner. Pagar: `isLoading` pada `ConfirmDialog` dan banner dipertahankan (Task 3).
7. **Pagination sisi klien** tidak boleh menampilkan halaman kosong setelah data menyusut (mis. menghapus satu-satunya induk di halaman terakhir). Pagar: logika `totalPages`/`currentPage` dipertahankan persis; periksa di gerbang.
8. **Impor/Ekspor Kategori** tetap tampil sesuai izin (`ImportExportButtons modul="kategori"`). Pagar: Task 3.

---

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `resources/js/Pages/AssetCategories/Partials/CategoryForm.tsx` (baru) | Form bersama Tambah/Ubah Kategori |
| `resources/js/Pages/AssetCategories/Create.tsx` | Halaman Tambah (state, `useForm`, kirim) |
| `resources/js/Pages/AssetCategories/Edit.tsx` | Halaman Ubah (state, `useForm`, kirim) |
| `resources/js/Pages/AssetCategories/Index.tsx` | Daftar pohon |

---

### Task 1: `CategoryForm`

**Files:**
- Create: `resources/js/Pages/AssetCategories/Partials/CategoryForm.tsx`

**Interfaces:**
- Consumes: `Input`, `Select`, `TextArea`, `Button`, `Label` (`@/Components/ui/base/input/label`), `RadioGroup`/`RadioButton` (`@/Components/ui/base/radio-buttons/radio-buttons`).
- Produces: `CategoryForm` dan tipe `CategoryFormData`:
```ts
export type CategoryFormData = { name: string; parent_id: number | ''; code: string; description: string };
type Props = {
    form: InertiaFormProps<CategoryFormData>;
    parents: AssetCategory[];
    categoryType: 'child' | 'parent';
    onCategoryTypeChange: (type: 'child' | 'parent') => void;
    childDisabled?: boolean;
    parentHint: string;
    submitLabel: string;
    onSubmit: (e: FormEvent) => void;
    cancelHref: string;
};
```

- [ ] **Step 1: Tulis `CategoryForm.tsx`**

```tsx
import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import { Label } from '@/Components/ui/base/input/label';
import { RadioButton, RadioGroup } from '@/Components/ui/base/radio-buttons/radio-buttons';
import { Select } from '@/Components/ui/base/select/select';
import { TextArea } from '@/Components/ui/base/textarea/textarea';
import { AssetCategory } from '@/types';
import { InertiaFormProps } from '@inertiajs/react';
import { FormEvent } from 'react';

export type CategoryFormData = {
    name: string;
    parent_id: number | '';
    code: string;
    description: string;
};

type Props = {
    form: InertiaFormProps<CategoryFormData>;
    parents: AssetCategory[];
    categoryType: 'child' | 'parent';
    onCategoryTypeChange: (type: 'child' | 'parent') => void;
    childDisabled?: boolean;
    parentHint: string;
    submitLabel: string;
    onSubmit: (e: FormEvent) => void;
    cancelHref: string;
};

export default function CategoryForm({
    form,
    parents,
    categoryType,
    onCategoryTypeChange,
    childDisabled = false,
    parentHint,
    submitLabel,
    onSubmit,
    cancelHref,
}: Props) {
    const { data, setData, processing, errors } = form;

    const codeInput = (placeholder: string) => (
        <Input
            label="Kode Kategori"
            placeholder={placeholder}
            value={data.code}
            onChange={(v) => setData('code', v)}
            isInvalid={Boolean(errors.code)}
            hint={errors.code ?? 'Kode akan mengikuti format standar BMD'}
        />
    );

    return (
        <form onSubmit={onSubmit} className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
                <h2 className="border-b border-slate-100 pb-4 text-base font-semibold text-slate-900">
                    Informasi Kategori
                </h2>

                <div className="space-y-6 pt-6">
                    <RadioGroup
                        isRequired
                        className="gap-2"
                        value={categoryType}
                        onChange={(v) => onCategoryTypeChange(v as 'child' | 'parent')}
                    >
                        <Label isRequired>Jenis Kategori</Label>
                        <div className="flex flex-wrap items-center gap-6">
                            <RadioButton value="parent" label="Kategori Utama (Induk)" />
                            <RadioButton value="child" label="Subkategori" isDisabled={childDisabled} />
                        </div>
                        {childDisabled && (
                            <p className="text-xs text-amber-600">
                                Kategori ini memiliki subkategori, sehingga tidak dapat dijadikan subkategori dari
                                kategori lain.
                            </p>
                        )}
                    </RadioGroup>

                    {categoryType === 'child' ? (
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            <Select
                                label="Kategori Induk"
                                isRequired
                                placeholder="Pilih Kategori Induk"
                                items={parents.map((p) => ({ id: p.id, label: p.name }))}
                                selectedKey={data.parent_id === '' ? null : data.parent_id}
                                onSelectionChange={(key) => setData('parent_id', key == null ? '' : Number(key))}
                                isInvalid={Boolean(errors.parent_id)}
                                hint={errors.parent_id ?? parentHint}
                            >
                                {(item) => <Select.Item id={item.id} label={item.label} />}
                            </Select>
                            {codeInput('Contoh: 02.09.04')}
                        </div>
                    ) : (
                        <div className="max-w-md">{codeInput('Contoh: 02.09')}</div>
                    )}

                    <Input
                        label="Nama Kategori"
                        isRequired
                        placeholder="Masukkan nama kategori (huruf kapital)"
                        value={data.name}
                        onChange={(v) => setData('name', v)}
                        isInvalid={Boolean(errors.name)}
                        hint={errors.name}
                    />
                    <TextArea
                        label="Deskripsi (Opsional)"
                        rows={4}
                        placeholder="Tambahkan keterangan kategori jika diperlukan"
                        value={data.description}
                        onChange={(v) => setData('description', v)}
                        isInvalid={Boolean(errors.description)}
                        hint={errors.description}
                    />
                </div>
            </div>

            <div className="flex items-center justify-end gap-3">
                <Button color="secondary" size="md" href={cancelHref}>
                    Batal
                </Button>
                <Button color="primary" size="md" type="submit" isLoading={processing}>
                    {submitLabel}
                </Button>
            </div>
        </form>
    );
}
```

- [ ] **Step 2: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
git add resources/js/Pages/AssetCategories/Partials/CategoryForm.tsx
git commit -m "feat(ui): add the shared category form on Untitled UI components"
```
Expected: bersih (komponen belum dipakai halaman). Bila prop `RadioGroup`/`Label` berbeda dari yang diasumsikan, sesuaikan dan catat sebagai `Ruling`.

---

### Task 2: `Create` dan `Edit`

**Files:**
- Modify: `resources/js/Pages/AssetCategories/Create.tsx`, `resources/js/Pages/AssetCategories/Edit.tsx` (ganti seluruh isi)

**Interfaces:**
- Consumes: `CategoryForm`, `CategoryFormData` (Task 1), `PageHeader`.
- Produces: halaman dengan props Inertia sama (`Create`: `{ parents }`; `Edit`: `{ category, parents }`).

- [ ] **Step 1: `Create.tsx`**

```tsx
import PageHeader from '@/Components/PageHeader';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import CategoryForm, { CategoryFormData } from '@/Pages/AssetCategories/Partials/CategoryForm';
import { AssetCategory, PageProps } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

export default function Create({ parents }: PageProps<{ parents: AssetCategory[] }>) {
    // Radio toggle: 'child' (Subkategori) or 'parent' (Kategori Utama)
    const [categoryType, setCategoryType] = useState<'child' | 'parent'>(parents.length > 0 ? 'child' : 'parent');

    const form = useForm<CategoryFormData>({
        name: '',
        parent_id: parents[0]?.id ?? '',
        code: '',
        description: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();

        form.transform((values) => ({
            ...values,
            parent_id: categoryType === 'parent' || values.parent_id === '' ? null : values.parent_id,
        }));

        form.post(route('asset-categories.store'));
    };

    return (
        <AuthenticatedLayout>
            <Head title="Tambah Kategori Aset" />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Kategori Aset', href: route('asset-categories.index') }, { label: 'Tambah Kategori' }]}
                    title="Tambah Kategori Aset"
                />

                <CategoryForm
                    form={form}
                    parents={parents}
                    categoryType={categoryType}
                    onCategoryTypeChange={setCategoryType}
                    parentHint="Pilih kategori utama untuk subkategori baru ini"
                    submitLabel="Simpan Kategori"
                    onSubmit={submit}
                    cancelHref={route('asset-categories.index')}
                />
            </div>
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 2: `Edit.tsx`**

```tsx
import PageHeader from '@/Components/PageHeader';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import CategoryForm, { CategoryFormData } from '@/Pages/AssetCategories/Partials/CategoryForm';
import { AssetCategory, PageProps } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

export default function Edit({
    category,
    parents,
}: PageProps<{
    category: AssetCategory & { children_count?: number };
    parents: AssetCategory[];
}>) {
    const hasChildren = (category.children_count ?? 0) > 0;

    // Initial category type based on whether category has parent_id
    const [categoryType, setCategoryType] = useState<'child' | 'parent'>(
        category.parent_id !== null ? 'child' : 'parent',
    );

    const form = useForm<CategoryFormData>({
        name: category.name,
        parent_id: category.parent_id ?? parents[0]?.id ?? '',
        code: category.code ?? category.formatted_code ?? '',
        description: category.description ?? '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();

        form.transform((values) => ({
            ...values,
            parent_id: categoryType === 'parent' || values.parent_id === '' ? null : values.parent_id,
        }));

        form.put(route('asset-categories.update', category.id));
    };

    return (
        <AuthenticatedLayout>
            <Head title={`Ubah Kategori - ${category.name}`} />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Kategori Aset', href: route('asset-categories.index') }, { label: 'Ubah Kategori' }]}
                    title="Ubah Kategori Aset"
                />

                <CategoryForm
                    form={form}
                    parents={parents}
                    categoryType={categoryType}
                    onCategoryTypeChange={setCategoryType}
                    childDisabled={hasChildren}
                    parentHint="Pilih kategori utama untuk subkategori ini"
                    submitLabel="Simpan Perubahan"
                    onSubmit={submit}
                    cancelHref={route('asset-categories.index')}
                />
            </div>
        </AuthenticatedLayout>
    );
}
```
Sebelum menimpa, bandingkan `git show HEAD:<berkas>` dengan blok di atas untuk memastikan tidak ada impor/logika lain yang terlewat (mis. `Link` untuk tombol Batal sudah digantikan `Button href`).

- [ ] **Step 3: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
grep -n "InputError\|@/Components/Icons" resources/js/Pages/AssetCategories/Create.tsx resources/js/Pages/AssetCategories/Edit.tsx
php artisan test --compact --filter='AssetCategoryManagement'
git add resources/js/Pages/AssetCategories/Create.tsx resources/js/Pages/AssetCategories/Edit.tsx
git commit -m "feat(ui): migrate the category create and edit pages to Untitled UI components"
```
Expected: bersih; `grep` kosong; test hijau.

---

### Task 3: `Index` (tabel pohon)

**Files:**
- Modify: `resources/js/Pages/AssetCategories/Index.tsx` (ganti seluruh isi)

**Interfaces:**
- Consumes: `PageHeader`, `ConfirmDialog`, `ImportExportButtons`, `Table`, `PaginationPageDefault`, `Badge`, `Button`, `Tooltip`; ikon `ChevronDown`, `Edit01`, `Plus`, `Trash01`.
- Produces: halaman dengan props Inertia sama (`categories`, `can`).

- [ ] **Step 1: Tulis ulang `Index.tsx`**

```tsx
import ConfirmDialog from '@/Components/ConfirmDialog';
import ImportExportButtons from '@/Components/ImportExportButtons';
import PageHeader from '@/Components/PageHeader';
import { PaginationPageDefault } from '@/Components/ui/application/pagination/pagination';
import { Table } from '@/Components/ui/application/table/table';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { Tooltip } from '@/Components/ui/base/tooltip/tooltip';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AssetCategory, PageProps } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { ChevronDown, Edit01, Plus, Trash01 } from '@untitledui/icons';
import { useMemo, useState } from 'react';

interface Row {
    key: string;
    category: AssetCategory;
    code: string;
    assets: number;
    isChild: boolean;
}

export default function Index({
    categories,
    can = { create: true, update: true, delete: true },
}: PageProps<{
    categories: AssetCategory[];
    can?: { create: boolean; update: boolean; delete: boolean };
}>) {
    const { errors } = usePage<PageProps<{ errors: Record<string, string> }>>().props;

    // Expand/collapse tracking for parent categories (default expanded)
    const [expanded, setExpanded] = useState<Record<number, boolean>>(() => {
        const init: Record<number, boolean> = {};
        categories.forEach((cat) => {
            init[cat.id] = true;
        });
        return init;
    });

    const toggleExpand = (id: number) => {
        setExpanded((prev) => ({
            ...prev,
            [id]: !prev[id],
        }));
    };

    // Category delete confirmation modal state
    const [deletingCategory, setDeletingCategory] = useState<AssetCategory | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const confirmDelete = () => {
        if (!deletingCategory) return;
        setIsDeleting(true);
        router.delete(route('asset-categories.destroy', deletingCategory.id), {
            preserveScroll: true,
            onFinish: () => {
                setIsDeleting(false);
                setDeletingCategory(null);
            },
        });
    };

    // Pagination (5 parent categories per page as designed in Figma)
    const itemsPerPage = 5;
    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = Math.ceil(categories.length / itemsPerPage) || 1;

    const displayedCategories = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return categories.slice(start, start + itemsPerPage);
    }, [categories, currentPage]);

    // Parent and (when expanded) child rows flattened for the table; keys differ per table of origin
    const rows = useMemo<Row[]>(
        () =>
            displayedCategories.flatMap((category) => {
                const children = category.children ?? [];
                const code = category.code || category.formatted_code || `01.${String(category.id).padStart(2, '0')}`;
                const parent: Row = {
                    key: `p-${category.id}`,
                    category,
                    code,
                    assets: (category.assets_count ?? 0) + children.reduce((sum, child) => sum + (child.assets_count ?? 0), 0),
                    isChild: false,
                };
                const childRows: Row[] = expanded[category.id]
                    ? children.map((child, idx) => ({
                          key: `c-${child.id}`,
                          category: child,
                          code: child.code || child.formatted_code || `${code}.${String(idx + 1).padStart(2, '0')}`,
                          assets: child.assets_count ?? 0,
                          isChild: true,
                      }))
                    : [];

                return [parent, ...childRows];
            }),
        [displayedCategories, expanded],
    );

    return (
        <AuthenticatedLayout>
            <Head title="Master Kategori Aset" />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Kategori Aset' }]}
                    title="Master Kategori Aset"
                    actions={
                        <>
                            <ImportExportButtons modul="kategori" />
                            {can.create && (
                                <Button color="primary" size="md" iconLeading={Plus} href={route('asset-categories.create')}>
                                    Tambah Kategori
                                </Button>
                            )}
                        </>
                    }
                />

                {/* Error Banner */}
                {errors.category && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
                        {errors.category}
                    </div>
                )}

                {/* Data Table Card */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    <Table aria-label="Daftar kategori aset">
                        <Table.Header>
                            <Table.Head id="nama" label="Nama Kategori" isRowHeader />
                            <Table.Head id="kode" label="Kode" />
                            <Table.Head id="jumlah" label="Jumlah Aset" />
                            <Table.Head id="aksi" label="Aksi" />
                        </Table.Header>
                        <Table.Body
                            items={rows}
                            renderEmptyState={() => (
                                <div className="flex flex-col items-center gap-3 py-12 text-center">
                                    <p className="text-sm text-slate-400">Belum ada data kategori aset.</p>
                                    {can.create && (
                                        <Button color="secondary-brand" size="sm" iconLeading={Plus} href={route('asset-categories.create')}>
                                            Tambah Kategori
                                        </Button>
                                    )}
                                </div>
                            )}
                        >
                            {(row) => {
                                const isExpanded = expanded[row.category.id] ?? false;
                                const noun = row.isChild ? 'subkategori' : 'kategori';

                                return (
                                    <Table.Row id={row.key}>
                                        <Table.Cell>
                                            {row.isChild ? (
                                                <div className="flex items-center">
                                                    <span className="mr-3 ml-5 inline-block h-px w-4 bg-slate-300" aria-hidden="true" />
                                                    <span className="text-sm font-medium text-slate-700">{row.category.name}</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        color="tertiary"
                                                        size="sm"
                                                        iconLeading={ChevronDown}
                                                        aria-label={isExpanded ? 'Tutup subkategori' : 'Buka subkategori'}
                                                        aria-expanded={isExpanded}
                                                        className={isExpanded ? undefined : '*:data-icon:-rotate-90'}
                                                        onPress={() => toggleExpand(row.category.id)}
                                                    />
                                                    <span className="font-bold uppercase tracking-tight text-slate-900">
                                                        {row.category.name}
                                                    </span>
                                                </div>
                                            )}
                                        </Table.Cell>
                                        <Table.Cell className="font-mono tabular-nums">{row.code}</Table.Cell>
                                        <Table.Cell>
                                            <Badge type="color" size="sm" color={row.isChild ? 'brand' : 'gray'} className="rounded-sm">
                                                {row.assets} unit
                                            </Badge>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <div className="flex items-center gap-2">
                                                {can.update && (
                                                    <Tooltip title={`Ubah ${noun}`}>
                                                        <Button
                                                            color="secondary-green"
                                                            size="sm"
                                                            iconLeading={Edit01}
                                                            aria-label={`Ubah ${noun}`}
                                                            href={route('asset-categories.edit', row.category.id)}
                                                        />
                                                    </Tooltip>
                                                )}
                                                {can.delete && (
                                                    <Tooltip title={`Hapus ${noun}`}>
                                                        <Button
                                                            color="secondary-destructive"
                                                            size="sm"
                                                            iconLeading={Trash01}
                                                            aria-label={`Hapus ${noun}`}
                                                            onPress={() => setDeletingCategory(row.category)}
                                                        />
                                                    </Tooltip>
                                                )}
                                            </div>
                                        </Table.Cell>
                                    </Table.Row>
                                );
                            }}
                        </Table.Body>
                    </Table>

                    {/* Table Footer with Pagination */}
                    <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4">
                        <p className="text-xs text-slate-500">
                            Menampilkan <span className="font-semibold tabular-nums text-slate-800">{displayedCategories.length}</span>{' '}
                            dari <span className="font-semibold tabular-nums text-slate-800">{categories.length}</span> kategori
                        </p>

                        {totalPages > 1 && (
                            <PaginationPageDefault
                                className="border-t-0 pt-0 md:pt-0"
                                page={currentPage}
                                total={totalPages}
                                onPageChange={setCurrentPage}
                            />
                        )}
                    </div>
                </div>
            </div>

            {deletingCategory && (
                <ConfirmDialog
                    title={deletingCategory.parent_id === null ? 'Hapus Kategori Aset' : 'Hapus Subkategori'}
                    confirmLabel={deletingCategory.parent_id === null ? 'Ya, Hapus Kategori' : 'Ya, Hapus Subkategori'}
                    isLoading={isDeleting}
                    onConfirm={confirmDelete}
                    onClose={() => setDeletingCategory(null)}
                >
                    Apakah Anda yakin ingin menghapus {deletingCategory.parent_id === null ? 'kategori' : 'subkategori'}{' '}
                    <strong className="text-slate-900">&quot;{deletingCategory.name}&quot;</strong>? Kategori yang memiliki
                    subkategori atau sedang digunakan aset tidak dapat dihapus.
                </ConfirmDialog>
            )}
        </AuthenticatedLayout>
    );
}
```
Cocokkan prop tabel hasil CLI bila ada selisih (mis. `Table.Cell className`, `aria-expanded` pada `Button`); sesuaikan dan catat sebagai `Ruling`.

- [ ] **Step 2: Verifikasi dan pagar**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
grep -rn "InputError\|@/Components/Icons\|@/components/" resources/js/Pages/AssetCategories
php artisan test --compact --filter='AssetCategory|ImportKategori'
```
Expected: bersih; `grep` kosong; test hijau.

- [ ] **Step 3: Commit**

```bash
git add resources/js/Pages/AssetCategories/Index.tsx
git commit -m "feat(ui): migrate the category list page to Untitled UI components"
```

- [ ] **Step 4: GERBANG KATEGORI ASET — berhenti**

Laporkan hasil Task 1–3, `Ruling`, dan hal yang tak bisa diverifikasi tanpa browser. Minta pengguna memeriksa (Kategori Aset → Tambah → Ubah → Hapus):
- **Daftar**: induk berhuruf tebal kapital dan anak menjorok dengan garis konektor; tombol panah membuka/menutup anak (keyboard Tab+Enter/Spasi, panah berputar); kode `tabular`; badge jumlah unit (abu untuk induk, biru untuk anak); tombol ubah hijau dan hapus merah dengan tooltip; pagination 5 induk per halaman dan teks "Menampilkan x dari y kategori"; Impor/Ekspor sesuai izin.
- **Tambah**: radio Induk/Sub mengganti field (Kategori Induk + Kode, atau Kode saja); kirim kosong ditolak browser; galat server per field; Simpan berhasil; Batal berpindah tanpa muat ulang penuh.
- **Ubah**: nilai awal terisi; kategori yang punya anak: opsi Subkategori nonaktif disertai penjelasan; Simpan Perubahan.
- **Hapus**: dialog (Esc/klik di luar menutup, tombol terkunci saat memproses); hapus kategori yang punya anak/dipakai aset menampilkan banner galat merah; hapus berhasil; pagination tidak menyisakan halaman kosong.
- Umum: layar 375 px (tabel menggulir), keyboard, cincin fokus.
**Jangan memulai modul berikutnya** sebelum pengguna menyatakan lolos.
