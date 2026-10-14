# Migrasi Untitled UI, Fase 4: Modul Aset (sisa halaman) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyelesaikan migrasi modul Aset ke Untitled UI: form Tambah/Ubah (`AssetForm`, `Create`, `Edit`) dan halaman detail (`Show`). `Assets/Index` sudah selesai di pilot.

**Architecture:** `AssetForm` (form bersama Create/Edit) memakai `Input`/`Select`/`TextArea` dengan label, bantuan, dan galat bawaan komponen. `Create`/`Edit`/`Show` memakai `PageHeader`. Konfirmasi hapus foto di Edit memakai `ConfirmDialog`. Tombol aksi memakai aturan warna yang sudah disepakati.

**Tech Stack:** React 19, Inertia 2, Tailwind 4, Untitled UI (React Aria Components), `@untitledui/icons`.

**Spec:** `docs/superpowers/specs/2026-10-14-migrasi-untitled-ui-design.md` §3.5 (modul Aset dikerjakan di luar urutan kelompok atas permintaan pengguna 2026-10-14). Komponen bersama: commit `c1c16e8` (`PageHeader`, `ConfirmDialog`, `TextArea`). Plan ini sudah memuat hasil review ponytail dan impeccable (2026-10-14).

## Global Constraints

- Hanya komponen Untitled UI gratis. Tampilan mengikuti Panduan UI/UX untuk identitas (Sapphire, `tabular-nums` pada angka, badge radius 4px, tanpa kartu di dalam kartu) dan Untitled UI untuk semantik, keyboard, fokus.
- Logika tidak berubah: `useForm`, `forceFormData`, `_method: 'put'`, `transform`, handler foto, `can.*`, props Inertia, dan nama berkas.
- Halaman yang dimigrasi tidak mencampur komponen Breeze (`InputError`, dst.) dan tidak memakai `@/Components/Icons` untuk ikon baru; impor memakai `@/Components/...` berhuruf besar. `Icons.tsx` tidak diubah (dipakai halaman lain).
- Galat validasi lewat `hint={errors.x}` + `isInvalid={Boolean(errors.x)}`; teks bantuan biasa bila tidak ada galat.
- Warna tombol: aksi utama `primary`; "Cetak Label QR" `secondary-violet`; "Edit Data" `secondary-green`; hapus `primary-destructive`/`secondary-destructive`; Batal `secondary`.
- Tanpa dependensi baru. Verifikasi: `npx tsc --noEmit`, `npm run build`, test backend terkait. Agen tidak menguji lewat browser kecuali pengguna mengizinkan; cek visual oleh pengguna di gerbang.
- Git: commit per task di `main`, tanpa trailer Co-Authored-By, stage dengan path eksplisit, tanpa push.

## Review Focus

1. **Select dengan nilai kosong/angka**: React Aria tidak menerima kunci `''`, dan `category_id` bertipe `number | ''`. Pagar: `selectedKey={data.category_id === '' ? null : data.category_id}`, `Number(key)` saat memilih (Task 1).
2. **Atribut `min="0"` hilang** karena `Input` tidak meneruskannya. Server memvalidasi `min:0` dan `nilai_buku ≤ nilai_perolehan` (`StoreAssetRequest`), jadi galat tetap tampil lewat `hint`. Pagar: `inputMode="numeric"` dan test backend (Task 1).
3. **Validasi bawaan browser (`required`)** pada subkategori, kode, nama, tanggal, nilai, dan kondisi harus tetap mencegah pengiriman form kosong. Pagar: `isRequired` pada setiap field wajib (Task 1); butir gerbang.
4. **Unggah foto**: batas `maxPhotos`, penggabungan file baru dengan yang sudah dipilih, pratinjau `URL.createObjectURL`, dan pengiriman `forceFormData` tidak boleh berubah; area unggah harus bisa dioperasikan keyboard (sebelumnya `div` dengan `onClick`). Pagar: `<button>` sungguhan (Task 1).
5. **Hapus foto lama (Edit)** sebelumnya `confirm()` native; sekarang `ConfirmDialog` yang tidak bisa ditutup saat permintaan berjalan, dan foto tidak boleh terhapus bila dialog dibatalkan. Pagar: Task 2.
6. **Tombol Batal** sebelumnya `<a href>` (muat ulang penuh); sekarang `Button href` lewat Inertia. Pagar: `RouterProvider` dari Fase 2; butir gerbang.
7. **Isian Edit hilang saat hapus foto** (Inertia me-remount halaman bila state tidak dipertahankan). Pagar: `preserveState: true` pada `router.delete` (Task 2); butir gerbang.
8. **Galat server di bagian atas form panjang tak terlihat** dari tombol Simpan. Pagar: gulir/fokus ke field galat pertama dan ringkasan jumlah galat (Task 1).
9. **Batas nilai buku ≤ nilai perolehan** baru diketahui setelah gagal kirim. Pagar: hint tetap + pratinjau Rupiah (Task 1).
10. **Badge Kondisi/Status di Show** untuk nilai tak dikenal (mis. status baru) tidak boleh membuat halaman crash. Pagar: fallback `?? 'gray'` (Task 3).

---

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `resources/js/Pages/Assets/Partials/AssetForm.tsx` | Form bersama Tambah/Ubah |
| `resources/js/Pages/Assets/Create.tsx` | Halaman Tambah Aset |
| `resources/js/Pages/Assets/Edit.tsx` | Halaman Ubah Aset (+ konfirmasi hapus foto) |
| `resources/js/Pages/Assets/Show.tsx` | Halaman detail |
| `resources/js/Components/PageHeader.tsx` | Menambah prop `badges` (Task 3) |

---

### Task 1: `AssetForm`

**Files:**
- Modify: `resources/js/Pages/Assets/Partials/AssetForm.tsx` (ganti seluruh isi)

**Interfaces:**
- Consumes: `Input`, `Select`, `TextArea`, `Button`; ikon `UploadCloud02`, `Plus`, `XClose`.
- Produces: `AssetForm` dengan props dan tipe `AssetFormData` **tidak berubah**: `{ form, categories, kondisiOptions?, maxPhotos, existingPhotos?, onRemoveExistingPhoto?, submitLabel, onSubmit, cancelHref }`.

- [ ] **Step 1: Tulis ulang `AssetForm.tsx`**

```tsx
import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import { Select } from '@/Components/ui/base/select/select';
import { TextArea } from '@/Components/ui/base/textarea/textarea';
import { AssetCategory, AssetPhoto } from '@/types';
import { InertiaFormProps } from '@inertiajs/react';
import { Plus, UploadCloud02, XClose } from '@untitledui/icons';
import { ChangeEvent, FormEvent, useEffect, useRef } from 'react';

export type AssetFormData = {
    category_id: number | '';
    kode_barang: string;
    nama_aset: string;
    merk_type: string;
    kondisi?: string;
    tanggal_perolehan: string;
    sumber_perolehan: string;
    nilai_perolehan: string;
    nilai_buku: string;
    no_dokumen: string;
    keterangan: string;
    photos: File[];
};

type Props = {
    form: InertiaFormProps<AssetFormData>;
    categories: AssetCategory[];
    kondisiOptions?: { value: string; label: string }[];
    maxPhotos: number;
    existingPhotos?: AssetPhoto[];
    onRemoveExistingPhoto?: (photo: AssetPhoto) => void;
    submitLabel: string;
    onSubmit: (e: FormEvent) => void;
    cancelHref: string;
};

const rupiah = (value: string) =>
    value === '' || Number.isNaN(Number(value))
        ? undefined
        : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value));

function SectionTitle({ children }: { children: string }) {
    return (
        <div className="border-b border-slate-100 pb-2">
            <h2 className="text-base font-semibold text-slate-900">{children}</h2>
        </div>
    );
}

export default function AssetForm({
    form,
    categories,
    kondisiOptions,
    maxPhotos,
    existingPhotos = [],
    onRemoveExistingPhoto,
    submitLabel,
    onSubmit,
    cancelHref,
}: Props) {
    const { data, setData, processing, errors } = form;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const errorCount = Object.keys(errors).length;

    // Form panjang: setelah kirim gagal, bawa pengguna ke isian bermasalah pertama.
    useEffect(() => {
        if (errorCount === 0) return;
        const target = formRef.current?.querySelector<HTMLElement>(
            '[aria-invalid="true"], [data-invalid], [data-photo-error]',
        );
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target?.focus({ preventScroll: true });
    }, [errors]);

    const handlePhotosChange = (e: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        setData('photos', [...data.photos, ...files].slice(0, maxPhotos));
    };

    const removeNewPhoto = (index: number) => {
        setData(
            'photos',
            data.photos.filter((_, i) => i !== index),
        );
    };

    const totalPhotoCount = existingPhotos.length + data.photos.length;

    const categoryItems = categories.flatMap((kategori) =>
        (kategori.children ?? []).map((sub) => ({ id: sub.id, label: `${kategori.name} › ${sub.name}` })),
    );

    const photoButtonClass =
        'rounded-sm outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1';

    return (
        <form ref={formRef} onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-8 rounded-xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
                {/* Informasi Dasar Aset */}
                <section className="space-y-4">
                    <SectionTitle>Informasi Dasar Aset</SectionTitle>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Select
                            label="Subkategori Aset"
                            isRequired
                            placeholder="Pilih subkategori..."
                            popoverClassName="w-[46rem]! max-w-[calc(100vw-2rem)]"
                            items={categoryItems}
                            selectedKey={data.category_id === '' ? null : data.category_id}
                            onSelectionChange={(key) => setData('category_id', key == null ? '' : Number(key))}
                            isInvalid={Boolean(errors.category_id)}
                            hint={errors.category_id}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                        <Input
                            label="Kode Barang BMD"
                            isRequired
                            placeholder="1.3.2.05.02.04.xxx"
                            inputClassName="font-mono"
                            value={data.kode_barang}
                            onChange={(v) => setData('kode_barang', v)}
                            isInvalid={Boolean(errors.kode_barang)}
                            hint={errors.kode_barang ?? 'Format kode BMD, mis. 1.3.2.05.02.04.xxx'}
                        />
                        <Input
                            label="Nama Barang"
                            isRequired
                            placeholder="Masukkan nama barang aset"
                            value={data.nama_aset}
                            onChange={(v) => setData('nama_aset', v)}
                            isInvalid={Boolean(errors.nama_aset)}
                            hint={errors.nama_aset}
                        />
                        <Input
                            label="Merk / Tipe Pabrikasi"
                            placeholder="Masukkan merk atau tipe"
                            value={data.merk_type}
                            onChange={(v) => setData('merk_type', v)}
                            isInvalid={Boolean(errors.merk_type)}
                            hint={errors.merk_type}
                        />
                        {kondisiOptions && (
                            <Select
                                label="Kondisi Saat Dicatat"
                                isRequired
                                items={kondisiOptions.map((o) => ({ id: o.value, label: o.label }))}
                                selectedKey={data.kondisi ?? null}
                                onSelectionChange={(key) => setData('kondisi', String(key))}
                                isInvalid={Boolean(errors.kondisi)}
                                hint={errors.kondisi}
                            >
                                {(item) => <Select.Item id={item.id} label={item.label} />}
                            </Select>
                        )}
                    </div>
                </section>

                {/* Informasi Perolehan */}
                <section className="space-y-4">
                    <SectionTitle>Informasi Perolehan</SectionTitle>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input
                            label="Tanggal Perolehan"
                            type="date"
                            isRequired
                            value={data.tanggal_perolehan}
                            onChange={(v) => setData('tanggal_perolehan', v)}
                            isInvalid={Boolean(errors.tanggal_perolehan)}
                            hint={errors.tanggal_perolehan}
                        />
                        <Input
                            label="Sumber Perolehan"
                            placeholder="mis. APBD, Hibah, Bantuan"
                            value={data.sumber_perolehan}
                            onChange={(v) => setData('sumber_perolehan', v)}
                            isInvalid={Boolean(errors.sumber_perolehan)}
                            hint={errors.sumber_perolehan}
                        />
                        <Input
                            label="Nilai Perolehan (Rp)"
                            type="number"
                            inputMode="numeric"
                            isRequired
                            placeholder="Masukkan nilai perolehan"
                            inputClassName="tabular-nums"
                            value={data.nilai_perolehan}
                            onChange={(v) => setData('nilai_perolehan', v)}
                            isInvalid={Boolean(errors.nilai_perolehan)}
                            hint={errors.nilai_perolehan ?? rupiah(data.nilai_perolehan)}
                        />
                        <Input
                            label="Nilai Buku Saat Ini (Rp)"
                            type="number"
                            inputMode="numeric"
                            isRequired
                            placeholder="Masukkan nilai buku saat ini"
                            inputClassName="tabular-nums"
                            value={data.nilai_buku}
                            onChange={(v) => setData('nilai_buku', v)}
                            isInvalid={Boolean(errors.nilai_buku)}
                            hint={
                                errors.nilai_buku ??
                                [rupiah(data.nilai_buku), 'Tidak boleh melebihi nilai perolehan'].filter(Boolean).join(' · ')
                            }
                        />
                        <div className="sm:col-span-2">
                            <Input
                                label="No. Dokumen Pengadaan / BAST"
                                placeholder="Masukkan nomor dokumen pengadaan atau berita acara serah terima"
                                value={data.no_dokumen}
                                onChange={(v) => setData('no_dokumen', v)}
                                isInvalid={Boolean(errors.no_dokumen)}
                                hint={errors.no_dokumen}
                            />
                        </div>
                    </div>
                </section>

                {/* Foto Aset */}
                <section className="space-y-4">
                    <SectionTitle>Foto Aset</SectionTitle>
                    <div className="space-y-3">
                        <p className="text-sm font-medium text-slate-700">Unggah Foto Aset</p>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handlePhotosChange}
                            accept="image/jpeg,image/png,image/webp"
                            multiple
                            className="hidden"
                        />
                        {totalPhotoCount < maxPhotos && (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center outline-hidden transition hover:border-blue-400 hover:bg-blue-50/30 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
                            >
                                <UploadCloud02 className="size-8 text-slate-400" aria-hidden="true" />
                                <span className="text-sm text-slate-700">
                                    <span className="font-semibold text-slate-900">Klik untuk unggah</span> foto aset
                                </span>
                                <span className="text-xs text-slate-500">
                                    Maksimal {maxPhotos} foto, masing-masing maks. 5MB (JPG, PNG, WebP)
                                </span>
                            </button>
                        )}
                        {errors.photos && (
                            <p data-photo-error tabIndex={-1} className="text-sm text-red-600 outline-hidden">
                                {errors.photos}
                            </p>
                        )}

                        {(existingPhotos.length > 0 || data.photos.length > 0) && (
                            <div className="flex flex-wrap gap-3">
                                {existingPhotos.map((photo) => (
                                    <div key={photo.id} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-sm bg-slate-100">
                                        <img src={photo.url} alt="" className="h-full w-full object-cover" />
                                        {onRemoveExistingPhoto && (
                                            <button
                                                type="button"
                                                onClick={() => onRemoveExistingPhoto(photo)}
                                                className={`absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-red-500 text-white before:absolute before:-inset-1.5 ${photoButtonClass}`}
                                                aria-label="Hapus foto"
                                            >
                                                <XClose className="size-3" aria-hidden="true" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {data.photos.map((file, idx) => (
                                    <div key={idx} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-sm bg-slate-100">
                                        <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => removeNewPhoto(idx)}
                                            className={`absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-red-500 text-white before:absolute before:-inset-1.5 ${photoButtonClass}`}
                                            aria-label="Batalkan foto"
                                        >
                                            <XClose className="size-3" aria-hidden="true" />
                                        </button>
                                    </div>
                                ))}
                                {totalPhotoCount < maxPhotos && (
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        aria-label="Tambah foto"
                                        className={`flex h-20 w-20 shrink-0 items-center justify-center border border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-blue-400 hover:text-blue-600 ${photoButtonClass}`}
                                    >
                                        <Plus className="size-5" aria-hidden="true" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </section>

                {/* Keterangan */}
                <section className="space-y-4">
                    <SectionTitle>Keterangan Tambahan</SectionTitle>
                    <TextArea
                        label="Keterangan"
                        rows={4}
                        placeholder="Tambahkan catatan atau keterangan tambahan mengenai kondisi detail aset..."
                        value={data.keterangan}
                        onChange={(v) => setData('keterangan', v)}
                        isInvalid={Boolean(errors.keterangan)}
                        hint={errors.keterangan}
                    />
                </section>
            </div>

            <div className="flex items-center justify-end gap-3">
                {errorCount > 0 && (
                    <p role="alert" className="mr-auto text-sm font-medium text-red-600">
                        {errorCount} isian perlu diperbaiki
                    </p>
                )}
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

- [ ] **Step 2: Verifikasi dan pagar**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
grep -n "InputError\|@/Components/Icons" resources/js/Pages/Assets/Partials/AssetForm.tsx
```
Expected: `tsc` dan build bersih; `grep` tidak menemukan apa pun. Prop `Input`/`Select`/`TextArea` yang berbeda dari yang diasumsikan (mis. `inputMode`, `isRequired` pada `TextArea`) disesuaikan dalam commit yang sama dan dicatat sebagai `Ruling`. Selector efek gulir-ke-galat (`[aria-invalid="true"], [data-invalid], [data-photo-error]`) harus cocok dengan atribut yang benar-benar dipasang React Aria pada input dan tombol `Select` yang tidak valid; sesuaikan bila berbeda dan catat sebagai `Ruling`.

- [ ] **Step 3: Commit**

```bash
git add resources/js/Pages/Assets/Partials/AssetForm.tsx
git commit -m "feat(ui): migrate the asset form to Untitled UI components"
```

---

### Task 2: `Create` dan `Edit`

**Files:**
- Modify: `resources/js/Pages/Assets/Create.tsx`, `resources/js/Pages/Assets/Edit.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `ConfirmDialog`, `AssetForm` (Task 1).
- Produces: halaman dengan props Inertia sama.

- [ ] **Step 1: `Create.tsx`**

Ganti impor `ChevronRightIcon` dan `Link` serta blok header (`<div><nav>…</nav><h1>…</h1></div>`):
```tsx
import PageHeader from '@/Components/PageHeader';
// ...
import { Head, useForm } from '@inertiajs/react';
```
```tsx
<PageHeader
    crumbs={[{ label: 'Data Aset', href: route('assets.index') }, { label: 'Tambah Aset Baru' }]}
    title="Tambah Aset Baru"
/>
```
Sisanya (state `useForm`, `submit`, `<AssetForm …/>`) tidak berubah.

- [ ] **Step 2: `Edit.tsx`**

Impor: hapus `ChevronRightIcon` dan `Link`; tambah `PageHeader`, `ConfirmDialog`, `useState`:
```tsx
import ConfirmDialog from '@/Components/ConfirmDialog';
import PageHeader from '@/Components/PageHeader';
import { Head, router, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';
```
Ganti `removeExistingPhoto` dan tambahkan state:
```tsx
const [photoToDelete, setPhotoToDelete] = useState<AssetPhoto | null>(null);
const [deletingPhoto, setDeletingPhoto] = useState(false);

const confirmDeletePhoto = () => {
    if (!photoToDelete) return;
    setDeletingPhoto(true);
    router.delete(route('assets.photos.destroy', { asset: asset.id, photo: photoToDelete.id }), {
        preserveScroll: true,
        preserveState: true,
        onFinish: () => {
            setDeletingPhoto(false);
            setPhotoToDelete(null);
        },
    });
};
```
Header:
```tsx
<PageHeader
    crumbs={[{ label: 'Data Aset', href: route('assets.index') }, { label: 'Ubah Aset' }]}
    title="Ubah Data Aset"
/>
```
`AssetForm` menerima `onRemoveExistingPhoto={setPhotoToDelete}`; dan setelah `</AssetForm>` di dalam `AuthenticatedLayout` tambahkan:
```tsx
{photoToDelete && (
    <ConfirmDialog
        title="Hapus Foto Aset"
        confirmLabel="Ya, Hapus Foto"
        isLoading={deletingPhoto}
        onConfirm={confirmDeletePhoto}
        onClose={() => setPhotoToDelete(null)}
    >
        Foto ini akan dihapus dari aset.
    </ConfirmDialog>
)}
```

- [ ] **Step 3: Verifikasi**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
php artisan test --compact --filter='Asset'
```
Expected: bersih dan hijau.

- [ ] **Step 4: Commit**

```bash
git add resources/js/Pages/Assets/Create.tsx resources/js/Pages/Assets/Edit.tsx
git commit -m "feat(ui): migrate the asset create and edit pages to Untitled UI components"
```

---

### Task 3: `Show`

**Files:**
- Modify: `resources/js/Components/PageHeader.tsx`, `resources/js/Pages/Assets/Show.tsx`

**Interfaces:**
- Consumes: `PageHeader` (+ slot `actions`), `Button` (`secondary-violet`, `secondary-green`), `Badge`, ikon `Camera01`, `Edit01`, `Printer`.

- [ ] **Step 0: `PageHeader` mendukung `badges`**

Badge Kondisi/Status adalah keterangan tentang judul, bukan aksi, jadi tampil di samping `h1`. Di `resources/js/Components/PageHeader.tsx` tambah prop `badges?: ReactNode` dan ganti baris `h1`:
```tsx
{
    crumbs,
    title,
    badges,
    actions,
}: {
    crumbs: Crumb[];
    title: string;
    badges?: ReactNode;
    actions?: ReactNode;
}
```
```tsx
<div className="flex flex-wrap items-center gap-3">
    <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
    {badges}
</div>
```
Halaman lain yang sudah memakai `PageHeader` (Data Aset) tidak berubah karena `badges` opsional.

- [ ] **Step 1: Impor dan peta badge**

Ganti blok impor ikon `@/Components/Icons` dan `Link` serta konstanta gaya badge:
```tsx
import PageHeader from '@/Components/PageHeader';
import PrintLabelModal from '@/Components/PrintLabelModal';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Asset, PageProps } from '@/types';
import { Head } from '@inertiajs/react';
import { Camera01, Edit01, Printer } from '@untitledui/icons';
import { useState } from 'react';
```
```tsx
const KONDISI_BADGE: Record<string, 'success' | 'warning' | 'error' | 'gray'> = {
    baik: 'success',
    rusak_ringan: 'warning',
    rusak_berat: 'error',
    hilang: 'gray',
};

```
Hapus `KONDISI_STYLE` dan `STATUS_STYLE` (status memakai ternary langsung, tanpa peta).

- [ ] **Step 2: Header**

Ganti seluruh blok `{/* Header */} …` (div bertingkat sampai penutup kelompok tombol) dengan:
```tsx
<PageHeader
    crumbs={[{ label: 'Data Aset', href: route('assets.index') }, { label: 'Detail Aset' }]}
    title={asset.nama_aset}
    badges={
        <>
            <Badge type="color" size="sm" color={KONDISI_BADGE[asset.kondisi] ?? 'gray'} className="rounded-sm">
                {kondisiOptions.find((o) => o.value === asset.kondisi)?.label ?? asset.kondisi}
            </Badge>
            <Badge type="color" size="sm" color={asset.status === 'aktif' ? 'brand' : 'warning'} className="rounded-sm">
                {asset.status === 'aktif' ? 'Aktif' : 'Dalam Proses'}
            </Badge>
        </>
    }
    actions={
        <>
            <Button color="secondary-violet" size="md" iconLeading={Printer} onPress={() => setShowPrintModal(true)}>
                Cetak Label QR
            </Button>
            {can.update && (
                <Button color="secondary-green" size="md" iconLeading={Edit01} href={route('assets.edit', asset.id)}>
                    Edit Data
                </Button>
            )}
        </>
    }
/>
```
Ganti `<Camera className="h-9 w-9" />` menjadi `<Camera01 className="size-9" aria-hidden="true" />`. `DetailRow` menumpuk di layar sempit: ganti kelas `flex gap-4 px-3 py-2.5 text-sm ${…}` menjadi `flex flex-col gap-1 px-3 py-2.5 text-sm sm:flex-row sm:gap-4 ${…}` dan kelas label `w-40 shrink-0` menjadi `shrink-0 sm:w-40`. Bagian galeri dan riwayat tidak berubah, kecuali tombol thumbnail galeri mendapat `aria-label={`Foto ${idx + 1}`}` dan `aria-current={idx === activePhoto}`.

- [ ] **Step 3: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
grep -n "@/Components/Icons\|KONDISI_STYLE" resources/js/Pages/Assets/Show.tsx
php artisan test --compact --filter='Asset'
git add resources/js/Components/PageHeader.tsx resources/js/Pages/Assets/Show.tsx
git commit -m "feat(ui): migrate the asset detail page to Untitled UI components"
```
Expected: `tsc`/build bersih; `grep` kosong; test hijau.

- [ ] **Step 4: GERBANG ASET — berhenti**

Laporkan hasil Task 1–3, `Ruling`, dan hal yang tak bisa diverifikasi tanpa browser. Minta pengguna memeriksa (Data Aset → Tambah, → Detail, → Ubah):
- **Tambah**: semua field tampil dengan label dan tanda wajib; kirim kosong ditolak browser; Subkategori bisa diketik-lompat dan label terbaca utuh; angka rata kanan/tabular; galat validasi server tampil merah per field (mis. nilai buku > nilai perolehan) dan layar berpindah ke isian bermasalah pertama dengan ringkasan "N isian perlu diperbaiki"; pratinjau Rupiah muncul di bawah field nilai; hint batas nilai buku terlihat sebelum mengirim; area unggah bisa dicapai dan dipicu dengan Tab+Enter; pilih beberapa foto, batas jumlah, pratinjau, batalkan foto; simpan berhasil; Batal berpindah tanpa muat ulang penuh.
- **Ubah**: nilai awal terisi (subkategori, tanggal, angka), field Kondisi tidak ada; **ubah satu isian lalu hapus foto lama: isian yang belum disimpan tetap ada**; hapus foto lama membuka dialog (Esc/klik luar menutup, foto tetap bila dibatalkan, terhapus bila dikonfirmasi); simpan perubahan.
- **Detail**: badge Kondisi/Status dengan warna benar, tombol Cetak Label QR (ungu) membuka modal, Edit Data (hijau) hanya untuk yang berhak, galeri foto, QR, tabel detail, riwayat.
- Umum: keyboard (Tab/Enter/Esc), layar 375 px, cincin fokus terlihat.
**Jangan memulai halaman/modul berikutnya** sebelum pengguna menyatakan lolos.
