# Role: Halaman Tambah/Ubah Sendiri (menggantikan modal) + Migrasi Untitled UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengganti modal tambah/ubah Role (`RoleModal`) dengan halaman sendiri (`/pengaturan/roles/create` dan `/pengaturan/roles/{role}/edit`) dan memigrasikan seluruh halaman Role ke komponen Untitled UI.

**Architecture:** Backend: dua aksi baru `create` dan `edit` di `RoleController` (me-render halaman Inertia; akses sama dengan aturan `store`/`update` yang sudah ada, sehingga penolakan terjadi saat halaman dibuka, bukan setelah form diisi). `store`/`update`/`destroy` dan kedua FormRequest tidak berubah. Frontend: `Partials/RoleForm.tsx` (dipakai `Create` dan `Edit`) dengan tata letak satu kolom dan bilah aksi lengket di bawah; `Index` memakai tautan (bukan state modal) dan `Table`; `RoleModal.tsx` dihapus.

**Tech Stack:** Laravel 13, Inertia 2, Pest, React 19, Tailwind 4, Untitled UI (React Aria Components).

**Spec:** Keputusan pengguna 2026-10-14: "halaman role yang sebelumnya modal untuk edit role dan permission dibuatkan halaman sendiri"; tata letak "satu kolom + bilah aksi lengket" dipilih pengguna. Konteks migrasi: `docs/superpowers/specs/2026-10-14-migrasi-untitled-ui-design.md` §3.5. Pola acuan: plan Aset/Kategori/Pegawai/Auth di `docs/superpowers/plans/`.

Plan ini sudah memuat hasil review ponytail dan impeccable (2026-10-14).

## Global Constraints

- Aturan otorisasi tidak berubah dan tidak dilonggarkan: Create butuh `pengaturan.role`; Edit butuh `pengaturan.role` **dan** `canManageRole($role)` (persis syarat `UpdateRoleRequest::authorize`). `store`/`update`/`destroy`, `StoreRoleRequest`, `UpdateRoleRequest`, `AccessGuard`, dan pesan galat tidak diubah.
- Test ditulis lebih dulu (Task 1) dan harus gagal sebelum implementasi.
- `PermissionCatalogTest` mengecualikan berkas sumber label izin dari pemindaian "izin direferensikan di kode"; berkas itu berpindah dari `RoleModal.tsx` ke `Partials/RoleForm.tsx`, jadi pengecualiannya harus ikut diperbarui (Task 2 dan 4), kalau tidak, test kehilangan makna.
- Hanya komponen Untitled UI gratis; Panduan UI/UX menang untuk identitas. Warna tombol: tambah/simpan `primary`; ubah `secondary-green`; hapus `secondary-destructive`; Batal `secondary`. Badge `Badge type="color" size="sm" className="rounded-sm"`.
- Logika form tidak berubah: pembersihan `name` (huruf kecil, karakter selain `a-z0-9_-` menjadi `_`), `unit_head_of: '' → null`, `description` dipangkas lalu `'' → null`, `permissions` string[]; Role sistem: `name` terkunci.
- Impor `@/Components/...` berhuruf besar; tanpa komponen Breeze; tanpa dependensi baru.
- PHP: jalankan `vendor/bin/pint --dirty --format agent` setelah mengubah berkas PHP. Verifikasi frontend: `npx tsc --noEmit`, `npm run build`. Test backend: `php artisan test --compact --filter='Role|PermissionCatalog'`.
- Git: commit per task di `main`, tanpa trailer Co-Authored-By, stage dengan path eksplisit, tanpa push.

## Review Focus

1. **Akses Edit lebih ketat dari Index**: tombol Ubah tampil untuk semua role di daftar, tetapi halaman Edit harus 403 bagi yang tak berhak (role lebih kuat dari pengelola, atau dipegang pengguna di luar cakupan). Pagar: test Task 1.
2. **Galat validasi kembali ke halaman form**, bukan ke daftar. Pagar: test `from(route('roles.create'))` Task 1; galat `permissions` (pesan `AccessGuard`) tampil di atas matriks.
3. **Role sistem**: nama teknis terkunci dan tidak berubah di server; Edit memuat `is_system`. Pagar: test Task 1, `isDisabled` Task 2.
4. **Matriks izin besar (±46 izin)**: pilih semua per grup, pilih semua/kosongkan, hitungan terpilih; bilah aksi lengket tidak menutupi isi terakhir. Pagar: Task 2; butir gerbang.
5. **Kartu Cakupan Unit** (3 pilihan radio dengan penjelasan) tetap jelas dan bisa dipilih keyboard. Pagar: `RadioGroup` Task 2.
6. **Banner flash ganda di daftar**: `AuthenticatedLayout` sudah menampilkan `flash.success/error`; `Index` lama menampilkannya lagi. Pagar: banner lokal dibuang (Task 4).
7. **Hapus Role**: dinonaktifkan untuk role sistem atau yang masih dipakai (alasan terlihat lewat `title`), dialog terkunci saat memproses. Pagar: Task 4.
8. **Mengubah role yang sedang dipakai** berdampak langsung pada pengguna; pengelola harus diberi tahu sebelum menyimpan. Pagar: catatan amber di Edit bila `users_count > 0` (Task 3).
9. **Label izin** (`PERMISSION_LABELS`) pindah tanpa perubahan isi; izin baru tanpa label tetap jatuh ke format otomatis. Pagar: salinan identik (Task 2).

---

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `routes/web.php` | Mengaktifkan rute `create` dan `edit` pada resource `roles` |
| `app/Http/Controllers/RoleController.php` | Aksi `create` dan `edit`; `index` dan `edit` berbagi pembentuk payload role |
| `tests/Feature/RolePagesTest.php` (baru) | Test halaman Create/Edit |
| `tests/Feature/PermissionCatalogTest.php` | Pengecualian berkas label diperbarui |
| `resources/js/Pages/Roles/Partials/RoleForm.tsx` (baru) | Form bersama + matriks izin |
| `resources/js/Pages/Roles/Create.tsx`, `Edit.tsx` (baru) | Halaman Tambah/Ubah |
| `resources/js/Pages/Roles/Index.tsx` | Daftar (tautan + Table + ConfirmDialog) |
| `resources/js/Pages/Roles/RoleModal.tsx` | Dihapus (Task 4) |
| `docs/DETAIL_RBAC_SISTEM.md` | Rujukan berkas label diperbarui |

---

### Task 1: Rute, controller, dan test halaman (backend, TDD)

**Files:**
- Create: `tests/Feature/RolePagesTest.php`
- Modify: `routes/web.php:63`, `app/Http/Controllers/RoleController.php`

**Interfaces:**
- Produces: rute `roles.create` (`GET /pengaturan/roles/create`) dan `roles.edit` (`GET /pengaturan/roles/{role}/edit`); halaman Inertia `Roles/Create` (props: `permissionGroups`) dan `Roles/Edit` (props: `role` = `{ id, name, display_name, unit_scope, unit_head_of, is_system, description, permissions: string[] }`, `permissionGroups`).

- [ ] **Step 1: Tulis test yang gagal**

```php
<?php

use App\Models\Role;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->seed(PermissionSeeder::class);

    $kel = makeKelurahan(makeKecamatan(), 'Kelurahan A');
    $this->superAdmin = userWithRole('super-admin');
    $this->operator = userWithRole('admin_kecamatan');
    $this->manager = userWithRole('admin_kelurahan', $kel);
    $this->manager->givePermissionTo('pengaturan.role');
});

it('shows the create page with the permission catalog to a role manager', function () {
    $this->actingAs($this->superAdmin)
        ->get(route('roles.create'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Roles/Create')
            ->has('permissionGroups'));
});

it('denies the create and edit pages to users without pengaturan.role', function () {
    $role = Role::where('name', 'kasubag')->first();

    $this->actingAs($this->operator)->get(route('roles.create'))->assertForbidden();
    $this->actingAs($this->operator)->get(route('roles.edit', $role))->assertForbidden();
});

it('shows the edit page with the role and its permissions', function () {
    $custom = Role::create(['name' => 'auditor_aset', 'display_name' => 'Auditor Aset', 'unit_scope' => 'all', 'is_system' => false]);
    $custom->givePermissionTo(['aset.view', 'laporan.aset']);

    $this->actingAs($this->superAdmin)
        ->get(route('roles.edit', $custom))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Roles/Edit')
            ->where('role.id', $custom->id)
            ->where('role.name', 'auditor_aset')
            ->where('role.unit_scope', 'all')
            ->where('role.is_system', false)
            ->where('role.permissions', fn ($permissions) => collect($permissions)->sort()->values()->all() === ['aset.view', 'laporan.aset'])
            ->has('permissionGroups'));
});

it('flags a system role on its edit page', function () {
    $this->actingAs($this->superAdmin)
        ->get(route('roles.edit', Role::where('name', 'kasubag')->first()))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('role.is_system', true));
});

it('refuses the edit page for a role more powerful than the manager before any form is filled', function () {
    $this->actingAs($this->manager)
        ->get(route('roles.edit', Role::where('name', 'camat')->first()))
        ->assertForbidden();
});

it('lets a manager open the edit page of a role within its own reach', function () {
    $own = Role::create(['name' => 'operator_baru', 'display_name' => 'Operator Baru', 'unit_scope' => 'own', 'is_system' => false]);
    $own->givePermissionTo('aset.view');

    $this->actingAs($this->manager)
        ->get(route('roles.edit', $own))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('Roles/Edit'));
});

it('sends validation errors back to the form page instead of the list', function () {
    $this->actingAs($this->superAdmin)
        ->from(route('roles.create'))
        ->post(route('roles.store'), ['name' => 'Tidak Valid!', 'display_name' => '', 'unit_scope' => 'own'])
        ->assertRedirect(route('roles.create'))
        ->assertSessionHasErrors(['name', 'display_name']);

    $role = Role::create(['name' => 'role_lama', 'display_name' => 'Role Lama', 'unit_scope' => 'own', 'is_system' => false]);

    $this->actingAs($this->superAdmin)
        ->from(route('roles.edit', $role))
        ->put(route('roles.update', $role), ['name' => 'role_lama', 'display_name' => '', 'unit_scope' => 'own'])
        ->assertRedirect(route('roles.edit', $role))
        ->assertSessionHasErrors('display_name');
});
```

- [ ] **Step 2: Jalankan dan pastikan gagal**

```bash
php artisan test --compact --filter='RolePagesTest'
```
Expected: GAGAL ("Route [roles.create] not defined" dan sejenisnya).

- [ ] **Step 3: Aktifkan rute**

Di `routes/web.php` baris 63 ganti `->except(['create', 'edit', 'show'])` menjadi `->except(['show'])`.

- [ ] **Step 4: Aksi controller**

Di `RoleController.php`: tambahkan pembentuk payload bersama dan dua aksi, dan pada `index` ganti array literal di `->map(fn ($r) => [...])` dengan `->map(fn ($r) => $this->rolePayload($r))` (urutan field dan isinya identik):
```php
    public function create(Request $request): Response
    {
        abort_unless($request->user()->can('pengaturan.role'), 403);

        return Inertia::render('Roles/Create', [
            'permissionGroups' => PermissionSeeder::PERMISSION_GROUPS,
        ]);
    }

    public function edit(Request $request, Role $role): Response
    {
        abort_unless($request->user()->can('pengaturan.role') && $request->user()->canManageRole($role), 403);

        return Inertia::render('Roles/Edit', [
            'role' => $this->rolePayload($role->loadCount('users')->load('permissions')),
            'permissionGroups' => PermissionSeeder::PERMISSION_GROUPS,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function rolePayload(Role $role): array
    {
        return [
            'id' => $role->id,
            'name' => $role->name,
            'display_name' => $role->display_name ?? $role->name,
            'unit_scope' => $role->unit_scope,
            'unit_head_of' => $role->unit_head_of,
            'is_system' => (bool) $role->is_system,
            'description' => $role->description,
            'users_count' => $role->users_count,
            'permissions_count' => $role->permissions->count(),
            'permissions' => $role->permissions->pluck('name')->all(),
        ];
    }
```

- [ ] **Step 5: Jalankan test dan Pint**

```bash
php artisan test --compact --filter='RolePagesTest|RoleManagementBackend|RoleDelegation|RoleSystemGuard|UnitHeadRole'
vendor/bin/pint --dirty --format agent
```
Expected: hijau (test lama tidak berubah karena `index` menghasilkan payload yang sama).

- [ ] **Step 6: Commit**

```bash
git add routes/web.php app/Http/Controllers/RoleController.php tests/Feature/RolePagesTest.php
git commit -m "feat(roles): add dedicated create and edit pages with early authorization"
```

---

### Task 2: `RoleForm`

**Files:**
- Create: `resources/js/Pages/Roles/Partials/RoleForm.tsx`
- Modify: `tests/Feature/PermissionCatalogTest.php:9`

**Interfaces:**
- Consumes: `Input`, `Select`, `TextArea`, `Checkbox`, `Badge`, `Button`, `Label`, `RadioGroup`/`RadioButton`.
- Produces: `RoleForm`, tipe `RoleFormData` (lihat kode di bawah).

- [ ] **Step 1: Perbarui pengecualian pada `PermissionCatalogTest`**

Di `pdSources()` ganti `->reject(fn ($file) => str_ends_with(..., 'Pages/Roles/RoleModal.tsx'))` dengan pengecualian kedua berkas label (sementara, sampai `RoleModal` dihapus di Task 4):
```php
        ->reject(fn ($file) => str_ends_with(str_replace('\\', '/', $file->getPathname()), 'Pages/Roles/RoleModal.tsx')
            || str_ends_with(str_replace('\\', '/', $file->getPathname()), 'Pages/Roles/Partials/RoleForm.tsx'))
```

- [ ] **Step 2: Tulis `RoleForm.tsx`**

```tsx
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { Checkbox } from '@/Components/ui/base/checkbox/checkbox';
import { Input } from '@/Components/ui/base/input/input';
import { Label } from '@/Components/ui/base/input/label';
import { RadioButton, RadioGroup } from '@/Components/ui/base/radio-buttons/radio-buttons';
import { Select } from '@/Components/ui/base/select/select';
import { TextArea } from '@/Components/ui/base/textarea/textarea';
import { InertiaFormProps } from '@inertiajs/react';
import { FormEvent } from 'react';

export type RoleFormData = {
    name: string;
    display_name: string;
    unit_scope: 'all' | 'binaan' | 'own';
    unit_head_of: '' | 'kecamatan' | 'kelurahan';
    description: string;
    permissions: string[];
};

type Props = {
    form: InertiaFormProps<RoleFormData>;
    permissionGroups: Record<string, string[]>;
    isSystemRole?: boolean;
    submitLabel: string;
    onSubmit: (e: FormEvent) => void;
    cancelHref: string;
};

const NONE = '__none';

const PERMISSION_LABELS: Record<string, string> = {
    'dashboard.view': 'Lihat Dashboard',
    'aset.view': 'Lihat Data Aset',
    'aset.create': 'Tambah Aset Baru',
    'aset.update': 'Ubah / Edit Aset',
    'aset.print-label': 'Cetak Label & Barcode QR',
    'import-aset': 'Import Data Aset Excel',
    'export-aset': 'Export Data Aset Excel',
    'scan.view': 'Akses Fitur Scan QR',
    'kategori.view': 'Lihat Kategori Aset',
    'kategori.create': 'Tambah Kategori',
    'kategori.update': 'Ubah Kategori',
    'kategori.delete': 'Hapus Kategori',
    'import-kategori': 'Import Kategori Excel',
    'export-kategori': 'Export Kategori Excel',
    'pegawai.view': 'Lihat Data Pegawai',
    'pegawai.create': 'Tambah Pegawai',
    'pegawai.update': 'Ubah Pegawai',
    'pegawai.delete': 'Hapus Pegawai',
    'pegawai.create-user': 'Buat Akun Pengguna',
    'import-pegawai': 'Import Pegawai Excel',
    'export-pegawai': 'Export Pegawai Excel',
    'penerimaan.view': 'Lihat Dokumen Penerimaan',
    'penerimaan.create': 'Buat Dokumen Penerimaan',
    'penerimaan.update': 'Ubah Dokumen Penerimaan',
    'penerimaan.delete': 'Hapus Dokumen Penerimaan',
    'mutasi.view': 'Lihat Riwayat & Daftar Mutasi',
    'mutasi.create': 'Ajukan Mutasi Aset',
    'permohonan.view': 'Lihat Permohonan Aset',
    'permohonan.create': 'Ajukan Permohonan Aset',
    'permohonan.fulfill': 'Penuhi Permohonan Aset',
    'permohonan.close': 'Tutup / Selesaikan Permohonan',
    'laporan-insiden.view': 'Lihat Laporan Kerusakan / Kehilangan',
    'laporan-insiden.create': 'Buat Laporan Kerusakan / Kehilangan',
    'persetujuan.view': 'Lihat Kotak Persetujuan',
    'persetujuan.act': 'Setujui / Tolak Dokumen Persetujuan',
    'persetujuan.reassign': 'Alihkan Approver Persetujuan',
    'laporan.aset': 'Laporan Rekapitulasi Aset',
    'laporan.mutasi': 'Laporan Rekapitulasi Mutasi',
    'laporan.rusak-hilang': 'Laporan Rekap Rusak & Hilang',
    'pengaturan.alur': 'Pengaturan Alur Persetujuan',
    'pengaturan.role': 'Pengaturan Role & Hak Akses',
    'user.view': 'Lihat Daftar Pengguna',
    'user.manage-access': 'Kelola Role & Akses Pengguna',
    'user.reset-password': 'Atur Ulang Kata Sandi Pengguna',
    'user.toggle-status': 'Aktifkan / Nonaktifkan Pengguna',
    'user.delete': 'Hapus Pengguna',
};

function formatPermissionLabel(perm: string): string {
    return PERMISSION_LABELS[perm] ?? perm.replace(/[-.]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const SCOPE_OPTIONS: { value: RoleFormData['unit_scope']; label: string; hint: string }[] = [
    {
        value: 'all',
        label: 'Semua Unit (All)',
        hint: 'Dapat mengakses seluruh data aset di semua unit kecamatan dan seluruh kelurahan.',
    },
    {
        value: 'binaan',
        label: 'Unit & Binaan',
        hint: 'Dapat mengakses unit induk sendiri dan seluruh kelurahan binaannya (contoh: Camat).',
    },
    {
        value: 'own',
        label: 'Unit Sendiri Saja',
        hint: 'Terisolasi hanya pada data aset milik unit tempat pengguna bertugas.',
    },
];

const HEAD_ITEMS = [
    { id: NONE, label: 'Bukan pimpinan unit' },
    { id: 'kecamatan', label: 'Pimpinan Kecamatan' },
    { id: 'kelurahan', label: 'Pimpinan Kelurahan' },
];

export default function RoleForm({ form, permissionGroups, isSystemRole = false, submitLabel, onSubmit, cancelHref }: Props) {
    const { data, setData, processing, errors } = form;

    const allPermissions = Object.values(permissionGroups).flat();
    const errorCount = Object.keys(errors).length;

    const togglePermission = (perm: string) => {
        setData(
            'permissions',
            data.permissions.includes(perm) ? data.permissions.filter((p) => p !== perm) : [...data.permissions, perm],
        );
    };

    const toggleGroup = (perms: string[]) => {
        const allSelected = perms.every((p) => data.permissions.includes(p));
        setData(
            'permissions',
            allSelected
                ? data.permissions.filter((p) => !perms.includes(p))
                : [...data.permissions, ...perms.filter((p) => !data.permissions.includes(p))],
        );
    };

    return (
        <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
                {/* Identitas */}
                <section className="space-y-4">
                    <div className="border-b border-slate-100 pb-2">
                        <h2 className="text-base font-semibold text-slate-900">Identitas Role</h2>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input
                            label="Nama Tampilan"
                            isRequired
                            placeholder="Contoh: Auditor Aset Wilayah"
                            value={data.display_name}
                            onChange={(v) => setData('display_name', v)}
                            isInvalid={Boolean(errors.display_name)}
                            hint={errors.display_name}
                        />
                        <Input
                            label="Nama Teknis (Identifier Sistem)"
                            isRequired
                            isDisabled={isSystemRole}
                            placeholder="contoh: auditor_aset"
                            inputClassName="font-mono"
                            value={data.name}
                            onChange={(v) => setData('name', v.toLowerCase().replace(/[^a-z0-9_-]/g, '_'))}
                            isInvalid={Boolean(errors.name)}
                            hint={
                                errors.name ??
                                (isSystemRole
                                    ? 'Nama teknis role sistem terproteksi dan tidak dapat diubah.'
                                    : 'Huruf kecil, angka, garis bawah (underscore).')
                            }
                        />
                    </div>
                </section>

                {/* Cakupan unit */}
                <section className="space-y-4">
                    <div className="border-b border-slate-100 pb-2">
                        <h2 className="text-base font-semibold text-slate-900">Cakupan Data</h2>
                    </div>

                    <RadioGroup
                        isRequired
                        className="gap-2"
                        value={data.unit_scope}
                        onChange={(v) => setData('unit_scope', v as RoleFormData['unit_scope'])}
                        isInvalid={Boolean(errors.unit_scope)}
                    >
                        <Label isRequired>Cakupan Data Unit (Unit Scope)</Label>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            {SCOPE_OPTIONS.map((option) => (
                                <RadioButton
                                    key={option.value}
                                    value={option.value}
                                    label={option.label}
                                    hint={option.hint}
                                    className="rounded-xl border border-slate-200 p-3.5 transition hover:border-slate-300 data-selected:border-blue-600 data-selected:bg-blue-50/50 data-selected:ring-1 data-selected:ring-blue-600"
                                />
                            ))}
                        </div>
                        {errors.unit_scope && <p className="text-sm text-red-600">{errors.unit_scope}</p>}
                    </RadioGroup>

                    <Select
                        label='Pimpinan Unit (untuk langkah "Atasan Unit")'
                        items={HEAD_ITEMS}
                        selectedKey={data.unit_head_of || NONE}
                        onSelectionChange={(key) =>
                            setData('unit_head_of', key === NONE ? '' : (String(key) as RoleFormData['unit_head_of']))
                        }
                        isInvalid={Boolean(errors.unit_head_of)}
                        hint={errors.unit_head_of ?? 'Role ini menjadi atasan otomatis bagi pengajuan dari unit sejenis.'}
                    >
                        {(item) => <Select.Item id={item.id} label={item.label} />}
                    </Select>

                    <TextArea
                        label="Deskripsi / Catatan Tambahan"
                        rows={2}
                        placeholder="Jelaskan tujuan atau fungsi peran ini dalam tata kelola aset..."
                        value={data.description}
                        onChange={(v) => setData('description', v)}
                        isInvalid={Boolean(errors.description)}
                        hint={errors.description}
                    />
                </section>

                {/* Matriks izin */}
                <section className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <div>
                            <h2 className="text-base font-semibold text-slate-900">Matriks Hak Akses &amp; Izin (Permissions)</h2>
                            <p className="text-xs text-slate-500">
                                <span className="font-semibold tabular-nums text-slate-700">{data.permissions.length}</span> dari{' '}
                                <span className="tabular-nums">{allPermissions.length}</span> izin dipilih.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button color="secondary" size="sm" onPress={() => setData('permissions', [...allPermissions])}>
                                Pilih Semua
                            </Button>
                            <Button color="secondary" size="sm" onPress={() => setData('permissions', [])}>
                                Batal Semua
                            </Button>
                        </div>
                    </div>

                    {errors.permissions && (
                        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                            {errors.permissions}
                        </div>
                    )}

                    <div className="space-y-4">
                        {Object.entries(permissionGroups).map(([groupTitle, perms]) => {
                            const groupSelectedCount = perms.filter((p) => data.permissions.includes(p)).length;
                            const isGroupAllSelected = groupSelectedCount === perms.length;

                            return (
                                <div key={groupTitle} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                                    <div className="mb-2.5 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-slate-900">{groupTitle}</span>
                                            <Badge type="color" size="sm" color="gray" className="rounded-sm tabular-nums">
                                                {groupSelectedCount} / {perms.length}
                                            </Badge>
                                        </div>
                                        <Button color="link-color" size="sm" onPress={() => toggleGroup(perms)}>
                                            {isGroupAllSelected ? 'Batal Grup' : 'Pilih Grup'}
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                        {perms.map((perm) => {
                                            const isChecked = data.permissions.includes(perm);

                                            return (
                                                <Checkbox
                                                    key={perm}
                                                    isSelected={isChecked}
                                                    onChange={() => togglePermission(perm)}
                                                    label={formatPermissionLabel(perm)}
                                                    hint={<span className="font-mono text-[11px] text-slate-400">{perm}</span>}
                                                    className={`rounded-lg border p-2.5 transition ${
                                                        isChecked ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200 bg-white hover:bg-slate-50'
                                                    }`}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </div>

            {/* Bilah aksi lengket */}
            <div className="sticky bottom-0 z-20 -mx-6 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur-xs lg:-mx-8 lg:px-8">
                <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-slate-600" aria-live="polite">
                        {errorCount > 0 ? (
                            <span role="alert" className="font-medium text-red-600">
                                {errorCount} isian perlu diperbaiki
                            </span>
                        ) : (
                            <>
                                <span className="font-semibold tabular-nums text-slate-900">{data.permissions.length}</span> izin dipilih
                            </>
                        )}
                    </p>
                    <div className="flex items-center gap-3">
                        <Button color="secondary" size="md" href={cancelHref}>
                            Batal
                        </Button>
                        <Button color="primary" size="md" type="submit" isLoading={processing}>
                            {submitLabel}
                        </Button>
                    </div>
                </div>
            </div>
        </form>
    );
}
```
Blok `PERMISSION_LABELS` di atas disalin apa adanya dari `RoleModal.tsx`.

- [ ] **Step 3: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
php artisan test --compact --filter='PermissionCatalog'
git add resources/js/Pages/Roles/Partials/RoleForm.tsx tests/Feature/PermissionCatalogTest.php
git commit -m "feat(ui): add the shared role form with the permission matrix"
```
Expected: bersih (belum dipakai halaman); test hijau. Prop `RadioButton` (`className` string), `Checkbox` (`hint` bertipe ReactNode, `className`) yang berbeda dari yang diasumsikan disesuaikan dan dicatat sebagai `Ruling`.

---

### Task 3: `Create` dan `Edit`

**Files:**
- Create: `resources/js/Pages/Roles/Create.tsx`, `resources/js/Pages/Roles/Edit.tsx`

**Interfaces:**
- Consumes: `RoleForm`, `RoleFormData`, `PageHeader`; props dari Task 1.

- [ ] **Step 1: `Create.tsx`**

```tsx
import PageHeader from '@/Components/PageHeader';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import RoleForm, { RoleFormData } from '@/Pages/Roles/Partials/RoleForm';
import { PageProps } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

interface CreateProps extends PageProps {
    permissionGroups: Record<string, string[]>;
}

export default function Create({ permissionGroups }: CreateProps) {
    const form = useForm<RoleFormData>({
        name: '',
        display_name: '',
        unit_scope: 'own',
        unit_head_of: '',
        description: '',
        permissions: [],
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();

        form.transform((data) => ({
            ...data,
            unit_head_of: data.unit_head_of || null,
            description: data.description.trim() || null,
        }));

        form.post(route('roles.store'));
    };

    return (
        <AuthenticatedLayout>
            <Head title="Tambah Role Baru" />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Pengaturan Role', href: route('roles.index') }, { label: 'Tambah Role' }]}
                    title="Tambah Role Baru"
                />
                <p className="-mt-3 text-sm text-slate-500">
                    Definisikan role baru beserta hak akses granular modul aplikasi.
                </p>

                <RoleForm
                    form={form}
                    permissionGroups={permissionGroups}
                    submitLabel="Simpan Role"
                    onSubmit={submit}
                    cancelHref={route('roles.index')}
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
import RoleForm, { RoleFormData } from '@/Pages/Roles/Partials/RoleForm';
import { PageProps, RoleItem } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

interface EditProps extends PageProps {
    role: RoleItem;
    permissionGroups: Record<string, string[]>;
}

export default function Edit({ role, permissionGroups }: EditProps) {
    const form = useForm<RoleFormData>({
        name: role.name,
        display_name: role.display_name,
        unit_scope: role.unit_scope,
        unit_head_of: role.unit_head_of ?? '',
        description: role.description ?? '',
        permissions: role.permissions ?? [],
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();

        form.transform((data) => ({
            ...data,
            unit_head_of: data.unit_head_of || null,
            description: data.description.trim() || null,
        }));

        form.put(route('roles.update', role.id));
    };

    return (
        <AuthenticatedLayout>
            <Head title={`Ubah Role - ${role.display_name}`} />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Pengaturan Role', href: route('roles.index') }, { label: 'Ubah Role' }]}
                    title={`Ubah Role: ${role.display_name}`}
                />
                <p className="-mt-3 text-sm text-slate-500">
                    Sesuaikan nama, cakupan data unit, dan izin akses untuk role ini.
                </p>
                {role.users_count > 0 && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        Role ini dipakai oleh <span className="font-semibold tabular-nums">{role.users_count}</span> pengguna;
                        perubahan izin dan cakupan berlaku langsung bagi mereka.
                    </p>
                )}

                <RoleForm
                    form={form}
                    permissionGroups={permissionGroups}
                    isSystemRole={role.is_system}
                    submitLabel="Perbarui Role"
                    onSubmit={submit}
                    cancelHref={route('roles.index')}
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
git add resources/js/Pages/Roles/Create.tsx resources/js/Pages/Roles/Edit.tsx
git commit -m "feat(ui): add the role create and edit pages"
```
Expected: bersih.

---

### Task 4: `Index`, penghapusan modal, dokumen

**Files:**
- Modify: `resources/js/Pages/Roles/Index.tsx` (ganti seluruh isi), `tests/Feature/PermissionCatalogTest.php`, `docs/DETAIL_RBAC_SISTEM.md:65`
- Delete: `resources/js/Pages/Roles/RoleModal.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `ConfirmDialog`, `Table`, `Badge`, `Button`, `Tooltip`; ikon `Edit01`, `Lock01`, `Plus`, `Trash01`.
- Produces: halaman dengan props Inertia sama (`roles`, `permissionGroups`).

- [ ] **Step 1: Tulis ulang `Index.tsx`**

```tsx
import ConfirmDialog from '@/Components/ConfirmDialog';
import PageHeader from '@/Components/PageHeader';
import { Table } from '@/Components/ui/application/table/table';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { Tooltip } from '@/Components/ui/base/tooltip/tooltip';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps, RoleItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Edit01, Lock01, Plus, Trash01 } from '@untitledui/icons';
import { useState } from 'react';

interface IndexProps extends PageProps {
    roles: RoleItem[];
    permissionGroups: Record<string, string[]>;
}

const SCOPE_BADGE: Record<string, { label: string; color: 'brand' | 'purple' | 'success' }> = {
    all: { label: 'Semua Unit', color: 'brand' },
    binaan: { label: 'Unit & Binaan', color: 'purple' },
    own: { label: 'Unit Sendiri', color: 'success' },
};

export default function Index({ roles }: IndexProps) {
    const [deletingRole, setDeletingRole] = useState<RoleItem | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const executeDelete = () => {
        if (!deletingRole || isDeleting) return;

        setIsDeleting(true);
        router.delete(route('roles.destroy', deletingRole.id), {
            preserveScroll: true,
            onSuccess: () => {
                setDeletingRole(null);
            },
            onFinish: () => {
                setIsDeleting(false);
            },
        });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Manajemen Role & Hak Akses" />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Pengaturan Role' }]}
                    title="Manajemen Role & Hak Akses"
                    actions={
                        <Button color="primary" size="md" iconLeading={Plus} href={route('roles.create')}>
                            Tambah Role Baru
                        </Button>
                    }
                />
                <p className="-mt-3 text-sm text-slate-500">
                    Kelola peran pengguna, cakupan data unit, dan matriks izin akses aplikasi.
                </p>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    <Table aria-label="Daftar role">
                        <Table.Header>
                            <Table.Head id="role" label="Peran / Role" isRowHeader />
                            <Table.Head id="cakupan" label="Cakupan Data" />
                            <Table.Head id="tipe" label="Tipe Role" />
                            <Table.Head id="pengguna" label="Pengguna" />
                            <Table.Head id="izin" label="Hak Akses" />
                            <Table.Head id="aksi" label="Aksi" />
                        </Table.Header>
                        <Table.Body
                            items={roles}
                            renderEmptyState={() => <p className="py-12 text-center text-sm text-slate-400">Belum ada role terdaftar.</p>}
                        >
                            {(r) => {
                                const deleteDisabled = r.is_system || r.users_count > 0;
                                const deleteReason = r.is_system
                                    ? 'Role sistem terproteksi tidak boleh dihapus.'
                                    : r.users_count > 0
                                      ? `Role ini masih digunakan oleh ${r.users_count} pengguna aktif.`
                                      : 'Hapus role ini';
                                const scope = SCOPE_BADGE[r.unit_scope] ?? SCOPE_BADGE.own;

                                return (
                                    <Table.Row id={r.id}>
                                        <Table.Cell>
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-slate-900">{r.display_name}</span>
                                                <span className="font-mono text-xs text-slate-400">{r.name}</span>
                                                {r.unit_head_of && (
                                                    <Badge type="color" size="sm" color="blue" className="mt-1 w-fit rounded-sm">
                                                        Pimpinan {r.unit_head_of === 'kecamatan' ? 'Kecamatan' : 'Kelurahan'}
                                                    </Badge>
                                                )}
                                                {r.description && <span className="mt-1 line-clamp-1 text-xs text-slate-500">{r.description}</span>}
                                            </div>
                                        </Table.Cell>
                                        <Table.Cell className="whitespace-nowrap">
                                            <Badge type="color" size="sm" color={scope.color} className="rounded-sm">
                                                {scope.label}
                                            </Badge>
                                        </Table.Cell>
                                        <Table.Cell className="whitespace-nowrap">
                                            {r.is_system ? (
                                                <Badge type="color" size="sm" color="gray" className="rounded-sm">
                                                    <Lock01 className="mr-1 inline size-3" aria-hidden="true" />
                                                    Sistem
                                                </Badge>
                                            ) : (
                                                <Badge type="color" size="sm" color="sky" className="rounded-sm">
                                                    Kustom
                                                </Badge>
                                            )}
                                        </Table.Cell>
                                        <Table.Cell className="whitespace-nowrap tabular-nums">{r.users_count} Pengguna</Table.Cell>
                                        <Table.Cell className="whitespace-nowrap">
                                            <Badge type="pill-color" size="sm" color="gray" className="tabular-nums">
                                                {r.permissions_count} Izin
                                            </Badge>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <div className="flex items-center gap-2">
                                                <Tooltip title="Ubah role">
                                                    <Button
                                                        color="secondary-green"
                                                        size="sm"
                                                        iconLeading={Edit01}
                                                        aria-label={`Ubah role ${r.display_name}`}
                                                        href={route('roles.edit', r.id)}
                                                    />
                                                </Tooltip>
                                                <span title={deleteReason}>
                                                    <Button
                                                        color="secondary-destructive"
                                                        size="sm"
                                                        iconLeading={Trash01}
                                                        aria-label={`Hapus role ${r.display_name}. ${deleteReason}`}
                                                        isDisabled={deleteDisabled}
                                                        onPress={() => setDeletingRole(r)}
                                                    />
                                                </span>
                                            </div>
                                        </Table.Cell>
                                    </Table.Row>
                                );
                            }}
                        </Table.Body>
                    </Table>
                </div>
            </div>

            {deletingRole && (
                <ConfirmDialog
                    title="Konfirmasi Hapus Role"
                    confirmLabel="Hapus Sekarang"
                    isLoading={isDeleting}
                    onConfirm={executeDelete}
                    onClose={() => setDeletingRole(null)}
                >
                    Apakah Anda yakin ingin menghapus role{' '}
                    <span className="font-bold text-slate-900">{deletingRole.display_name}</span>?
                </ConfirmDialog>
            )}
        </AuthenticatedLayout>
    );
}
```
Banner flash lokal sengaja dibuang (sudah ditampilkan `AuthenticatedLayout`). Sesuaikan prop yang berbeda (`Badge color="sky"|"blue"`, `Badge` memuat ikon sebagai anak) dan catat sebagai `Ruling`.

- [ ] **Step 2: Hapus modal dan perbarui rujukan**

```bash
git rm resources/js/Pages/Roles/RoleModal.tsx
```
Di `tests/Feature/PermissionCatalogTest.php` kembalikan pengecualian menjadi hanya `Pages/Roles/Partials/RoleForm.tsx`. Di `docs/DETAIL_RBAC_SISTEM.md:65` ganti `label di \`RoleModal.tsx\`` menjadi `label di \`Pages/Roles/Partials/RoleForm.tsx\``.

- [ ] **Step 3: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
grep -rn "RoleModal" resources tests docs/DETAIL_RBAC_SISTEM.md
php artisan test --compact --filter='Role|PermissionCatalog|UnitHeadRole'
git add resources/js/Pages/Roles/Index.tsx tests/Feature/PermissionCatalogTest.php docs/DETAIL_RBAC_SISTEM.md
git commit -m "feat(ui): migrate the role list to links and Untitled UI, and remove the role modal"
```
Expected: bersih; `grep` kosong; test hijau (rujukan `RoleModal` di plan/spec lama 2026-10-09 adalah arsip sejarah dan tidak diubah).

- [ ] **Step 4: Cek runtime singkat dan GERBANG ROLE — berhenti**

Cek di browser headless (super-admin atau akun yang punya `pengaturan.role`): daftar, `/pengaturan/roles/create`, `/pengaturan/roles/{id}/edit` (role kustom dan role sistem), kirim form dengan nama kosong untuk melihat galat.

Laporkan hasil Task 1–4, `Ruling`, dan hal yang tak bisa diverifikasi tanpa browser pengguna. Minta pengguna memeriksa:
- **Daftar**: tombol "Tambah Role Baru" membuka halaman sendiri; Ubah (hijau) membuka halaman Edit; Hapus nonaktif untuk role sistem/yang dipakai (alasan muncul saat hover); hapus berhasil lewat dialog; pesan sukses tampil sekali (tidak ganda).
- **Tambah**: bagian Identitas, Cakupan (tiga kartu pilihan), Pimpinan Unit, Deskripsi, Matriks Izin (Pilih Semua/Batal Semua/Pilih Grup, hitungan terpilih, nama teknis otomatis huruf kecil); bilah Simpan/Batal tetap terlihat saat menggulir; kirim kosong/tidak valid menampilkan galat per field, ringkasan "N isian perlu diperbaiki", dan tetap di halaman form; simpan berhasil kembali ke daftar dengan pesan.
- **Ubah**: nilai awal terisi; role sistem: nama teknis terkunci; tambah izin di luar milik pengelola (akun delegasi) menampilkan galat di atas matriks; Edit role yang tak boleh diakses (akun delegasi atas role lebih kuat) menampilkan 403 saat dibuka.
- Keyboard (Tab/Spasi pada kartu cakupan dan checkbox), layar 375 px, cincin fokus.
**Jangan memulai modul berikutnya** sebelum pengguna menyatakan lolos.
