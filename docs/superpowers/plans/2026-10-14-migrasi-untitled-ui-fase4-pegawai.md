# Migrasi Untitled UI, Fase 4: Data Pegawai Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memigrasikan modul Data Pegawai (`Index`, `Create`, `Edit`, `Show`) ke komponen Untitled UI tanpa mengubah logika, props Inertia, atau nama berkas.

**Architecture:** `Create` dan `Edit` hampir identik (±450 baris JSX ganda), jadi form dan penanganan foto dipindah ke satu partial `Partials/PegawaiForm.tsx` (pola yang sama dengan `AssetForm`/`CategoryForm`); halaman hanya memegang `useForm` dan pengiriman. `Index` mempertahankan susunan kartu (bukan tabel) dengan filter, pagination sisi klien, dan `ConfirmDialog`. `Show` memakai `PageHeader`, daftar detail yang menumpuk di layar sempit, `Table` untuk aset yang dipegang, dan modal Buat Akun Login berbasis `ModalOverlay`.

**Tech Stack:** React 19, Inertia 2, Tailwind 4, Untitled UI (React Aria Components), `@untitledui/icons`.

**Spec:** `docs/superpowers/specs/2026-10-14-migrasi-untitled-ui-design.md` §3.5 butir 2 (Master data, dikerjakan satu modul per langkah atas permintaan pengguna). Komponen bersama: `PageHeader` (dengan `badges`), `ConfirmDialog`, `TextArea` tidak dipakai di sini. Pola acuan: plan Aset, Kategori Aset, dan Scan QR di `docs/superpowers/plans/`. Plan ini mengganti butir Pegawai di `docs/superpowers/plans/2026-10-14-migrasi-untitled-ui-fase4-master-data.md` (yang keliru menganggap `Index` berupa tabel).

Plan ini sudah memuat hasil review ponytail dan impeccable (2026-10-14).

## Global Constraints

- Hanya komponen Untitled UI gratis. Panduan UI/UX menang untuk identitas (Sapphire, badge radius 4px, tanpa kartu di dalam kartu); Untitled UI menang untuk semantik, keyboard, fokus.
- Logika tidak berubah: filter dan pencarian sisi klien, `itemsPerPage`/`currentPage`/`safeCurrentPage`, `useForm`, `forceFormData`, `can.*`, `useForm` akun login (`createAccountForm`), dan props Inertia. Nama berkas tidak berubah. Satu pengecualian yang disengaja: `Edit` mengirim lewat `form.post` + `transform` (`_method: 'put'`) agar galat validasi tampil (lihat Task 2).
- Tidak mencampur komponen Breeze (`InputError`, dst.) dan `@/Components/Icons`; impor memakai `@/Components/...` berhuruf besar.
- Galat validasi lewat `hint={errors.x}` + `isInvalid={Boolean(errors.x)}`; teks bantuan biasa saat tidak ada galat (`hint={errors.x ?? 'bantuan'}`).
- Warna tombol: tambah/simpan `primary`; ubah `secondary-green`; hapus `secondary-destructive`; kelola akses dan lihat `secondary-brand`; Batal `secondary`; "Buat Akun Login" `secondary-brand`. Badge: `Badge type="color" size="sm" className="rounded-sm"`.
- Kunci kosong tidak valid pada `Select` React Aria: opsi "kosong" memakai penanda (`__none`) lalu dipetakan kembali ke `''`.
- Tanpa dependensi baru. Verifikasi: `npx tsc --noEmit`, `npm run build`, test backend `--filter='Pegawai'`. Agen tidak menguji lewat browser kecuali pengguna mengizinkan; cek visual oleh pengguna di gerbang.
- Git: commit per task di `main`, tanpa trailer Co-Authored-By, stage dengan path eksplisit, tanpa push.

## Review Focus

1. **Pangkat/Golongan opsional**: form lama punya opsi kosong "Pilih pangkat" yang bisa dipilih kembali untuk mengosongkan. `Select` React Aria tidak bisa dikosongkan tanpa opsi. Pagar: opsi `__none` ("Tanpa pangkat") yang dipetakan ke `''` (Task 1).
2. **`unit_id` bertipe string** pada form (nilai dari `String(unit.id)`), sedangkan `Select` memakai kunci. Pagar: `selectedKey={data.unit_id || null}` dan `String(key)` (Task 1).
3. **Galat validasi di Edit tidak tampil**: kode lama memakai `router.post` tetapi membaca `errors` dari `useForm` (yang tidak terisi oleh `router.post`). Pagar: `form.post` + `transform` (Task 2); butir gerbang (kirim NIP kosong/duplikat).
4. **Unggah foto**: pratinjau (`FileReader`), hapus pratinjau, "Ganti Foto" pada foto yang ada di Edit, dan `forceFormData` tidak boleh berubah; area unggah harus bisa dioperasikan keyboard (sebelumnya `div` dengan `onClick`). Pagar: `<button>` sungguhan (Task 1).
5. **Pagination sisi klien**: mengubah filter, pencarian, atau jumlah per halaman mengembalikan ke halaman 1; `safeCurrentPage` mencegah halaman kosong setelah hapus. Pagar: logika tidak diubah (Task 3).
6. **Hapus pegawai**: dialog tidak bisa tertutup saat permintaan berjalan; pegawai yang punya akun/aset ditolak server dan galatnya tetap tampil. Pagar: `ConfirmDialog` dengan `isLoading` (Task 3).
7. **Modal Buat Akun Login**: tampil/sembunyi kata sandi memakai tombol bawaan `Input type="password"`; `Select` role bisa kosong (`roles.length === 0`) dengan pesan dan tombol simpan nonaktif; galat per field; setelah sukses modal menutup dan sandi dikosongkan. Pagar: Task 4.
8. **Badge kondisi aset** sebelumnya memetakan semua kondisi selain Baik/Rusak Ringan menjadi "Rusak Berat" (termasuk "Hilang"). Pagar: peta bersama `KONDISI_BADGE_COLOR`/`KONDISI_LABEL` (Task 4); perubahan ini disengaja karena memperbaiki label yang salah.
9. **Kartu pegawai sempit di ponsel**: foto + info + status + tiga tombol berdesakan di 375 px. Pagar: di bawah `sm` blok status/aksi pindah ke bawah info dalam satu baris (Task 3); butir gerbang.
10. **Tombol aksi kartu dalam kartu yang juga tautan**: foto dan nama sudah tautan ke detail; tombol aksi tidak boleh memicu navigasi ganda. Pagar: tombol aksi adalah elemen terpisah, bukan di dalam `Link` (Task 3).

---

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `resources/js/Pages/Pegawai/Partials/PegawaiForm.tsx` (baru) | Form bersama Tambah/Ubah termasuk foto |
| `resources/js/Pages/Pegawai/Create.tsx` | Halaman Tambah |
| `resources/js/Pages/Pegawai/Edit.tsx` | Halaman Ubah |
| `resources/js/Pages/Pegawai/Index.tsx` | Daftar kartu |
| `resources/js/Pages/Pegawai/Show.tsx` | Detail + modal Buat Akun Login |

---

### Task 1: `PegawaiForm`

**Files:**
- Create: `resources/js/Pages/Pegawai/Partials/PegawaiForm.tsx`

**Interfaces:**
- Consumes: `Input`, `Select`, `Button`, `Label` (`@/Components/ui/base/input/label`), `RadioGroup`/`RadioButton`, ikon `Camera01`, `XClose`.
- Produces: `PegawaiForm`, tipe `PegawaiFormData`, `UnitOption`:
```ts
export type PegawaiFormData = {
    nama: string;
    nip: string;
    status_kepegawaian: 'pns' | 'pppk';
    no_hp: string;
    email_dinas: string;
    pangkat_golongan: string;
    jabatan: string;
    unit_id: string;
    foto_profile: File | null;
};
export interface UnitOption { id: number; name: string; type: 'kecamatan' | 'kelurahan' }
type Props = {
    form: InertiaFormProps<PegawaiFormData>;
    units: UnitOption[];
    existingPhotoUrl?: string | null;   // Edit: foto yang sudah ada
    submitLabel: string;
    onSubmit: (e: FormEvent) => void;
    cancelHref: string;
};
```

- [ ] **Step 1: Tulis `PegawaiForm.tsx`**

```tsx
import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import { Label } from '@/Components/ui/base/input/label';
import { RadioButton, RadioGroup } from '@/Components/ui/base/radio-buttons/radio-buttons';
import { Select } from '@/Components/ui/base/select/select';
import { InertiaFormProps } from '@inertiajs/react';
import { Camera01, XClose } from '@untitledui/icons';
import { ChangeEvent, FormEvent, useRef, useState } from 'react';

export type PegawaiFormData = {
    nama: string;
    nip: string;
    status_kepegawaian: 'pns' | 'pppk';
    no_hp: string;
    email_dinas: string;
    pangkat_golongan: string;
    jabatan: string;
    unit_id: string;
    foto_profile: File | null;
};

export interface UnitOption {
    id: number;
    name: string;
    type: 'kecamatan' | 'kelurahan';
}

type Props = {
    form: InertiaFormProps<PegawaiFormData>;
    units: UnitOption[];
    existingPhotoUrl?: string | null;
    submitLabel: string;
    onSubmit: (e: FormEvent) => void;
    cancelHref: string;
};

const NONE = '__none';

const PANGKAT_OPTIONS = [
    'Juru Muda (I/a)',
    'Juru Muda Tingkat I (I/b)',
    'Juru (I/c)',
    'Juru Tingkat I (I/d)',
    'Pengatur Muda (II/a)',
    'Pengatur Muda Tingkat I (II/b)',
    'Pengatur (II/c)',
    'Pengatur Tingkat I (II/d)',
    'Penata Muda (III/a)',
    'Penata Muda Tingkat I (III/b)',
    'Penata (III/c)',
    'Penata Tingkat I (III/d)',
    'Pembina (IV/a)',
    'Pembina Tingkat I (IV/b)',
    'Pembina Utama Muda (IV/c)',
    'Pembina Utama Madya (IV/d)',
    'Pembina Utama (IV/e)',
];

const pangkatItems = [
    { id: NONE, label: 'Tanpa pangkat' },
    ...PANGKAT_OPTIONS.map((pangkat) => ({ id: pangkat, label: pangkat })),
];

export default function PegawaiForm({ form, units, existingPhotoUrl, submitLabel, onSubmit, cancelHref }: Props) {
    const { data, setData, processing, errors } = form;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);

    const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setData('foto_profile', file);
            const reader = new FileReader();
            reader.onload = (event) => {
                setPhotoPreview(event.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemovePhoto = () => {
        setData('foto_profile', null);
        setPhotoPreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const pickPhoto = () => fileInputRef.current?.click();

    const photoFrame =
        'aspect-3/4 relative flex w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-inner';

    return (
        <form onSubmit={onSubmit} className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
                {/* Top Section: Photo and Personal Data */}
                <div className="flex flex-col gap-8 md:flex-row md:items-start">
                    {/* Left Column: Photo Upload Area */}
                    <div className="w-full shrink-0 md:w-64 lg:w-72">
                        <p className="text-sm font-semibold text-slate-900">Foto Pegawai (Opsional)</p>

                        <div className="mt-3">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handlePhotoChange}
                                accept="image/jpeg,image/png,image/jpg"
                                className="hidden"
                            />

                            {photoPreview ? (
                                <div className={photoFrame}>
                                    <img src={photoPreview} alt="Pratinjau foto pegawai" className="h-full w-full object-cover" />
                                    <Button
                                        color="secondary"
                                        size="sm"
                                        iconLeading={XClose}
                                        aria-label="Hapus foto baru"
                                        className="absolute right-2 top-2"
                                        onPress={handleRemovePhoto}
                                    />
                                </div>
                            ) : existingPhotoUrl ? (
                                <div className={photoFrame}>
                                    <img src={existingPhotoUrl} alt="Foto pegawai saat ini" className="h-full w-full object-cover" />
                                    <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-slate-900/80 p-3 pt-6 text-center">
                                        <Button color="secondary" size="sm" iconLeading={Camera01} onPress={pickPhoto}>
                                            Ganti Foto
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={pickPhoto}
                                    className="aspect-3/4 group flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-6 text-center outline-hidden transition hover:border-blue-500 hover:bg-blue-50/30 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
                                >
                                    <span className="flex size-12 items-center justify-center rounded-full bg-white text-slate-500 shadow-xs transition group-hover:text-blue-600">
                                        <Camera01 className="size-6" aria-hidden="true" />
                                    </span>
                                    <span className="mt-4 text-sm font-semibold text-slate-800 group-hover:text-blue-700">
                                        Klik untuk unggah foto
                                    </span>
                                    <span className="mt-1 text-xs text-slate-500">Format JPG/PNG, maks. 2MB</span>
                                </button>
                            )}

                            {errors.foto_profile && (
                                <p role="alert" className="mt-2 text-sm text-red-600">
                                    {errors.foto_profile}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Personal Data */}
                    <div className="min-w-0 flex-1 space-y-5">
                        <div className="border-b border-slate-100 pb-2">
                            <h2 className="text-base font-semibold text-slate-900">Data Pribadi</h2>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Input
                                label="Nama Lengkap"
                                isRequired
                                placeholder="Masukkan nama lengkap pegawai"
                                value={data.nama}
                                onChange={(v) => setData('nama', v)}
                                isInvalid={Boolean(errors.nama)}
                                hint={errors.nama}
                            />
                            <Input
                                label="NIP"
                                placeholder="Masukkan NIP (18 digit)"
                                value={data.nip}
                                onChange={(v) => setData('nip', v)}
                                isInvalid={Boolean(errors.nip)}
                                hint={errors.nip ?? 'Kosongkan jika PPPK tanpa NIP'}
                            />
                            <RadioGroup
                                isRequired
                                className="gap-2"
                                value={data.status_kepegawaian}
                                onChange={(v) => setData('status_kepegawaian', v as 'pns' | 'pppk')}
                                isInvalid={Boolean(errors.status_kepegawaian)}
                            >
                                <Label isRequired>Status Aparatur</Label>
                                <div className="flex items-center gap-6">
                                    <RadioButton value="pns" label="PNS" />
                                    <RadioButton value="pppk" label="PPPK" />
                                </div>
                                {errors.status_kepegawaian && (
                                    <p className="text-sm text-red-600">{errors.status_kepegawaian}</p>
                                )}
                            </RadioGroup>
                            <Input
                                label="No. HP"
                                placeholder="08xx-xxxx-xxxx"
                                value={data.no_hp}
                                onChange={(v) => setData('no_hp', v)}
                                isInvalid={Boolean(errors.no_hp)}
                                hint={errors.no_hp}
                            />
                            <Input
                                label="Email Dinas"
                                type="email"
                                placeholder="nama@batam.go.id"
                                value={data.email_dinas}
                                onChange={(v) => setData('email_dinas', v)}
                                isInvalid={Boolean(errors.email_dinas)}
                                hint={errors.email_dinas}
                            />
                        </div>
                    </div>
                </div>

                <div className="my-8 border-t border-slate-200" />

                {/* Bottom Section: Rank & Position */}
                <div className="space-y-4">
                    <h2 className="text-base font-semibold text-slate-900">Data Kepangkatan &amp; Jabatan</h2>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Select
                            label="Pangkat / Golongan"
                            placeholder="Pilih pangkat"
                            items={pangkatItems}
                            selectedKey={data.pangkat_golongan || null}
                            onSelectionChange={(key) => setData('pangkat_golongan', key === NONE || key == null ? '' : String(key))}
                            isInvalid={Boolean(errors.pangkat_golongan)}
                            hint={errors.pangkat_golongan}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                        <Input
                            label="Jabatan"
                            isRequired
                            placeholder="Masukkan jabatan dinas"
                            value={data.jabatan}
                            onChange={(v) => setData('jabatan', v)}
                            isInvalid={Boolean(errors.jabatan)}
                            hint={errors.jabatan}
                        />
                        <Select
                            label="Unit Kerja"
                            isRequired
                            placeholder="Pilih unit kerja penugasan"
                            items={units.map((unit) => ({
                                id: String(unit.id),
                                label: `${unit.name} (${unit.type === 'kecamatan' ? 'Kecamatan' : 'Kelurahan'})`,
                            }))}
                            selectedKey={data.unit_id || null}
                            onSelectionChange={(key) => setData('unit_id', key == null ? '' : String(key))}
                            isInvalid={Boolean(errors.unit_id)}
                            hint={errors.unit_id}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                    </div>
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
git add resources/js/Pages/Pegawai/Partials/PegawaiForm.tsx
git commit -m "feat(ui): add the shared employee form on Untitled UI components"
```
Expected: bersih (belum dipakai halaman). Prop `RadioGroup` (`isInvalid`) atau `Label` yang berbeda disesuaikan dan dicatat sebagai `Ruling`.

---

### Task 2: `Create` dan `Edit`

**Files:**
- Modify: `resources/js/Pages/Pegawai/Create.tsx`, `resources/js/Pages/Pegawai/Edit.tsx` (ganti seluruh isi)

**Interfaces:**
- Consumes: `PegawaiForm`, `PegawaiFormData`, `UnitOption` (Task 1), `PageHeader`.
- Produces: halaman dengan props Inertia sama (`Create`: `{ units }`; `Edit`: `{ pegawai, units }`).

- [ ] **Step 1: `Create.tsx`**

```tsx
import PageHeader from '@/Components/PageHeader';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import PegawaiForm, { PegawaiFormData, UnitOption } from '@/Pages/Pegawai/Partials/PegawaiForm';
import { PageProps } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

interface CreateProps extends PageProps {
    units: UnitOption[];
}

export default function Create({ units }: CreateProps) {
    const form = useForm<PegawaiFormData>({
        nama: '',
        nip: '',
        status_kepegawaian: 'pns',
        no_hp: '',
        email_dinas: '',
        pangkat_golongan: '',
        jabatan: '',
        unit_id: units[0]?.id ? String(units[0].id) : '',
        foto_profile: null,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(route('pegawais.store'), {
            forceFormData: true,
        });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Tambah Pegawai Baru" />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Data Pegawai', href: route('pegawais.index') }, { label: 'Tambah Pegawai' }]}
                    title="Tambah Pegawai Baru"
                />

                <PegawaiForm
                    form={form}
                    units={units}
                    submitLabel="Simpan Pegawai"
                    onSubmit={submit}
                    cancelHref={route('pegawais.index')}
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
import PegawaiForm, { PegawaiFormData, UnitOption } from '@/Pages/Pegawai/Partials/PegawaiForm';
import { PageProps, Pegawai } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

interface EditProps extends PageProps {
    pegawai: Pegawai;
    units: UnitOption[];
}

export default function Edit({ pegawai, units }: EditProps) {
    const form = useForm<PegawaiFormData>({
        nama: pegawai.nama || '',
        nip: pegawai.nip || '',
        status_kepegawaian: (pegawai.status_kepegawaian || 'pns') as 'pns' | 'pppk',
        no_hp: pegawai.no_hp || '',
        email_dinas: pegawai.email_dinas || '',
        pangkat_golongan: pegawai.pangkat_golongan || '',
        jabatan: pegawai.jabatan || '',
        unit_id: String(pegawai.unit_id || (units[0]?.id ? units[0].id : '')),
        foto_profile: null,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        // Spoofing metode lewat transform agar galat validasi masuk ke `form.errors`.
        form.transform((data) => ({ ...data, _method: 'put' }));
        form.post(route('pegawais.update', pegawai.id), {
            forceFormData: true,
        });
    };

    return (
        <AuthenticatedLayout>
            <Head title={`Edit Pegawai: ${pegawai.nama}`} />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[
                        { label: 'Data Pegawai', href: route('pegawais.index') },
                        { label: pegawai.nama, href: route('pegawais.show', pegawai.id) },
                        { label: 'Edit Pegawai' },
                    ]}
                    title="Edit Data Pegawai"
                />

                <PegawaiForm
                    form={form}
                    units={units}
                    existingPhotoUrl={pegawai.foto_profile ? `/storage/${pegawai.foto_profile}` : null}
                    submitLabel="Simpan Perubahan"
                    onSubmit={submit}
                    cancelHref={route('pegawais.show', pegawai.id)}
                />
            </div>
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 3: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
grep -n "InputError\|@/Components/Icons" resources/js/Pages/Pegawai/Create.tsx resources/js/Pages/Pegawai/Edit.tsx
php artisan test --compact --filter='Pegawai'
git add resources/js/Pages/Pegawai/Create.tsx resources/js/Pages/Pegawai/Edit.tsx
git commit -m "feat(ui): migrate the employee create and edit pages to Untitled UI components"
```
Expected: bersih; `grep` kosong; test hijau.

---

### Task 3: `Index` (kartu)

**Files:**
- Modify: `resources/js/Pages/Pegawai/Index.tsx` (ganti seluruh isi)

**Interfaces:**
- Consumes: `PageHeader`, `ConfirmDialog`, `ImportExportButtons`, `PaginationPageDefault`, `Input`, `Select`, `Button`, `Badge`, `BadgeWithDot`, `Tooltip`; ikon `Edit01`, `Plus`, `SearchLg`, `Shield01`, `Trash01`, `User01`, `XClose`.
- Produces: halaman dengan props Inertia sama.

- [ ] **Step 1: Tulis ulang `Index.tsx`**

```tsx
import ConfirmDialog from '@/Components/ConfirmDialog';
import ImportExportButtons from '@/Components/ImportExportButtons';
import PageHeader from '@/Components/PageHeader';
import { PaginationPageDefault } from '@/Components/ui/application/pagination/pagination';
import { Badge, BadgeWithDot } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import { Select } from '@/Components/ui/base/select/select';
import { Tooltip } from '@/Components/ui/base/tooltip/tooltip';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps, Pegawai } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Edit01, Plus, SearchLg, Shield01, Trash01, User01, XClose } from '@untitledui/icons';
import { useMemo, useState } from 'react';

interface UnitOption {
    id: number;
    name: string;
    type: 'kecamatan' | 'kelurahan';
}

interface IndexProps extends PageProps {
    pegawais: Pegawai[];
    units: UnitOption[];
    can: {
        create: boolean;
        createUser: boolean;
        manageAccess?: boolean;
        delete?: boolean;
    };
}

const PAGE_SIZE_OPTIONS = [6, 12, 24, 48];

const STATUS_ITEMS = [
    { id: 'all', label: 'Semua Status' },
    { id: 'pns', label: 'PNS' },
    { id: 'pppk', label: 'PPPK' },
];

export default function Index({ pegawais, units, can }: IndexProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pns' | 'pppk'>('all');
    const [unitFilter, setUnitFilter] = useState<string>('all');
    const [itemsPerPage, setItemsPerPage] = useState<number>(12);
    const [currentPage, setCurrentPage] = useState(1);
    const [deleteModalPegawai, setDeleteModalPegawai] = useState<Pegawai | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const filteredPegawais = useMemo(() => {
        return pegawais.filter((p) => {
            const matchesSearch =
                searchQuery === '' ||
                p.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.nip && p.nip.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesStatus = statusFilter === 'all' || p.status_kepegawaian === statusFilter;

            const matchesUnit = unitFilter === 'all' || String(p.unit_id) === unitFilter;

            return matchesSearch && matchesStatus && matchesUnit;
        });
    }, [pegawais, searchQuery, statusFilter, unitFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredPegawais.length / itemsPerPage));
    const safeCurrentPage = Math.min(currentPage, totalPages);

    const paginatedPegawais = useMemo(() => {
        const start = (safeCurrentPage - 1) * itemsPerPage;
        return filteredPegawais.slice(start, start + itemsPerPage);
    }, [filteredPegawais, safeCurrentPage, itemsPerPage]);

    const hasActiveFilter = searchQuery !== '' || statusFilter !== 'all' || unitFilter !== 'all';

    const resetFilters = () => {
        setSearchQuery('');
        setStatusFilter('all');
        setUnitFilter('all');
        setCurrentPage(1);
    };

    const handleDelete = () => {
        if (!deleteModalPegawai) return;

        setIsDeleting(true);
        router.delete(route('pegawais.destroy', deleteModalPegawai.id), {
            preserveScroll: true,
            onFinish: () => {
                setIsDeleting(false);
                setDeleteModalPegawai(null);
            },
        });
    };

    const unitItems = [{ id: 'all', label: 'Semua Unit' }, ...units.map((unit) => ({ id: String(unit.id), label: unit.name }))];

    return (
        <AuthenticatedLayout>
            <Head title="Data Pegawai" />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Data Pegawai' }]}
                    title="Data Pegawai"
                    actions={
                        <>
                            <ImportExportButtons modul="pegawai" />
                            {can.create && (
                                <Button color="primary" size="md" iconLeading={Plus} href={route('pegawais.create')}>
                                    Tambah Pegawai Baru
                                </Button>
                            )}
                        </>
                    }
                />

                {/* Filter Toolbar */}
                <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs md:flex-row md:items-center">
                    <div className="flex flex-1 items-center gap-2">
                        <div className="flex-1">
                            <Input
                                aria-label="Cari pegawai"
                                size="md"
                                icon={SearchLg}
                                placeholder="Cari nama atau NIP..."
                                value={searchQuery}
                                onChange={(v) => {
                                    setSearchQuery(v);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>
                        {searchQuery && (
                            <Button
                                color="tertiary"
                                size="md"
                                iconLeading={XClose}
                                aria-label="Hapus pencarian"
                                onPress={() => {
                                    setSearchQuery('');
                                    setCurrentPage(1);
                                }}
                            />
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <Select
                            aria-label="Status"
                            size="md"
                            className="min-w-[150px]"
                            items={STATUS_ITEMS}
                            selectedKey={statusFilter}
                            onSelectionChange={(key) => {
                                setStatusFilter(String(key) as 'all' | 'pns' | 'pppk');
                                setCurrentPage(1);
                            }}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                        <Select
                            aria-label="Unit"
                            size="md"
                            className="min-w-[200px]"
                            items={unitItems}
                            selectedKey={unitFilter}
                            onSelectionChange={(key) => {
                                setUnitFilter(String(key));
                                setCurrentPage(1);
                            }}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                        {hasActiveFilter && (
                            <Button color="tertiary" size="md" iconLeading={XClose} onPress={resetFilters}>
                                Hapus semua filter
                            </Button>
                        )}
                    </div>
                </div>

                {/* Employee Grid */}
                {paginatedPegawais.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-[repeat(auto-fill,minmax(420px,1fr))]">
                        {paginatedPegawais.map((pegawai) => {
                            const isPns = pegawai.status_kepegawaian === 'pns';
                            const hasAccount = Boolean(pegawai.user_id);

                            return (
                                <div
                                    key={pegawai.id}
                                    className="flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs transition hover:border-slate-300 hover:shadow-md"
                                >
                                    {/* Photo Section */}
                                    <Link
                                        href={route('pegawais.show', pegawai.id)}
                                        className="flex w-28 shrink-0 items-center justify-center bg-slate-100 p-2 outline-hidden transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 sm:w-32"
                                        aria-label={`Lihat detail ${pegawai.nama}`}
                                    >
                                        {pegawai.foto_profile ? (
                                            <img
                                                src={`/storage/${pegawai.foto_profile}`}
                                                alt=""
                                                className="h-full max-h-36 w-full rounded-lg object-cover"
                                            />
                                        ) : (
                                            <div className="flex size-20 items-center justify-center rounded-full bg-slate-200/80 text-slate-400">
                                                <User01 className="size-10" aria-hidden="true" />
                                            </div>
                                        )}
                                    </Link>

                                    {/* Details Section */}
                                    <div className="flex min-w-0 flex-1 flex-col justify-between p-4">
                                        <div className="border-b border-slate-100 pb-2">
                                            <h3 className="text-base font-bold leading-snug text-slate-900">
                                                <Link href={route('pegawais.show', pegawai.id)} className="transition-colors hover:text-blue-700">
                                                    {pegawai.nama}
                                                </Link>
                                            </h3>
                                        </div>

                                        <div className="mt-2.5 flex flex-1 flex-col gap-3 text-xs sm:flex-row sm:items-start sm:justify-between">
                                            {/* Informasi Kepegawaian */}
                                            <div className="min-w-0 flex-1 space-y-1 text-slate-600">
                                                <div>
                                                    <span className="text-slate-400">NIP: </span>
                                                    <span className="font-medium tabular-nums text-slate-800">{pegawai.nip ?? '-'}</span>
                                                </div>
                                                <div className="truncate font-semibold text-slate-900">{pegawai.jabatan}</div>
                                                <div>
                                                    <span className="text-slate-400">Pangkat: </span>
                                                    <span className="font-medium text-slate-700">{pegawai.pangkat_golongan ?? '-'}</span>
                                                </div>
                                                <div className="truncate">
                                                    <span className="text-slate-400">Unit: </span>
                                                    <span className="font-medium text-slate-700">{pegawai.unit?.name ?? '-'}</span>
                                                </div>
                                            </div>

                                            {/* Status, Akun & Aksi */}
                                            <div className="flex shrink-0 flex-row flex-wrap items-center justify-between gap-2 sm:flex-col sm:items-end sm:self-stretch">
                                                <div className="flex flex-row items-center gap-2 sm:flex-col sm:items-end sm:gap-1.5">
                                                    <Badge type="color" size="sm" color={isPns ? 'brand' : 'purple'} className="rounded-sm">
                                                        {isPns ? 'PNS' : 'PPPK'}
                                                    </Badge>
                                                    <BadgeWithDot type="color" size="sm" color={hasAccount ? 'success' : 'gray'} className="rounded-sm">
                                                        {hasAccount ? 'Punya Akun' : 'Belum Ada Akun'}
                                                    </BadgeWithDot>
                                                </div>

                                                <div className="flex items-center gap-1.5">
                                                    {hasAccount && can.manageAccess && (
                                                        <Tooltip title="Kelola hak akses & role akun">
                                                            <Button
                                                                color="secondary-brand"
                                                                size="sm"
                                                                iconLeading={Shield01}
                                                                aria-label="Kelola hak akses & role akun"
                                                                href={route('users.edit', pegawai.user_id as number)}
                                                            />
                                                        </Tooltip>
                                                    )}
                                                    <Tooltip title="Lihat detail dan edit pegawai">
                                                        <Button
                                                            color="secondary-green"
                                                            size="sm"
                                                            iconLeading={Edit01}
                                                            aria-label="Lihat detail dan edit pegawai"
                                                            href={route('pegawais.edit', pegawai.id)}
                                                        />
                                                    </Tooltip>
                                                    {can.delete && (
                                                        <Tooltip title="Hapus data pegawai">
                                                            <Button
                                                                color="secondary-destructive"
                                                                size="sm"
                                                                iconLeading={Trash01}
                                                                aria-label="Hapus data pegawai"
                                                                onPress={() => setDeleteModalPegawai(pegawai)}
                                                            />
                                                        </Tooltip>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
                        <div className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                            <User01 className="size-6" aria-hidden="true" />
                        </div>
                        <h3 className="mt-3 text-sm font-semibold text-slate-900">Tidak ada pegawai ditemukan</h3>
                        <p className="mt-1 text-xs text-slate-500">
                            {hasActiveFilter
                                ? 'Coba sesuaikan kata kunci pencarian atau filter yang dipilih.'
                                : 'Belum ada data pegawai yang terdaftar di unit ini.'}
                        </p>
                        {hasActiveFilter && (
                            <Button color="secondary" size="sm" className="mt-4" onPress={resetFilters}>
                                Hapus semua filter
                            </Button>
                        )}
                    </div>
                )}

                {/* Pagination Bar */}
                {filteredPegawais.length > 0 && (
                    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-xs">
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                            <p>
                                Menampilkan <span className="font-semibold tabular-nums text-slate-900">{paginatedPegawais.length}</span> dari{' '}
                                <span className="font-semibold tabular-nums text-slate-900">{filteredPegawais.length}</span> pegawai
                            </p>
                            <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
                                <span className="text-slate-500">Per halaman:</span>
                                <Select
                                    aria-label="Jumlah per halaman"
                                    size="sm"
                                    className="w-24"
                                    items={PAGE_SIZE_OPTIONS.map((size) => ({ id: size, label: String(size) }))}
                                    selectedKey={itemsPerPage}
                                    onSelectionChange={(key) => {
                                        setItemsPerPage(Number(key));
                                        setCurrentPage(1);
                                    }}
                                >
                                    {(item) => <Select.Item id={item.id} label={item.label} />}
                                </Select>
                            </div>
                        </div>

                        {totalPages > 1 && (
                            <PaginationPageDefault
                                className="border-t-0 pt-0 md:pt-0"
                                page={safeCurrentPage}
                                total={totalPages}
                                onPageChange={setCurrentPage}
                            />
                        )}
                    </div>
                )}
            </div>

            {deleteModalPegawai && (
                <ConfirmDialog
                    title="Konfirmasi Hapus Pegawai"
                    confirmLabel="Hapus Pegawai"
                    isLoading={isDeleting}
                    onConfirm={handleDelete}
                    onClose={() => setDeleteModalPegawai(null)}
                >
                    Apakah Anda yakin ingin menghapus data pegawai{' '}
                    <strong className="font-semibold text-slate-900">{deleteModalPegawai.nama}</strong>?
                </ConfirmDialog>
            )}
        </AuthenticatedLayout>
    );
}
```
Prop yang berbeda dari yang diasumsikan (`BadgeWithDot` `color`, `className` pada `Select`) disesuaikan dalam commit yang sama dan dicatat sebagai `Ruling`.

- [ ] **Step 2: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
grep -n "@/Components/Icons" resources/js/Pages/Pegawai/Index.tsx
php artisan test --compact --filter='Pegawai'
git add resources/js/Pages/Pegawai/Index.tsx
git commit -m "feat(ui): migrate the employee list page to Untitled UI components"
```
Expected: bersih; `grep` kosong; test hijau.

---

### Task 4: `Show` dan gerbang

**Files:**
- Modify: `resources/js/Pages/Pegawai/Show.tsx` (ganti seluruh isi)

**Interfaces:**
- Consumes: `PageHeader` (dengan `badges`), `Button`, `Badge`, `BadgeWithDot`, `Input`, `Select`, `Table`, `ModalOverlay`/`Modal`/`Dialog`, `KONDISI_BADGE_COLOR`/`KONDISI_LABEL` (`@/lib/assetReport`), `rupiah` (`@/lib/format`, menggantikan `formatRupiah` lokal); ikon `CheckCircle`, `Edit01`, `Shield01`, `User01`, `UserPlus01`, `XClose`.
- Produces: halaman dengan props Inertia sama (`pegawai`, `roles`, `can`).

- [ ] **Step 1: Tulis ulang `Show.tsx`**

```tsx
import PageHeader from '@/Components/PageHeader';
import { Dialog, Modal, ModalOverlay } from '@/Components/ui/application/modals/modal';
import { Table } from '@/Components/ui/application/table/table';
import { Badge, BadgeWithDot } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import { Select } from '@/Components/ui/base/select/select';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_BADGE_COLOR, KONDISI_LABEL } from '@/lib/assetReport';
import { rupiah } from '@/lib/format';
import { PageProps, Pegawai } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { CheckCircle, Edit01, Shield01, User01, UserPlus01, XClose } from '@untitledui/icons';
import { FormEvent, ReactNode, useState } from 'react';

interface ShowProps extends PageProps {
    pegawai: Pegawai;
    roles?: { value: string; label: string }[];
    can: {
        update: boolean;
        delete: boolean;
        createUser: boolean;
    };
}

const ROLE_LABELS: Record<string, string> = {
    kasubag: 'Kasubag Umum & Kepegawaian',
    camat: 'Camat',
    admin_kecamatan: 'Admin Kecamatan',
    admin_kelurahan: 'Admin Kelurahan',
    lurah: 'Lurah',
    pegawai: 'Pegawai',
};

function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-4">
            <dt className="shrink-0 font-medium text-slate-500 sm:w-44">{label}</dt>
            <dd className="min-w-0 text-slate-900">{children}</dd>
        </div>
    );
}

export default function Show({ pegawai, roles = [], can }: ShowProps) {
    const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);

    // Form for Creating Login Account
    const createAccountForm = useForm({
        role: roles[0]?.value || '',
        email: pegawai.email_dinas || '',
        password: '',
        password_confirmation: '',
    });

    const submitCreateAccount = (e: FormEvent) => {
        e.preventDefault();
        createAccountForm.post(route('pegawais.create-user', pegawai.id), {
            preserveScroll: true,
            onSuccess: () => {
                setIsCreateAccountOpen(false);
                createAccountForm.reset('password', 'password_confirmation');
            },
        });
    };

    const hasAccount = Boolean(pegawai.user_id);
    const userRole = pegawai.user?.roles?.[0]?.name;
    const formattedRole = userRole ? ROLE_LABELS[userRole] || userRole : 'Belum Ditentukan';
    const isPns = pegawai.status_kepegawaian === 'pns';
    const assets = pegawai.assets ?? [];

    return (
        <AuthenticatedLayout>
            <Head title={`Detail Pegawai: ${pegawai.nama}`} />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Data Pegawai', href: route('pegawais.index') }, { label: 'Detail Pegawai' }]}
                    title={pegawai.nama}
                    badges={
                        <>
                            <Badge type="color" size="sm" color={isPns ? 'brand' : 'purple'} className="rounded-sm">
                                {isPns ? 'PNS' : 'PPPK'}
                            </Badge>
                            <BadgeWithDot type="color" size="sm" color={hasAccount ? 'success' : 'gray'} className="rounded-sm">
                                {hasAccount ? 'Punya Akun' : 'Belum Ada Akun'}
                            </BadgeWithDot>
                        </>
                    }
                    actions={
                        <>
                            {can.createUser && !hasAccount && (
                                <Button color="secondary-brand" size="md" iconLeading={UserPlus01} onPress={() => setIsCreateAccountOpen(true)}>
                                    Buat Akun Login
                                </Button>
                            )}
                            {hasAccount && (
                                <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-600">
                                    <CheckCircle className="size-4 text-emerald-600" aria-hidden="true" />
                                    <span>Akun Aktif: {pegawai.user?.email}</span>
                                </div>
                            )}
                            {can.update && (
                                <Button color="secondary-green" size="md" iconLeading={Edit01} href={route('pegawais.edit', pegawai.id)}>
                                    Edit Data
                                </Button>
                            )}
                        </>
                    }
                />

                {/* Two-Column Split Content */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    {/* Left Column: Photo & Quick Profile Card */}
                    <div className="lg:col-span-4 xl:col-span-3">
                        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                            <div className="aspect-4/3 flex w-full items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                                {pegawai.foto_profile ? (
                                    <img src={`/storage/${pegawai.foto_profile}`} alt={pegawai.nama} className="h-full w-full object-cover" />
                                ) : (
                                    <div className="flex size-24 items-center justify-center rounded-full bg-slate-200/80 text-slate-400">
                                        <User01 className="size-12" aria-hidden="true" />
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 text-center">
                                <h2 className="text-lg font-bold text-slate-900">{pegawai.nama}</h2>
                                <p className="mt-0.5 text-xs tabular-nums text-slate-500">
                                    {pegawai.nip ? `NIP: ${pegawai.nip}` : 'Tanpa NIP'}
                                </p>
                            </div>

                            <div className="my-5 border-t border-slate-100" />

                            <div className="space-y-3 text-xs">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-slate-500">Jabatan</span>
                                    <span className="text-right font-semibold text-slate-900">{pegawai.jabatan}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-slate-500">Unit Kerja</span>
                                    <span className="text-right font-semibold text-slate-900">{pegawai.unit?.name ?? '-'}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-slate-500">Aset Dipegang</span>
                                    <Badge type="color" size="sm" color="brand" className="rounded-sm tabular-nums">
                                        {assets.length} unit
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Kepegawaian & Akun SIBIMA Card */}
                    <div className="lg:col-span-8 xl:col-span-9">
                        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                            <section>
                                <h3 className="text-base font-bold text-slate-900">Data Kepegawaian</h3>
                                <dl className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-100 bg-slate-50/40 text-sm">
                                    <InfoRow label="Nama Lengkap">
                                        <span className="font-semibold">{pegawai.nama}</span>
                                    </InfoRow>
                                    <InfoRow label="NIP">
                                        <span className="tabular-nums">{pegawai.nip ?? '-'}</span>
                                    </InfoRow>
                                    <InfoRow label="Status Aparatur">
                                        <span className="font-semibold uppercase">{pegawai.status_kepegawaian}</span>
                                    </InfoRow>
                                    <InfoRow label="Pangkat / Golongan">{pegawai.pangkat_golongan ?? '-'}</InfoRow>
                                    <InfoRow label="Jabatan">
                                        <span className="font-medium">{pegawai.jabatan}</span>
                                    </InfoRow>
                                    <InfoRow label="Unit Kerja">{pegawai.unit?.name ?? '-'}</InfoRow>
                                    <InfoRow label="No. HP">{pegawai.no_hp ?? '-'}</InfoRow>
                                    <InfoRow label="Email Dinas">{pegawai.email_dinas ?? '-'}</InfoRow>
                                </dl>
                            </section>

                            <div className="my-6 border-t border-slate-200" />

                            <section>
                                <div className="flex items-center gap-2">
                                    <Shield01 className="size-4 text-blue-700" aria-hidden="true" />
                                    <h3 className="text-base font-bold text-slate-900">Informasi Akun SIBIMA</h3>
                                </div>
                                <dl className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-100 bg-slate-50/40 text-sm">
                                    <InfoRow label="Status Akun">
                                        <Badge type="color" size="sm" color={hasAccount ? 'success' : 'gray'} className="rounded-sm">
                                            {hasAccount ? 'Aktif' : 'Belum Memiliki Akun'}
                                        </Badge>
                                    </InfoRow>
                                    <InfoRow label="Role Login">
                                        <span className="font-medium">{hasAccount ? formattedRole : '-'}</span>
                                    </InfoRow>
                                    <InfoRow label="Email Login">
                                        <span className="font-mono text-xs">{pegawai.user?.email ?? '-'}</span>
                                    </InfoRow>
                                </dl>
                            </section>
                        </div>
                    </div>
                </div>

                {/* Bottom Card: Daftar Aset yang Dipegang */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    <div className="flex items-center gap-3 px-6 py-4">
                        <h3 className="text-base font-bold text-slate-900">Aset yang Dipegang</h3>
                        <Badge type="color" size="sm" color="brand" className="rounded-sm tabular-nums">
                            {assets.length} aset
                        </Badge>
                    </div>

                    <Table aria-label="Aset yang dipegang">
                        <Table.Header>
                            <Table.Head id="no" label="No" />
                            <Table.Head id="nama" label="Nama Aset" isRowHeader />
                            <Table.Head id="kode" label="Kode BMD" />
                            <Table.Head id="kondisi" label="Kondisi" />
                            <Table.Head id="nilai" label="Nilai Perolehan" />
                        </Table.Header>
                        <Table.Body
                            items={assets}
                            renderEmptyState={() => (
                                <p className="py-8 text-center text-sm text-slate-400">Pegawai belum memegang aset apapun saat ini.</p>
                            )}
                        >
                            {(asset) => (
                                <Table.Row id={asset.id}>
                                    <Table.Cell className="tabular-nums">{assets.indexOf(asset) + 1}</Table.Cell>
                                    <Table.Cell className="font-semibold text-slate-900">{asset.nama_aset}</Table.Cell>
                                    <Table.Cell className="font-mono text-xs">{asset.kode_barang}</Table.Cell>
                                    <Table.Cell>
                                        <Badge type="color" size="sm" color={KONDISI_BADGE_COLOR[asset.kondisi] ?? 'gray'} className="rounded-sm">
                                            {KONDISI_LABEL[asset.kondisi] ?? asset.kondisi}
                                        </Badge>
                                    </Table.Cell>
                                    <Table.Cell className="whitespace-nowrap font-medium tabular-nums text-slate-900">
                                        {rupiah(Number(asset.nilai_perolehan) || 0)}
                                    </Table.Cell>
                                </Table.Row>
                            )}
                        </Table.Body>
                    </Table>
                </div>
            </div>

            {/* Modal: Buat Akun Login */}
            <ModalOverlay isOpen={isCreateAccountOpen} isDismissable={!createAccountForm.processing} onOpenChange={setIsCreateAccountOpen}>
                <Modal className="sm:max-w-lg">
                    <Dialog aria-labelledby="create-account-title">
                        <div className="w-full p-6">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <h3 id="create-account-title" className="text-base font-bold text-slate-900">
                                    Buat Akun Login
                                </h3>
                                <Button
                                    color="tertiary"
                                    size="sm"
                                    iconLeading={XClose}
                                    aria-label="Tutup"
                                    onPress={() => setIsCreateAccountOpen(false)}
                                />
                            </div>

                            <div className="my-4 flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-800 text-xs font-bold text-white">
                                    {getInitials(pegawai.nama)}
                                </div>
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-bold text-slate-900">{pegawai.nama}</div>
                                    <div className="text-xs tabular-nums text-slate-500">{pegawai.nip ? `NIP: ${pegawai.nip}` : 'Tanpa NIP'}</div>
                                </div>
                            </div>

                            <form onSubmit={submitCreateAccount} className="space-y-4">
                                <Select
                                    label="Role Login"
                                    isRequired
                                    isDisabled={roles.length === 0}
                                    placeholder={roles.length === 0 ? 'Tidak ada role yang dapat Anda delegasikan' : 'Pilih role'}
                                    items={roles.map((r) => ({ id: r.value, label: r.label }))}
                                    selectedKey={createAccountForm.data.role || null}
                                    onSelectionChange={(key) => createAccountForm.setData('role', String(key))}
                                    isInvalid={Boolean(createAccountForm.errors.role)}
                                    hint={createAccountForm.errors.role}
                                >
                                    {(item) => <Select.Item id={item.id} label={item.label} />}
                                </Select>
                                <Input
                                    label="Email Login"
                                    type="email"
                                    isRequired
                                    placeholder="nama@batam.go.id"
                                    value={createAccountForm.data.email}
                                    onChange={(v) => createAccountForm.setData('email', v)}
                                    isInvalid={Boolean(createAccountForm.errors.email)}
                                    hint={createAccountForm.errors.email}
                                />
                                <Input
                                    label="Kata Sandi"
                                    type="password"
                                    isRequired
                                    placeholder="••••••••"
                                    value={createAccountForm.data.password}
                                    onChange={(v) => createAccountForm.setData('password', v)}
                                    isInvalid={Boolean(createAccountForm.errors.password)}
                                    hint={createAccountForm.errors.password ?? 'Minimal 8 karakter dengan kombinasi huruf dan angka.'}
                                />
                                <Input
                                    label="Konfirmasi Kata Sandi"
                                    type="password"
                                    isRequired
                                    placeholder="••••••••"
                                    value={createAccountForm.data.password_confirmation}
                                    onChange={(v) => createAccountForm.setData('password_confirmation', v)}
                                />

                                <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                                    <Button color="secondary" size="md" isDisabled={createAccountForm.processing} onPress={() => setIsCreateAccountOpen(false)}>
                                        Batal
                                    </Button>
                                    <Button
                                        color="primary"
                                        size="md"
                                        type="submit"
                                        isLoading={createAccountForm.processing}
                                        isDisabled={roles.length === 0}
                                    >
                                        Simpan &amp; Aktifkan Akun
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </Dialog>
                </Modal>
            </ModalOverlay>
        </AuthenticatedLayout>
    );
}
```
`assets.indexOf(asset) + 1` mempertahankan nomor urut tanpa `index` (Table.Body tidak memberi indeks). Prop yang berbeda dari yang diasumsikan disesuaikan dalam commit yang sama dan dicatat sebagai `Ruling`.

- [ ] **Step 2: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
grep -rn "InputError\|@/Components/Icons\|@/components/" resources/js/Pages/Pegawai
php artisan test --compact --filter='Pegawai'
git add resources/js/Pages/Pegawai/Show.tsx
git commit -m "feat(ui): migrate the employee detail page to Untitled UI components"
```
Expected: bersih; `grep` kosong; test hijau.

- [ ] **Step 3: GERBANG DATA PEGAWAI — berhenti**

Laporkan hasil Task 1–4, `Ruling`, dan hal yang tak bisa diverifikasi tanpa browser. Minta pengguna memeriksa (Data Pegawai → Tambah → Ubah → Detail → Hapus):
- **Daftar**: kartu tampil sama (foto, nama, NIP bertabulasi, jabatan, pangkat, unit); badge PNS (biru)/PPPK (ungu) dan status akun (hijau/abu); tombol kelola akses (biru muda, hanya bila berhak), ubah (hijau), hapus (merah) dengan tooltip; pencarian (ketik, tombol hapus), filter Status dan Unit, "Hapus semua filter", jumlah per halaman (reset ke halaman 1), pagination; keadaan kosong; Impor/Ekspor sesuai izin.
- **Hapus**: dialog (Esc/klik luar menutup, tombol terkunci saat memproses); pegawai yang punya akun/aset menampilkan galat dari server; hapus berhasil.
- **Tambah**: semua field dengan label dan tanda wajib; kirim kosong ditolak browser; Pangkat bisa dikosongkan lewat "Tanpa pangkat"; unggah foto (pilih, pratinjau, hapus pratinjau, area bisa dijangkau keyboard); galat server per field; Simpan berhasil; Batal tanpa muat ulang penuh.
- **Ubah**: nilai awal terisi (status radio, pangkat, unit); foto lama tampil dengan "Ganti Foto"; **kirim NIP yang sudah dipakai pegawai lain: galat tampil di field NIP** (sebelumnya tidak tampil); Simpan Perubahan.
- **Detail**: badge di samping judul; tombol "Buat Akun Login" (biru muda) hanya bila berhak dan belum punya akun, "Edit Data" (hijau); daftar detail menumpuk rapi di 375 px; tabel aset (nomor, kondisi berwarna, nilai rata kanan) dan keadaan kosong; modal Buat Akun: pilih role, email, kata sandi dengan tombol mata, konfirmasi, galat per field, tutup (Esc/X/Batal), sukses menutup modal.
- Umum: keyboard (Tab/Enter/Esc), layar 375 px (kartu pegawai menumpuk rapi), cincin fokus.
**Jangan memulai modul berikutnya** sebelum pengguna menyatakan lolos.
