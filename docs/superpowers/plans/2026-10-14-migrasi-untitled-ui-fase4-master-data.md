# Migrasi Untitled UI, Fase 4 Kelompok 2: Master Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memigrasikan halaman Master Data (Kategori Aset, Role, Pegawai) dari komponen Breeze/Tailwind mentah ke komponen Untitled UI tanpa mengubah logika, props Inertia, atau nama berkas.

**Architecture:** Dua komponen bersama baru (`PageHeader`, `ConfirmDialog`) menggantikan header breadcrumb dan modal konfirmasi hapus yang tertulis ulang di tiap halaman. Form memakai `Input`/`Select`/`TextArea`/`RadioGroup` dengan label, bantuan, dan pesan galat bawaan komponen. Tabel memakai `Table` React Aria. Satu commit per halaman.

**Tech Stack:** React 19, Inertia 2, Tailwind 4, Untitled UI (React Aria Components), `@untitledui/icons`.

**Spec:** `docs/superpowers/specs/2026-10-14-migrasi-untitled-ui-design.md` §3.5 butir 2. Pola komponen: `docs/superpowers/plans/2026-10-14-migrasi-untitled-ui.md` (Task 5) dan halaman acuan `resources/js/Pages/Assets/Index.tsx`.

**Catatan jujur tentang bentuk plan ini:** sembilan halaman (±4.000 baris) tidak ditulis ulang kodenya di dalam plan. Plan memuat kode lengkap untuk komponen bersama dan satu halaman acuan per jenis (form dan tabel), lalu aturan konversi dan catatan khusus per halaman. Eksekutor membaca setiap halaman sebelum mengubahnya dan `tsc` adalah pagar utama.

## Global Constraints

- Hanya komponen Untitled UI gratis; tampilan mengikuti Panduan UI/UX untuk identitas (Sapphire, `tabular-nums`, badge radius 4px, tanpa kartu di dalam kartu) dan Untitled UI untuk semantik, keyboard, fokus.
- Logika halaman tidak berubah: `useForm`, `transform`, `router.*`, filter, pagination sisi klien, `can.*`, nama berkas, dan props Inertia. Hanya elemen tampilan yang diganti.
- Halaman yang dimigrasi tidak mencampur komponen Breeze (`InputError`, `TextInput`, `PrimaryButton`, dst.). Impor memakai `@/Components/...` berhuruf besar.
- Pesan galat validasi ditampilkan lewat `hint={errors.x}` + `isInvalid={Boolean(errors.x)}` pada komponen field. Teks bantuan biasa tetap berupa `hint` saat tidak ada galat (`hint={errors.x ?? 'teks bantuan'}`).
- Tabel: kerapatan baris bawaan Untitled UI (tanpa `py-*` kustom), `onRowAction={() => {}}` bila baris memuat tautan atau tombol, `Table.Head` ber-`id` unik.
- Warna tombol: `color="primary"` untuk aksi utama; `secondary-brand` untuk aksi sekunder penting (mis. Impor/Ekspor lewat `ImportExportButtons`); tombol ikon baris: lihat/biru `secondary-brand`, ubah/hijau `secondary-green`, hapus/merah `secondary-destructive`; amber hanya peringatan. Tombol batal `secondary`.
- Tidak ada dependensi baru. CLI Untitled UI hanya untuk `textarea`; setelah itu perbaiki alias, pangkas berkas yang ikut terbawa, dan cek `@/components/` huruf kecil (aturan Fase 2).
- Verifikasi frontend: `npx tsc --noEmit` dan `npm run build`. Agen tidak menguji lewat browser kecuali pengguna mengizinkan; cek visual oleh pengguna di gerbang.
- Git: commit per task/halaman di `main`, tanpa trailer Co-Authored-By, stage dengan path eksplisit, tanpa push.

## Review Focus

1. **Select dengan kunci kosong**: React Aria tidak menerima kunci `''`. Pagar: untuk opsi "Semua"/"Pilih…" pakai penanda (`__all`) lalu petakan kembali ke nilai asli di handler (pola Fase 3).
2. **Nilai numerik pada Select** (`parent_id`, id unit): `onSelectionChange` memberi `Key`; konversi `Number(key)` bila state bertipe angka agar payload tidak berubah menjadi string.
3. **`required` bawaan form**: sebelumnya validasi browser lewat atribut `required`; `isRequired` pada field harus mempertahankan perilaku itu.
4. **Modal konfirmasi hapus saat permintaan berjalan**: tidak boleh tertutup oleh klik di luar atau Esc selagi `isDeleting`, dan tombol konfirmasi tidak bisa ditekan ganda. Pagar: `isDismissable={!isLoading}` dan `isLoading` pada `ConfirmDialog` (Task 1).
5. **Tabel pohon Kategori**: buka/tutup baris induk harus tetap bekerja dengan Table React Aria (baris diratakan; kunci baris unik antara induk dan anak). Pagar: kunci `p-<id>`/`c-<id>` (Task 2).
6. **Role bawaan sistem** (`is_system`) tetap tidak bisa dihapus/diubah sesuai aturan sekarang; tampilan tombolnya tidak boleh membuka celah. Pagar: kondisi `disabled`/sembunyi dipertahankan persis (Task 3).
7. **Unggah foto Pegawai**: pratinjau, batas ukuran/tipe, dan penggantian foto tetap bekerja; input file native dipertahankan di balik `Button`. Pagar: Task 5.
8. **Matriks izin Role (RoleModal)**: pilih semua per grup, pilih semua/kosongkan, dan Role sistem terkunci tetap benar; banyak checkbox dalam modal yang menggulir. Pagar: Task 3 dan butir gerbang.
9. **Modal Buat Akun Login (Pegawai/Show)**: tampil/sembunyi kata sandi dan konfirmasi, `Select` role, dan galat per field tetap bekerja. Pagar: Task 6.
10. **Pagination sisi klien dengan "item per halaman"** (Pegawai/Index): mengubah jumlah per halaman harus mengembalikan ke halaman 1. Pagar: logika `itemsPerPage`/`currentPage` tidak diubah (Task 4).

---

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `resources/js/Components/PageHeader.tsx` (baru) | Breadcrumb + judul + slot aksi |
| `resources/js/Components/ConfirmDialog.tsx` (baru) | Modal konfirmasi hapus (peran bahaya) berbasis `ModalOverlay` |
| `resources/js/Components/ui/base/textarea/textarea.tsx` (baru, CLI) | Field area teks |
| `resources/js/Pages/AssetCategories/{Index,Create,Edit}.tsx` | Task 2 |
| `resources/js/Pages/Roles/{Index,RoleModal}.tsx` | Task 3 |
| `resources/js/Pages/Pegawai/Index.tsx` | Task 4 |
| `resources/js/Pages/Pegawai/{Create,Edit}.tsx` | Task 5 |
| `resources/js/Pages/Pegawai/Show.tsx` | Task 6 |

---

### Task 1: Komponen bersama

**Files:**
- Create: `resources/js/Components/PageHeader.tsx`, `resources/js/Components/ConfirmDialog.tsx`, `resources/js/Components/ui/base/textarea/textarea.tsx` (CLI)
- Modify: `resources/js/Pages/Assets/Index.tsx` (memakai `PageHeader`)

**Interfaces:**
- Produces: `PageHeader({ crumbs: { label: string; href?: string }[]; title: string; actions?: ReactNode })`; `ConfirmDialog({ title: string; children: ReactNode; confirmLabel: string; isLoading?: boolean; onConfirm: () => void; onClose: () => void })`; `TextArea` dari `@/Components/ui/base/textarea/textarea` (props `label`, `hint`, `isInvalid`, `isRequired`, `placeholder`, `rows`, `value`, `onChange(value: string)`).

- [ ] **Step 1: `PageHeader`**

```tsx
import { Link } from '@inertiajs/react';
import { ChevronRight } from '@untitledui/icons';
import { Fragment, ReactNode } from 'react';

export interface Crumb {
    label: string;
    href?: string;
}

export default function PageHeader({
    crumbs,
    title,
    actions,
}: {
    crumbs: Crumb[];
    title: string;
    actions?: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <nav
                    aria-label="Breadcrumb"
                    className="mb-1 flex items-center gap-1.5 text-xs text-slate-500"
                >
                    <Link href={route('dashboard')} className="hover:text-blue-700">
                        Home
                    </Link>
                    {crumbs.map((crumb) => (
                        <Fragment key={crumb.label}>
                            <ChevronRight className="size-3 text-slate-400" aria-hidden="true" />
                            {crumb.href ? (
                                <Link href={crumb.href} className="hover:text-blue-700">
                                    {crumb.label}
                                </Link>
                            ) : (
                                <span className="font-medium text-slate-800" aria-current="page">
                                    {crumb.label}
                                </span>
                            )}
                        </Fragment>
                    ))}
                </nav>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
            </div>
            {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
        </div>
    );
}
```

- [ ] **Step 2: `ConfirmDialog`**

```tsx
import { Dialog, Modal, ModalOverlay } from '@/Components/ui/application/modals/modal';
import { Button } from '@/Components/ui/base/buttons/button';
import { Trash01 } from '@untitledui/icons';
import { ReactNode } from 'react';

export default function ConfirmDialog({
    title,
    children,
    confirmLabel,
    isLoading = false,
    onConfirm,
    onClose,
}: {
    title: string;
    children: ReactNode;
    confirmLabel: string;
    isLoading?: boolean;
    onConfirm: () => void;
    onClose: () => void;
}) {
    return (
        <ModalOverlay
            isOpen
            isDismissable={!isLoading}
            isKeyboardDismissDisabled={isLoading}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <Modal className="sm:max-w-md">
                <Dialog role="alertdialog" aria-labelledby="confirm-dialog-title">
                    <div className="w-full p-6">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                                <Trash01 className="size-5" aria-hidden="true" />
                            </div>
                            <div>
                                <h3 id="confirm-dialog-title" className="text-base font-bold text-slate-900">
                                    {title}
                                </h3>
                                <p className="text-xs text-slate-500">Tindakan ini tidak dapat dibatalkan.</p>
                            </div>
                        </div>
                        <div className="mb-6 text-sm text-slate-600">{children}</div>
                        <div className="flex items-center justify-end gap-3">
                            <Button color="secondary" size="md" isDisabled={isLoading} onPress={onClose}>
                                Batal
                            </Button>
                            <Button color="primary-destructive" size="md" isLoading={isLoading} onPress={onConfirm}>
                                {confirmLabel}
                            </Button>
                        </div>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
}
```

- [ ] **Step 3: Tambah `textarea` lewat CLI dan rapikan**

```bash
npx untitledui@latest add textarea -y --path resources/js/Components/ui --lib-version 8
git status --short
```
Lalu: ganti alias `@/resources/js/Components/ui/` → `@/Components/ui/`, `@/utils/`/`@/hooks/` → `@/lib/` pada berkas baru; pindahkan berkas ke `lib/` yang belum ada; hapus berkas `ui/` yang ikut terbawa tetapi tidak diimpor `textarea` (jalankan ulang pemangkasan impor-closure seperti Fase 2); `grep -rn "@/components/" resources/js` harus kosong; `npx tsc --noEmit` bersih. Catat nama prop sebenarnya `TextArea` (`label`, `hint`, `isInvalid`, `onChange`) dan sesuaikan Interfaces di atas bila berbeda.

- [ ] **Step 4: `Assets/Index` memakai `PageHeader`**

Ganti blok header (breadcrumb + `h1` + kelompok tombol) pada `resources/js/Pages/Assets/Index.tsx` dengan:
```tsx
<PageHeader
    crumbs={[{ label: 'Data Aset' }]}
    title="Daftar Barang Milik Daerah"
    actions={
        <>
            {/* tombol Cetak Label, ImportExportButtons, Tambah Aset Baru yang sudah ada, tanpa perubahan */}
        </>
    }
/>
```
(pindahkan ketiga tombol apa adanya ke `actions`; impor `PageHeader`; buang impor `Link` bila tidak lagi dipakai).

- [ ] **Step 5: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
git add resources/js/Components/PageHeader.tsx resources/js/Components/ConfirmDialog.tsx resources/js/Components/ui resources/js/lib resources/js/Pages/Assets/Index.tsx package.json package-lock.json
git commit -m "feat(ui): add PageHeader, ConfirmDialog and the textarea component"
```

---

### Task 2: Kategori Aset (Index, Create, Edit)

**Files:**
- Modify: `resources/js/Pages/AssetCategories/Index.tsx`, `Create.tsx`, `Edit.tsx`

**Interfaces:** Consumes Task 1 (`PageHeader`, `ConfirmDialog`, `TextArea`), `Input`, `Select`, `RadioGroup`/`RadioButton` (`@/Components/ui/base/radio-buttons/radio-buttons`), `Table`, `PaginationPageDefault`, `Button`, `Badge`. Produces: halaman dengan props Inertia yang sama.

- [ ] **Step 1: `Index.tsx` (tabel pohon)**

Aturan khusus:
- Ratakan data menjadi `rows = displayedCategories.flatMap(cat => [{ kind: 'parent', key: 'p-'+cat.id, cat }, ...(expanded[cat.id] ? (cat.children ?? []).map((child, idx) => ({ kind: 'child', key: 'c-'+child.id, cat: child, idx, parent: cat })) : [])])` dan render dengan `Table.Body items={rows}` dan `Table.Row id={row.key}`; hapus hack `<div style={{display:'contents'}}>` dan `<table>` mentah.
- Kolom (`Table.Head`): Nama Kategori (isRowHeader), Kode, Jumlah Aset, Aksi. Induk: tombol buka/tutup (`Button color="tertiary" size="sm" iconLeading={ChevronDown}` dengan rotasi `-rotate-90` saat tertutup, `aria-label` & `aria-expanded` dipertahankan) + nama kapital tebal. Anak: konektor garis (`<span className="inline-block h-px w-4 bg-slate-300" />`) + nama.
- Kode: `font-mono tabular-nums`. Jumlah aset: `Badge type="color" size="sm" color="gray"` untuk induk dan `color="brand"` untuk anak, teks `{n} unit`, `className="rounded-sm"`.
- Aksi: ubah = `Button color="secondary-green" size="sm" iconLeading={Edit01} href=… aria-label=… ` + `Tooltip`; hapus = `Button color="secondary-destructive" size="sm" iconLeading={Trash01} onPress={() => setDeletingCategory(...)}` + `Tooltip`.
- Hapus: `ConfirmDialog` dengan `title="Hapus Kategori Aset"`, `confirmLabel="Ya, Hapus Kategori"`, isi pesan yang sama (nama dalam `<strong>`), `isLoading` bila diperlukan (logika `onFinish` tetap).
- Banner galat `errors.category`: tetap kotak merah sederhana (tidak ada komponen alert gratis yang dibutuhkan).
- Pagination sisi klien tetap dengan `PaginationPageDefault page={currentPage} total={totalPages} onPageChange={setCurrentPage}`; teks "Menampilkan x dari y kategori" dipertahankan.
- Header: `PageHeader crumbs={[{ label: 'Kategori Aset' }]} title="Master Kategori Aset" actions={<><ImportExportButtons modul="kategori" />{can.create && <Button color="primary" size="md" iconLeading={Plus} href={route('asset-categories.create')}>Tambah Kategori</Button>}</>}`.
- Hapus ikon SVG lokal (`PencilIcon`, `TrashIcon`, `PlusIcon`, `ChevronRightIcon`, `ChevronDownIcon`).

Verifikasi: `npx tsc --noEmit`; `npm run build`; commit `git add resources/js/Pages/AssetCategories/Index.tsx` dengan pesan `feat(ui): migrate the category list page to Untitled UI components`.

- [ ] **Step 2: `Create.tsx` (halaman acuan form)**

Kerangka (terapkan juga pada `Edit.tsx` dengan perubahan nilai awal/tombol yang ada di berkas itu):
```tsx
<PageHeader
    crumbs={[{ label: 'Kategori Aset', href: route('asset-categories.index') }, { label: 'Tambah Kategori' }]}
    title="Tambah Kategori Aset"
/>
<form onSubmit={submit} className="space-y-6">
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
        <h2 className="border-b border-slate-100 pb-4 text-base font-semibold text-slate-900">Informasi Kategori</h2>
        <div className="space-y-6 pt-6">
            <RadioGroup
                label="Jenis Kategori"
                isRequired
                orientation="horizontal"
                value={categoryType}
                onChange={(v) => setCategoryType(v as 'child' | 'parent')}
            >
                <RadioButton value="parent" label="Kategori Utama (Induk)" />
                <RadioButton value="child" label="Subkategori" />
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
                        hint={errors.parent_id ?? 'Pilih kategori utama untuk subkategori baru ini'}
                    >
                        {(item) => <Select.Item id={item.id} label={item.label} />}
                    </Select>
                    <Input label="Kode Kategori" placeholder="Contoh: 02.09.04" value={data.code} onChange={(v) => setData('code', v)} isInvalid={Boolean(errors.code)} hint={errors.code ?? 'Kode akan mengikuti format standar BMD'} />
                </div>
            ) : (
                <div className="max-w-md">
                    <Input label="Kode Kategori" placeholder="Contoh: 02.09" value={data.code} onChange={(v) => setData('code', v)} isInvalid={Boolean(errors.code)} hint={errors.code ?? 'Kode akan mengikuti format standar BMD'} />
                </div>
            )}

            <Input label="Nama Kategori" isRequired placeholder="Masukkan nama kategori (huruf kapital)" value={data.name} onChange={(v) => setData('name', v)} isInvalid={Boolean(errors.name)} hint={errors.name} />
            <TextArea label="Deskripsi (Opsional)" rows={4} placeholder="Tambahkan keterangan kategori jika diperlukan" value={data.description} onChange={(v) => setData('description', v)} isInvalid={Boolean(errors.description)} hint={errors.description} />
        </div>
    </div>
    <div className="flex items-center justify-end gap-3">
        <Button color="secondary" size="md" href={route('asset-categories.index')}>Batal</Button>
        <Button color="primary" size="md" type="submit" isLoading={processing}>{processing ? 'Menyimpan...' : 'Simpan Kategori'}</Button>
    </div>
</form>
```
Cocokkan nama prop `RadioGroup`/`RadioButton`/`TextArea` dengan berkas komponen (Task 1 Step 3 dan `radio-buttons.tsx`); sesuaikan dalam commit yang sama. `useForm`, `transform`, `submit`, dan `categoryType` tidak berubah. Hapus ikon lokal dan impor `InputError`.

Verifikasi: `tsc`, build; commit `feat(ui): migrate the category create page to Untitled UI components`.

- [ ] **Step 3: `Edit.tsx`**

Terapkan kerangka Step 2 pada `Edit.tsx` (judul "Ubah Kategori Aset", tombol "Simpan Perubahan" sesuai teks berkas sekarang, nilai awal dan `put` seperti yang sudah ada; bila ada blok khusus Edit—mis. peringatan induk/anak—pertahankan isinya dan gayakan dengan utilitas `slate`/`amber` seperti sebelumnya). Verifikasi: `tsc`, build; commit `feat(ui): migrate the category edit page to Untitled UI components`.

- [ ] **Step 4: Test asap backend**

```bash
php artisan test --compact --filter='AssetCategoryManagement|ImportKategori'
```
Expected: hijau.

---

### Task 3: Role (Index, RoleModal)

**Files:**
- Modify: `resources/js/Pages/Roles/Index.tsx`, `resources/js/Pages/Roles/RoleModal.tsx`

**Interfaces:** Consumes `PageHeader`, `ConfirmDialog`, `Table`, `Badge`, `Button`, `Tooltip`, `Input`, `Select`, `TextArea`, `Checkbox` (`@/Components/ui/base/checkbox/checkbox`), `ModalOverlay`/`Modal`/`Dialog`. Props `RoleModal` tidak berubah (`isOpen`, `role`, `permissionGroups`, `onClose`).

- [ ] **Step 1: `Index.tsx`**

Konversi tabel peran ke `Table` (kolom sesuai berkas sekarang), badge ke `Badge type="color" size="sm" className="rounded-sm"`, tombol ubah `secondary-green`, hapus `secondary-destructive`, kondisi `is_system`/`disabled`/sembunyi dipertahankan persis; hapus lewat `ConfirmDialog` (`isLoading={isDeleting}`); header lewat `PageHeader`; tombol tambah `color="primary"`. Commit `feat(ui): migrate the role list page to Untitled UI components`.

- [ ] **Step 2: `RoleModal.tsx`**

- Kontainer: `ModalOverlay isOpen={isOpen} isDismissable onOpenChange={(o) => { if (!o) onClose(); }}` + `Modal className="sm:max-w-3xl"` + `Dialog` dengan `aria-labelledby`; badan modal menggulir (`max-h` ditangani `Modal`), tombol aksi menempel di bawah.
- Field: nama sistem (`Input`, dikunci bila `isSystemRole`), nama tampilan (`Input`), lingkup unit (`Select` dengan tiga opsi `all`/`binaan`/`own`), kepala unit (`Select` dengan penanda `__none` untuk nilai `''`), deskripsi (`TextArea`).
- Matriks izin: tiap grup berjudul dengan tombol "pilih semua grup" (`Button color="link-color" size="sm"`) dan daftar `Checkbox` berlabel `formatPermissionLabel(perm)` (`isSelected`, `onChange`); "Pilih semua"/"Kosongkan" sebagai `Button color="secondary" size="sm"`. Logika `togglePermission`, `toggleGroup`, `selectAll`, `deselectAll`, `useEffect` inisialisasi, dan pengiriman tidak diubah; `if (!isOpen) return null` tetap.
- Galat server (`errors` lokal dan `pageErrors`) tampil lewat `hint`/`isInvalid` per field.
Commit `feat(ui): migrate the role modal to Untitled UI components`.

- [ ] **Step 3: Test asap backend**

```bash
php artisan test --compact --filter='RoleManagementBackend|RoleSystemGuard|RoleDelegation|UnitHeadRole'
```
Expected: hijau.

---

### Task 4: Pegawai Index

**Files:**
- Modify: `resources/js/Pages/Pegawai/Index.tsx`

- [ ] **Step 1: Konversi**

Header `PageHeader` (+ `ImportExportButtons modul="pegawai"` dan tombol Tambah `color="primary"`); filter: pencarian `Input icon={SearchLg}`, status (`Select` dengan penanda `all`) dan unit (`Select`), keduanya dengan penanda `__all` pada kunci kosong; tabel `Table` (kolom foto/avatar `<img>` dipertahankan, nama, NIP, status `Badge`, unit, aksi); aksi lihat `secondary-brand`, ubah `secondary-green`, hapus `secondary-destructive` + `Tooltip`; hapus lewat `ConfirmDialog` (`isLoading={isDeleting}`, isi dengan `deleteModalPegawai.nama`); footer: "item per halaman" `Select` kecil dan `PaginationPageDefault` (halaman direset ke 1 bila jumlah per halaman diubah; logika `itemsPerPage`/`currentPage` tidak diubah); keadaan kosong dengan "Hapus semua filter" bila ada filter aktif (pola Fase 3). Tidak ada ikon SVG lokal tersisa.

- [ ] **Step 2: Verifikasi dan commit**

```bash
npx tsc --noEmit && npm run build 2>&1 | tail -5
php artisan test --compact --filter='PegawaiManagement|ImportPegawai'
git add resources/js/Pages/Pegawai/Index.tsx
git commit -m "feat(ui): migrate the employee list page to Untitled UI components"
```

---

### Task 5: Pegawai Create dan Edit

**Files:**
- Modify: `resources/js/Pages/Pegawai/Create.tsx`, `resources/js/Pages/Pegawai/Edit.tsx`

- [ ] **Step 1: `Create.tsx`**

Terapkan kerangka form Task 2 Step 2 pada seluruh field (`Input`, `Select`, `RadioGroup` untuk status PNS/PPPK dan pilihan lain yang berupa radio, `TextArea` bila ada). Unggah foto: pertahankan `<input type="file" ref={fileInputRef} className="hidden" …>` dan `onChange` yang membuat pratinjau; tombol pemicu menjadi `Button color="secondary" size="md" onPress={() => fileInputRef.current?.click()}`; pratinjau `<img>` dengan bingkai sederhana; galat foto lewat teks merah kecil di bawah (`errors.foto_profile`/nama field sesungguhnya). Nilai kosong pada `Select` memakai penanda; nilai numerik dikonversi sesuai tipe state. Commit `feat(ui): migrate the employee create page to Untitled UI components`.

- [ ] **Step 2: `Edit.tsx`**

Sama dengan Create, ditambah perilaku khusus Edit (foto yang sudah ada, tombol hapus/ganti foto lewat `router`, `put`/`post` dengan `_method`, seperti berkas sekarang). Commit `feat(ui): migrate the employee edit page to Untitled UI components`.

- [ ] **Step 3: Test asap backend**

```bash
php artisan test --compact --filter='PegawaiManagement|PegawaiCreateUser'
```
Expected: hijau.

---

### Task 6: Pegawai Show dan gerbang

**Files:**
- Modify: `resources/js/Pages/Pegawai/Show.tsx`

- [ ] **Step 1: Konversi**

Header `PageHeader` dengan aksi (Ubah `secondary-green`, Buat Akun `primary` bila `can`, dst. sesuai berkas); kartu informasi dan tabel aset yang dipegang memakai `Table` dan `Badge`; modal "Buat Akun Login" menjadi `ModalOverlay`/`Modal`/`Dialog` dengan `Input type="password"` (komponen sudah menyediakan tombol tampil/sembunyi, jadi state `showPassword`/`showConfirmPassword` dan tombolnya dibuang bila tidak lagi dipakai), `Select` role, dan galat per field lewat `hint`. `useForm` `createAccountForm` dan pengiriman tidak diubah. Commit `feat(ui): migrate the employee detail page to Untitled UI components`.

- [ ] **Step 2: Pagar kelompok**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
grep -rln "InputError\|PrimaryButton\|SecondaryButton\|TextInput" resources/js/Pages/AssetCategories resources/js/Pages/Roles resources/js/Pages/Pegawai
grep -rn "@/components/" resources/js | head
php artisan test --compact --filter='AssetCategory|Role|Pegawai|ImportKategori|ImportPegawai|UnitHeadRole'
```
Expected: `tsc` dan build bersih; dua `grep` tidak menemukan apa pun; test hijau.

- [ ] **Step 3: GERBANG MASTER DATA — berhenti**

Laporkan hasil Task 1–6, `Ruling` yang diambil, dan hal yang tak bisa diverifikasi tanpa browser. Minta pengguna memeriksa:
- **Kategori Aset**: daftar pohon (buka/tutup induk, pagination 5 induk/halaman), tambah (radio induk/sub memunculkan field yang benar, galat validasi per field), ubah, hapus (modal, Esc dan klik luar menutup, tombol terkunci saat memproses, pesan galat bila kategori dipakai).
- **Role**: daftar, tambah/ubah lewat modal (matriks izin: pilih semua grup, pilih semua/kosongkan, Role sistem terkunci), hapus.
- **Pegawai**: daftar (cari, filter status/unit, item per halaman, pagination, hapus), tambah dan ubah (unggah dan ganti foto, radio status, select, galat), detail (modal Buat Akun Login: tampil/sembunyi sandi, role, galat).
- Umum: Tab/Enter/Esc di semua field dan modal, layar 375 px (tabel menggulir, form satu kolom), warna tombol sesuai aturan (utama biru, lihat biru muda, ubah hijau, hapus merah).
**Jangan memulai kelompok berikutnya** (Transaksi) sebelum pengguna menyatakan lolos.
