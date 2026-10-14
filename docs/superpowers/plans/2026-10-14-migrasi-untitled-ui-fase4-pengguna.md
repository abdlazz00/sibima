# Migrasi Untitled UI, Fase 4: Pengaturan Pengguna Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memigrasikan modul Pengaturan Pengguna (`Users/Index`, `Users/Show`, `Users/Edit`) ke komponen Untitled UI tanpa mengubah logika, props Inertia, atau backend, dan mengganti `window.confirm`/`alert` bawaan peramban dengan dialog yang konsisten.

**Architecture:** Hanya frontend (controller, request, dan test backend tidak berubah). `ConfirmDialog` mendapat prop `variant` (`danger` bawaan, `default` untuk konfirmasi non-destruktif seperti aktif/nonaktifkan akun). `Index` memakai `Table`, `PaginationPageDefault` (menggantikan tautan paginasi Laravel berlabel HTML), `Select`/`Input`, dan `ConfirmDialog`. `Show` memakai `PageHeader`, kartu informasi, dan daftar izin efektif. `Edit` memakai `Toggle`, `Input`, `Select`, `RadioGroup`, `Checkbox`, bilah aksi lengket (pola yang sama dengan form Role), dan `ConfirmDialog` untuk hapus akun.

**Tech Stack:** React 19, Inertia 2, Tailwind 4, Untitled UI (React Aria Components), `@untitledui/icons`.

**Spec:** `docs/superpowers/specs/2026-10-14-migrasi-untitled-ui-design.md` §3.5 butir 4 (Pengaturan, dikerjakan satu modul per langkah atas permintaan pengguna). Pola acuan: plan Role, Pegawai, Kategori Aset di `docs/superpowers/plans/`.

Plan ini sudah memuat hasil review ponytail dan impeccable (2026-10-14).

## Global Constraints

- Hanya komponen Untitled UI gratis. Panduan UI/UX menang untuk identitas; Untitled UI menang untuk semantik, keyboard, fokus.
- Logika tidak berubah: filter server (`router.get(users.index)` dengan `search`/`role`/`unit_id`/`status`, Enter untuk mencari, pilihan langsung menerapkan), pagination server (`page`), `router.patch(users.toggle-status)`, `router.delete(users.destroy)`, `put(users.update)` dengan `preserveScroll`, penguncian diri (tidak bisa menonaktifkan/menghapus akun sendiri; Kasubag tidak bisa mencabut perannya sendiri), `can.*`, `canResetPassword`, dan props Inertia. Nama berkas tidak berubah.
- Konfirmasi bawaan peramban (`window.confirm`, `alert`) diganti `ConfirmDialog` dengan teks yang sama; teks peringatan hapus akun dipertahankan.
- Warna tombol: Lihat/Detail `secondary-brand`; Ubah/Edit `secondary-green`; Nonaktifkan `secondary-destructive`; Aktifkan `secondary`; hapus `secondary-destructive`; Simpan `primary`; Batal `secondary`. Badge `Badge type="color" size="sm" className="rounded-sm"`.
- Kunci kosong tidak valid pada `Select` dan `RadioButton` React Aria: filter "semua" memakai penanda `__all`; "ikuti default peran" memakai nilai `default` yang dipetakan ke `''`.
- Impor `@/Components/...` berhuruf besar; tanpa komponen Breeze; tanpa dependensi baru.
- Verifikasi: `npx tsc --noEmit`, `npm run build`, test backend `--filter='User'`. Cek runtime singkat di browser diperbolehkan untuk menangkap error; penilaian visual oleh pengguna di gerbang.
- Git: commit per task di `main`, tanpa trailer Co-Authored-By, stage dengan path eksplisit, tanpa push. Jangan men-stage penghapusan/berkas lain sebelum commit yang memerlukannya (hindari commit tengah yang tidak bisa dibangun).

## Review Focus

1. **Konfirmasi non-destruktif tidak boleh berlabel "tidak dapat dibatalkan"**: aktif/nonaktifkan akun bisa dibalik. Pagar: `ConfirmDialog variant="default"` (Task 1).
2. **Paginasi server**: pindah halaman harus mempertahankan filter yang sedang berlaku (dari props `filters`, bukan isi kolom yang belum dikirim). Pagar: Task 2; butir gerbang.
3. **Filter dan pencarian**: Enter di kolom cari menerapkan pencarian; Select menerapkan langsung; "Hapus semua filter" mengosongkan semuanya dan kembali ke halaman 1. Pagar: logika `applyFilter` tidak diubah (Task 2).
4. **Penguncian diri**: tombol Nonaktifkan tidak tampil untuk akun sendiri; di Edit, status dan peran Kasubag terkunci untuk akun sendiri dengan penjelasan; zona hapus tidak tampil. Pagar: kondisi dipertahankan persis (Task 2, 4).
5. **Izin dari role tidak bisa dicabut lewat izin khusus**: di Edit, izin bawaan role tampil tercentang dan terkunci, hanya izin tambahan yang bisa diubah; mengganti role memperbarui kunci tersebut seketika. Pagar: `isDisabled={fromRole}` dan `rolePermissionsSet` tidak diubah (Task 4).
6. **Radio cakupan "ikuti default"** bernilai kosong di server (`unit_scope_override: ''`/`null`). Pagar: peta `default` ⇄ `''` (Task 4).
7. **Kata sandi opsional**: dikosongkan = tidak diubah; hanya tampil bila `canResetPassword`; galat tampil di field. Pagar: Task 4.
8. **Form panjang** (4 bagian + matriks): bilah aksi harus tetap terjangkau dan galat harus terlihat. Pagar: bilah lengket dengan ringkasan galat (Task 4).
9. **Animasi `animate-pulse`** pada titik status Aktif dihapus (gerak tanpa fungsi dan tidak mengikuti `prefers-reduced-motion`). Perubahan disengaja (Task 2).

---

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `resources/js/Components/ConfirmDialog.tsx` | Prop `variant` (`danger`/`default`) |
| `resources/js/Pages/Users/Index.tsx` | Daftar pengguna |
| `resources/js/Pages/Users/Show.tsx` | Detail pengguna |
| `resources/js/Pages/Users/Edit.tsx` | Ubah pengguna dan hak akses |

---

### Task 1: `ConfirmDialog` mendukung konfirmasi non-destruktif

**Files:**
- Modify: `resources/js/Components/ConfirmDialog.tsx`

**Interfaces:**
- Produces: `ConfirmDialog({ title, children, confirmLabel, variant?: 'danger' | 'default', isLoading?, onConfirm, onClose })`; `variant` bawaan `'danger'` sehingga semua pemanggil lama tidak berubah.

- [ ] **Step 1: Ganti seluruh isi**

```tsx
import { Dialog, Modal, ModalOverlay } from '@/Components/ui/application/modals/modal';
import { Button } from '@/Components/ui/base/buttons/button';
import { AlertCircle, Trash01 } from '@untitledui/icons';
import { ReactNode } from 'react';

export default function ConfirmDialog({
    title,
    children,
    confirmLabel,
    variant = 'danger',
    isLoading = false,
    onConfirm,
    onClose,
}: {
    title: string;
    children: ReactNode;
    confirmLabel: string;
    variant?: 'danger' | 'default';
    isLoading?: boolean;
    onConfirm: () => void;
    onClose: () => void;
}) {
    const danger = variant === 'danger';
    const Icon = danger ? Trash01 : AlertCircle;

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
                            <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                                    danger ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-700'
                                }`}
                            >
                                <Icon className="size-5" aria-hidden="true" />
                            </div>
                            <div>
                                <h3 id="confirm-dialog-title" className="text-base font-bold text-slate-900">
                                    {title}
                                </h3>
                                {danger && <p className="text-xs text-slate-500">Tindakan ini tidak dapat dibatalkan.</p>}
                            </div>
                        </div>
                        <div className="mb-6 text-sm text-slate-600">{children}</div>
                        <div className="flex items-center justify-end gap-3">
                            <Button color="secondary" size="md" isDisabled={isLoading} onPress={onClose}>
                                Batal
                            </Button>
                            <Button color={danger ? 'primary-destructive' : 'primary'} size="md" isLoading={isLoading} onPress={onConfirm}>
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

- [ ] **Step 2: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
git add resources/js/Components/ConfirmDialog.tsx
git commit -m "feat(ui): let ConfirmDialog confirm non-destructive actions"
```
Expected: bersih (pemanggil lama memakai `variant` bawaan `danger`).

---

### Task 2: `Index`

**Files:**
- Modify: `resources/js/Pages/Users/Index.tsx` (ganti seluruh isi)

**Interfaces:**
- Consumes: `PageHeader`, `ConfirmDialog` (Task 1), `Table`, `PaginationPageDefault`, `Input`, `Select`, `Button`, `Badge`, `BadgeWithDot`, `Tooltip`; ikon `Edit01`, `Eye`, `InfoCircle`, `SearchLg`, `UserCheck01`, `UserX01`, `Users01`, `XClose`.
- Produces: halaman dengan props Inertia sama.

- [ ] **Step 1: Tulis ulang `Index.tsx`**

```tsx
import ConfirmDialog from '@/Components/ConfirmDialog';
import PageHeader from '@/Components/PageHeader';
import { PaginationPageDefault } from '@/Components/ui/application/pagination/pagination';
import { Table } from '@/Components/ui/application/table/table';
import { Badge, BadgeWithDot } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import { Select } from '@/Components/ui/base/select/select';
import { Tooltip } from '@/Components/ui/base/tooltip/tooltip';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Edit01, Eye, InfoCircle, SearchLg, UserCheck01, UserX01, Users01, XClose } from '@untitledui/icons';
import React, { useState } from 'react';

interface UserListItem {
    id: number;
    name: string;
    email: string;
    is_active: boolean;
    foto_profile_url: string | null;
    pegawai: {
        id: number;
        nama: string;
        nip: string | null;
        jabatan: string;
    } | null;
    unit: {
        id: number;
        name: string;
    } | null;
    roles: {
        id: number;
        name: string;
        display_name: string;
    }[];
    direct_permissions_count: number;
    direct_permissions: string[];
    unit_scope_override: 'all' | 'binaan' | 'own' | null;
    created_at: string;
}

interface PaginatedUsers {
    data: UserListItem[];
    current_page: number;
    last_page: number;
    from: number | null;
    to: number | null;
    total: number;
    per_page: number;
    links: {
        url: string | null;
        label: string;
        active: boolean;
    }[];
}

interface UnitOption {
    id: number;
    name: string;
    type: string;
}

interface RoleOption {
    id: number;
    name: string;
    display_name: string;
}

interface IndexProps extends PageProps {
    users: PaginatedUsers;
    roles: RoleOption[];
    units: UnitOption[];
    filters: {
        search?: string;
        role?: string;
        unit_id?: string;
        status?: string;
    };
    can: {
        manageAccess: boolean;
        toggleStatus: boolean;
        delete: boolean;
    };
}

const ALL = '__all';

const STATUS_ITEMS = [
    { id: ALL, label: 'Semua Status' },
    { id: 'active', label: 'Aktif' },
    { id: 'inactive', label: 'Nonaktif' },
];

const ROLE_BADGE_COLOR: Record<string, 'warning' | 'blue' | 'indigo' | 'purple' | 'sky'> = {
    kasubag: 'warning',
    camat: 'blue',
    admin_kecamatan: 'indigo',
    admin_kelurahan: 'purple',
    lurah: 'sky',
};

const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
};

export default function Index({ auth, users, roles, units, filters, can }: IndexProps) {
    const [search, setSearch] = useState(filters.search || '');
    const [role, setRole] = useState(filters.role || '');
    const [unitId, setUnitId] = useState(filters.unit_id || '');
    const [status, setStatus] = useState(filters.status || '');
    const [isUpdating, setIsUpdating] = useState<number | null>(null);
    const [statusTarget, setStatusTarget] = useState<UserListItem | null>(null);

    const applyFilter = (newParams: Partial<typeof filters>) => {
        const query = {
            search: search || undefined,
            role: role || undefined,
            unit_id: unitId || undefined,
            status: status || undefined,
            ...newParams,
        };

        // Remove undefined keys
        Object.keys(query).forEach((key) => {
            if ((query as Record<string, unknown>)[key] === undefined || (query as Record<string, unknown>)[key] === '') {
                delete (query as Record<string, unknown>)[key];
            }
        });

        router.get(route('users.index'), query, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        applyFilter({ search });
    };

    const handleResetFilters = () => {
        setSearch('');
        setRole('');
        setUnitId('');
        setStatus('');
        router.get(route('users.index'), {}, { preserveState: true, preserveScroll: true });
    };

    const goToPage = (page: number) => {
        router.get(route('users.index'), { ...filters, page }, { preserveState: true, preserveScroll: true });
    };

    const confirmToggleStatus = () => {
        if (!statusTarget) return;

        setIsUpdating(statusTarget.id);
        router.patch(
            route('users.toggle-status', statusTarget.id),
            {},
            {
                preserveScroll: true,
                onFinish: () => {
                    setIsUpdating(null);
                    setStatusTarget(null);
                },
            },
        );
    };

    const hasActiveFilter = Boolean(search || role || unitId || status);

    const roleItems = [{ id: ALL, label: 'Semua Peran' }, ...roles.map((r) => ({ id: r.name, label: r.display_name }))];
    const unitItems = [{ id: ALL, label: 'Semua Unit' }, ...units.map((u) => ({ id: String(u.id), label: u.name }))];

    return (
        <AuthenticatedLayout>
            <Head title="Manajemen Pengguna - SIBIMA" />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Manajemen Pengguna' }]}
                    title="Manajemen Pengguna & Hak Akses"
                    actions={
                        <Button color="secondary" size="md" iconLeading={Users01} href={route('pegawais.index')}>
                            Buka Data Pegawai
                        </Button>
                    }
                />
                <p className="-mt-3 text-sm text-slate-500">
                    Kelola akun pengguna, penetapan peran (role), cakupan unit kerja, dan hak akses sistem.
                </p>

                {/* Info Card: Account Creation Policy */}
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 sm:p-5">
                    <div className="flex items-start gap-3.5">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-800 text-white shadow-xs">
                            <InfoCircle className="size-5" aria-hidden="true" />
                        </div>
                        <div className="flex-1 text-sm">
                            <h4 className="font-semibold text-blue-900">Integritas Akun & Data Pegawai</h4>
                            <p className="mt-0.5 leading-relaxed text-blue-800">
                                Setiap akun login di SIBIMA terhubung 1-to-1 dengan data pegawai untuk menjamin akuntabilitas tanda tangan berita acara dan
                                riwayat audit. Pembuatan akun baru dilakukan langsung dari menu{' '}
                                <Link href={route('pegawais.index')} className="font-semibold underline hover:text-blue-950">
                                    Data Pegawai
                                </Link>
                                . Di halaman ini, Anda dapat mengaktifkan/menonaktifkan akun, mengatur role, serta menambahkan hak akses khusus.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Filters Bar */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
                    <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
                        <div className="lg:col-span-2">
                            <Input
                                label="Cari Pengguna"
                                size="md"
                                icon={SearchLg}
                                placeholder="Cari nama, email, NIP..."
                                value={search}
                                onChange={setSearch}
                            />
                        </div>

                        <Select
                            label="Unit Kerja"
                            size="md"
                            items={unitItems}
                            selectedKey={unitId || ALL}
                            onSelectionChange={(key) => {
                                const value = key === ALL ? '' : String(key);
                                setUnitId(value);
                                applyFilter({ unit_id: value });
                            }}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>

                        <Select
                            label="Peran (Role)"
                            size="md"
                            items={roleItems}
                            selectedKey={role || ALL}
                            onSelectionChange={(key) => {
                                const value = key === ALL ? '' : String(key);
                                setRole(value);
                                applyFilter({ role: value });
                            }}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>

                        <div className="flex items-end gap-2">
                            <div className="flex-1">
                                <Select
                                    label="Status"
                                    size="md"
                                    items={STATUS_ITEMS}
                                    selectedKey={status || ALL}
                                    onSelectionChange={(key) => {
                                        const value = key === ALL ? '' : String(key);
                                        setStatus(value);
                                        applyFilter({ status: value });
                                    }}
                                >
                                    {(item) => <Select.Item id={item.id} label={item.label} />}
                                </Select>
                            </div>
                            {hasActiveFilter && (
                                <Tooltip title="Hapus semua filter">
                                    <Button
                                        color="secondary"
                                        size="md"
                                        iconLeading={XClose}
                                        aria-label="Hapus semua filter"
                                        onPress={handleResetFilters}
                                    />
                                </Tooltip>
                            )}
                        </div>
                    </form>
                </div>

                {/* Table Card */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    <div className="border-b border-slate-200 bg-slate-50/50 px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                        Daftar Pengguna (<span className="tabular-nums">{users.total}</span>)
                    </div>

                    <Table aria-label="Daftar pengguna">
                        <Table.Header>
                            <Table.Head id="pengguna" label="Pengguna" isRowHeader />
                            <Table.Head id="unit" label="Unit Kerja" />
                            <Table.Head id="peran" label="Peran & Cakupan" />
                            <Table.Head id="izin" label="Izin Khusus" />
                            <Table.Head id="status" label="Status" />
                            <Table.Head id="aksi" label="Aksi" />
                        </Table.Header>
                        <Table.Body
                            items={users.data}
                            renderEmptyState={() => (
                                <div className="flex flex-col items-center gap-2 py-12 text-center">
                                    <p className="font-medium text-slate-600">Tidak ada pengguna ditemukan</p>
                                    <p className="text-xs text-slate-400">Coba sesuaikan kata kunci pencarian atau filter yang dipilih.</p>
                                    {hasActiveFilter && (
                                        <Button color="secondary" size="sm" className="mt-2" onPress={handleResetFilters}>
                                            Hapus semua filter
                                        </Button>
                                    )}
                                </div>
                            )}
                        >
                            {(user) => (
                                <Table.Row id={user.id}>
                                    <Table.Cell>
                                        <div className="flex items-center gap-3">
                                            {user.foto_profile_url ? (
                                                <img
                                                    src={user.foto_profile_url}
                                                    alt=""
                                                    className="size-10 shrink-0 rounded-full border border-slate-200 object-cover"
                                                />
                                            ) : (
                                                <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-100 text-xs font-bold text-blue-700">
                                                    {getInitials(user.name)}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <Link
                                                        href={route('users.show', user.id)}
                                                        className="truncate font-semibold text-slate-900 hover:text-blue-700"
                                                    >
                                                        {user.name}
                                                    </Link>
                                                    {user.id === auth.user?.id && (
                                                        <Badge type="color" size="sm" color="brand" className="rounded-sm">
                                                            Anda
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="truncate text-xs text-slate-500">{user.email}</p>
                                                {user.pegawai && (
                                                    <p className="mt-0.5 truncate text-[11px] tabular-nums text-slate-400">
                                                        {user.pegawai.nip ? `NIP: ${user.pegawai.nip}` : user.pegawai.jabatan}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </Table.Cell>
                                    <Table.Cell className="whitespace-nowrap">
                                        <Badge type="color" size="sm" color="gray" className="rounded-sm">
                                            {user.unit?.name ?? 'Tidak Terikat Unit'}
                                        </Badge>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {user.roles.length > 0 ? (
                                                user.roles.map((r) => (
                                                    <Badge key={r.id} type="color" size="sm" color={ROLE_BADGE_COLOR[r.name] ?? 'gray'} className="rounded-sm">
                                                        {r.display_name}
                                                    </Badge>
                                                ))
                                            ) : (
                                                <span className="text-xs italic text-slate-400">Belum ada role</span>
                                            )}
                                            {user.unit_scope_override && (
                                                <Badge type="color" size="sm" color="purple" className="rounded-sm">
                                                    Scope: {user.unit_scope_override}
                                                </Badge>
                                            )}
                                        </div>
                                    </Table.Cell>
                                    <Table.Cell className="whitespace-nowrap">
                                        {user.direct_permissions_count > 0 ? (
                                            <Badge type="color" size="sm" color="success" className="rounded-sm tabular-nums">
                                                +{user.direct_permissions_count} Khusus
                                            </Badge>
                                        ) : (
                                            <span className="text-xs text-slate-400">Dari role</span>
                                        )}
                                    </Table.Cell>
                                    <Table.Cell className="whitespace-nowrap">
                                        <BadgeWithDot type="color" size="sm" color={user.is_active ? 'success' : 'error'} className="rounded-sm">
                                            {user.is_active ? 'Aktif' : 'Nonaktif'}
                                        </BadgeWithDot>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <div className="flex items-center gap-1.5">
                                            <Tooltip title="Lihat Detail Profil & Hak Akses">
                                                <Button
                                                    color="secondary-brand"
                                                    size="sm"
                                                    iconLeading={Eye}
                                                    aria-label={`Lihat detail ${user.name}`}
                                                    href={route('users.show', user.id)}
                                                />
                                            </Tooltip>
                                            {can.manageAccess && (
                                                <Tooltip title="Edit Hak Akses & Peran">
                                                    <Button
                                                        color="secondary-green"
                                                        size="sm"
                                                        iconLeading={Edit01}
                                                        aria-label={`Edit hak akses ${user.name}`}
                                                        href={route('users.edit', user.id)}
                                                    />
                                                </Tooltip>
                                            )}
                                            {can.toggleStatus && user.id !== auth.user?.id && (
                                                <Tooltip title={user.is_active ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}>
                                                    <Button
                                                        color={user.is_active ? 'secondary-destructive' : 'secondary'}
                                                        size="sm"
                                                        iconLeading={user.is_active ? UserX01 : UserCheck01}
                                                        aria-label={`${user.is_active ? 'Nonaktifkan' : 'Aktifkan'} akun ${user.name}`}
                                                        isDisabled={isUpdating === user.id}
                                                        onPress={() => setStatusTarget(user)}
                                                    />
                                                </Tooltip>
                                            )}
                                        </div>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                        </Table.Body>
                    </Table>

                    {/* Pagination */}
                    {users.total > users.per_page && (
                        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4">
                            <p className="text-xs text-slate-500">
                                Menampilkan <span className="font-semibold tabular-nums text-slate-700">{users.from ?? 0}</span> sampai{' '}
                                <span className="font-semibold tabular-nums text-slate-700">{users.to ?? 0}</span> dari{' '}
                                <span className="font-semibold tabular-nums text-slate-700">{users.total}</span> pengguna
                            </p>
                            <PaginationPageDefault
                                className="border-t-0 pt-0 md:pt-0"
                                page={users.current_page}
                                total={users.last_page}
                                onPageChange={goToPage}
                            />
                        </div>
                    )}
                </div>
            </div>

            {statusTarget && (
                <ConfirmDialog
                    variant="default"
                    title={statusTarget.is_active ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                    confirmLabel={statusTarget.is_active ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan'}
                    isLoading={isUpdating === statusTarget.id}
                    onConfirm={confirmToggleStatus}
                    onClose={() => setStatusTarget(null)}
                >
                    Apakah Anda yakin ingin {statusTarget.is_active ? 'menonaktifkan' : 'mengaktifkan'} akun{' '}
                    <strong className="text-slate-900">&quot;{statusTarget.name}&quot;</strong> ({statusTarget.email})?
                    {statusTarget.is_active && ' Pengguna tidak dapat masuk dan sesi yang sedang berjalan akan langsung diputus.'}
                </ConfirmDialog>
            )}
        </AuthenticatedLayout>
    );
}
```
Prop yang berbeda dari yang diasumsikan (`Badge color="blue"|"indigo"|"sky"`, `Select label`, ikon `UserX01`/`UserCheck01`/`InfoCircle`) disesuaikan dan dicatat sebagai `Ruling`.

- [ ] **Step 2: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
grep -n "window.confirm\|alert(\|dangerouslySetInnerHTML" resources/js/Pages/Users/Index.tsx
php artisan test --compact --filter='User'
git add resources/js/Pages/Users/Index.tsx
git commit -m "feat(ui): migrate the user list page to Untitled UI components"
```
Expected: bersih; `grep` kosong; test hijau.

---

### Task 3: `Show`

**Files:**
- Modify: `resources/js/Pages/Users/Show.tsx` (ganti seluruh isi)

**Interfaces:**
- Consumes: `PageHeader` (dengan `badges`), `Button`, `Badge`, `BadgeWithDot`, `Input`; ikon `ArrowLeft`, `Check`, `Edit01`, `SearchLg`, `Shield01`, `Users01`.
- Produces: halaman dengan props Inertia sama.

- [ ] **Step 1: Tulis ulang `Show.tsx`**

```tsx
import PageHeader from '@/Components/PageHeader';
import { Badge, BadgeWithDot } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Check, Edit01, SearchLg, Shield01, Users01 } from '@untitledui/icons';
import { ReactNode, useMemo, useState } from 'react';

interface UserDetail {
    id: number;
    name: string;
    email: string;
    is_active: boolean;
    foto_profile_url: string | null;
    unit_id: number | null;
    unit: {
        id: number;
        name: string;
    } | null;
    pegawai: {
        id: number;
        nama: string;
        nip: string | null;
        jabatan: string;
        no_hp: string | null;
        unit_nama?: string;
    } | null;
    roles: {
        id: number;
        name: string;
        display_name: string;
        unit_scope: string;
        description: string | null;
    }[];
    direct_permissions: string[];
    unit_scope_override: 'all' | 'binaan' | 'own' | null;
    created_at: string;
}

interface ShowProps extends PageProps {
    user: UserDetail;
    effectivePermissions: Record<string, string[]>;
    can: {
        manageAccess: boolean;
        toggleStatus: boolean;
        delete: boolean;
    };
}

const SCOPE_INFO: Record<string, { label: string; color: 'blue' | 'purple' | 'success' }> = {
    all: { label: 'Semua Unit Kerja (Kecamatan & Seluruh Kelurahan)', color: 'blue' },
    binaan: { label: 'Kecamatan & Kelurahan Binaan', color: 'purple' },
    own: { label: 'Unit Kerja Sendiri Saja', color: 'success' },
};

const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
};

function InfoLine({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex justify-between gap-3">
            <span className="text-slate-500">{label}</span>
            <span className="text-right font-medium text-slate-800">{children}</span>
        </div>
    );
}

export default function Show({ auth, user, effectivePermissions, can }: ShowProps) {
    const [permSearch, setPermSearch] = useState('');

    const directPermsSet = useMemo(() => {
        return new Set(user.direct_permissions || []);
    }, [user.direct_permissions]);

    const primaryRole = user.roles[0];

    const effectiveScope = user.unit_scope_override || primaryRole?.unit_scope || 'own';
    const scopeInfo = SCOPE_INFO[effectiveScope] ?? SCOPE_INFO.own;

    // Total count of permissions
    const totalEffectivePerms = useMemo(() => {
        return Object.values(effectivePermissions).reduce((acc, perms) => acc + perms.length, 0);
    }, [effectivePermissions]);

    // Filter permissions by search
    const filteredModules = useMemo(() => {
        if (!permSearch) return effectivePermissions;

        const query = permSearch.toLowerCase();
        const result: Record<string, string[]> = {};

        Object.entries(effectivePermissions).forEach(([moduleName, perms]) => {
            const matchesModule = moduleName.toLowerCase().includes(query);
            const matchingPerms = perms.filter((p) => p.toLowerCase().includes(query));

            if (matchesModule) {
                result[moduleName] = perms;
            } else if (matchingPerms.length > 0) {
                result[moduleName] = matchingPerms;
            }
        });

        return result;
    }, [effectivePermissions, permSearch]);

    return (
        <AuthenticatedLayout>
            <Head title={`Detail Pengguna - ${user.name}`} />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Manajemen Pengguna', href: route('users.index') }, { label: user.name }]}
                    title={user.name}
                    badges={
                        <>
                            <BadgeWithDot type="color" size="sm" color={user.is_active ? 'success' : 'error'} className="rounded-sm">
                                {user.is_active ? 'Akun Aktif' : 'Akun Dinonaktifkan'}
                            </BadgeWithDot>
                            {user.id === auth.user?.id && (
                                <Badge type="color" size="sm" color="brand" className="rounded-sm">
                                    Akun Anda
                                </Badge>
                            )}
                        </>
                    }
                    actions={
                        <>
                            <Button color="secondary" size="md" iconLeading={ArrowLeft} href={route('users.index')}>
                                Kembali
                            </Button>
                            {can.manageAccess && (
                                <Button color="secondary-green" size="md" iconLeading={Edit01} href={route('users.edit', user.id)}>
                                    Edit Hak Akses
                                </Button>
                            )}
                        </>
                    }
                />

                {/* Top Info Cards Grid */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    {/* Card 1: Identitas Akun */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                        <div className="flex items-center gap-4">
                            {user.foto_profile_url ? (
                                <img
                                    src={user.foto_profile_url}
                                    alt={user.name}
                                    className="size-16 shrink-0 rounded-full border-2 border-slate-200 object-cover"
                                />
                            ) : (
                                <div className="flex size-16 shrink-0 items-center justify-center rounded-full border-2 border-blue-200 bg-blue-100 text-lg font-bold text-blue-700">
                                    {getInitials(user.name)}
                                </div>
                            )}
                            <div className="min-w-0">
                                <h3 className="truncate text-base font-bold text-slate-900">{user.name}</h3>
                                <p className="mt-0.5 truncate text-xs text-slate-500">{user.email}</p>
                                <Badge type="color" size="sm" color="gray" className="mt-2 rounded-sm">
                                    {user.unit?.name ?? 'Unit tidak ditetapkan'}
                                </Badge>
                            </div>
                        </div>

                        <div className="mt-5 space-y-2.5 border-t border-slate-100 pt-4 text-xs">
                            <InfoLine label="ID Pengguna">
                                <span className="font-semibold tabular-nums">#{user.id}</span>
                            </InfoLine>
                            <InfoLine label="Terdaftar Pada">{user.created_at}</InfoLine>
                            <InfoLine label="Foto Profil">{user.foto_profile_url ? 'Dari Data Pegawai' : 'Inisial Standar'}</InfoLine>
                        </div>
                    </div>

                    {/* Card 2: Kaitan Data Pegawai */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                                    <Users01 className="size-4" aria-hidden="true" />
                                </div>
                                <h3 className="text-sm font-bold text-slate-900">Data Pegawai Terkait</h3>
                            </div>
                            {user.pegawai && (
                                <Link href={route('pegawais.show', user.pegawai.id)} className="text-xs font-semibold text-blue-700 hover:text-blue-900">
                                    Lihat Pegawai &rarr;
                                </Link>
                            )}
                        </div>

                        {user.pegawai ? (
                            <div className="mt-4 space-y-2.5 text-xs">
                                <div>
                                    <span className="block text-[11px] text-slate-400">Nama Lengkap Pegawai</span>
                                    <span className="text-sm font-semibold text-slate-800">{user.pegawai.nama}</span>
                                </div>
                                <InfoLine label="NIP">
                                    <span className="tabular-nums">{user.pegawai.nip || '-'}</span>
                                </InfoLine>
                                <InfoLine label="Jabatan">{user.pegawai.jabatan}</InfoLine>
                                <InfoLine label="Unit Kerja">{user.pegawai.unit_nama || '-'}</InfoLine>
                                <InfoLine label="No. Telepon / HP">{user.pegawai.no_hp || '-'}</InfoLine>
                            </div>
                        ) : (
                            <div className="mt-6 py-4 text-center text-xs text-slate-400">
                                Tidak ada data pegawai yang terhubung langsung dengan akun ini.
                            </div>
                        )}
                    </div>

                    {/* Card 3: Peran & Cakupan Wilayah */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                            <div className="flex size-7 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                                <Shield01 className="size-4" aria-hidden="true" />
                            </div>
                            <h3 className="text-sm font-bold text-slate-900">Peran & Cakupan Wilayah</h3>
                        </div>

                        <div className="mt-4 space-y-3.5 text-xs">
                            <div>
                                <span className="mb-1 block text-[11px] text-slate-400">Peran Utama (Role)</span>
                                {primaryRole ? (
                                    <div>
                                        <Badge type="color" size="md" color="blue" className="rounded-sm font-bold">
                                            {primaryRole.display_name}
                                        </Badge>
                                        {primaryRole.description && (
                                            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{primaryRole.description}</p>
                                        )}
                                    </div>
                                ) : (
                                    <span className="italic text-slate-400">Belum ada peran yang ditetapkan</span>
                                )}
                            </div>

                            <div>
                                <span className="mb-1 block text-[11px] text-slate-400">Cakupan Wilayah Data (Unit Scope)</span>
                                <Badge type="color" size="md" color={scopeInfo.color} className="rounded-sm">
                                    {scopeInfo.label}
                                </Badge>
                                {user.unit_scope_override && (
                                    <p className="mt-1 text-[11px] text-purple-700">* Diatur khusus (override) berbeda dari default peran.</p>
                                )}
                            </div>

                            <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                                <span className="text-slate-500">Total Izin Efektif</span>
                                <span className="text-sm font-bold tabular-nums text-slate-800">{totalEffectivePerms} Izin</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Section: Matriks Hak Akses Efektif */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-base font-bold text-slate-900">Matriks Hak Akses Efektif (Effective Permissions)</h2>
                            <p className="mt-0.5 text-xs text-slate-500">
                                Daftar seluruh izin yang dimiliki pengguna, baik yang diwarisi dari Role maupun diberikan sebagai Izin Khusus.
                            </p>
                        </div>

                        <div className="w-full sm:w-64">
                            <Input
                                aria-label="Cari izin atau modul"
                                size="sm"
                                icon={SearchLg}
                                placeholder="Cari izin atau modul..."
                                value={permSearch}
                                onChange={setPermSearch}
                            />
                        </div>
                    </div>

                    <div className="p-5">
                        {Object.keys(filteredModules).length === 0 ? (
                            <div className="py-10 text-center text-slate-400">
                                <p className="text-sm font-medium">Tidak ada izin yang sesuai dengan pencarian.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {Object.entries(filteredModules).map(([moduleName, perms]) => (
                                    <div key={moduleName} className="rounded-lg border border-slate-200 bg-slate-50/30 p-4">
                                        <div className="mb-3 flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">{moduleName}</h4>
                                            <Badge type="color" size="sm" color="gray" className="rounded-sm tabular-nums">
                                                {perms.length}
                                            </Badge>
                                        </div>

                                        <ul className="space-y-2">
                                            {perms.map((perm) => (
                                                <li
                                                    key={perm}
                                                    className="flex items-center justify-between gap-2 rounded-md border border-slate-100 bg-white p-2 text-xs shadow-xs"
                                                >
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                                                            <Check className="size-2.5" strokeWidth={3} aria-hidden="true" />
                                                        </span>
                                                        <span className="truncate font-mono text-[11px] text-slate-700" title={perm}>
                                                            {perm}
                                                        </span>
                                                    </div>
                                                    <Badge
                                                        type="color"
                                                        size="sm"
                                                        color={directPermsSet.has(perm) ? 'success' : 'blue'}
                                                        className="shrink-0 rounded-sm"
                                                    >
                                                        {directPermsSet.has(perm) ? 'Izin Khusus' : 'Dari Role'}
                                                    </Badge>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
```
Catatan: tautan "Lihat Pegawai" diarahkan ke `pegawais.show` milik pegawai terkait (sebelumnya ke daftar pegawai `pegawais.index`); itu perbaikan kecil yang disengaja karena data pegawai sudah ada di halaman ini. Bila `route('pegawais.show')` ternyata tidak menerima id pegawai, kembalikan ke `pegawais.index` dan catat sebagai `Ruling`.

- [ ] **Step 2: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
php artisan test --compact --filter='User'
git add resources/js/Pages/Users/Show.tsx
git commit -m "feat(ui): migrate the user detail page to Untitled UI components"
```
Expected: bersih; test hijau.

---

### Task 4: `Edit`

**Files:**
- Modify: `resources/js/Pages/Users/Edit.tsx` (ganti seluruh isi)

**Interfaces:**
- Consumes: `PageHeader`, `ConfirmDialog` (Task 1), `Toggle` (`@/Components/ui/base/toggle/toggle`), `Input`, `Select`, `Label`, `RadioGroup`/`RadioButton`, `Checkbox`, `Badge`, `Button`; ikon `SearchLg`, `Trash01`.
- Produces: halaman dengan props Inertia sama.

- [ ] **Step 1: Tulis ulang `Edit.tsx`**

```tsx
import ConfirmDialog from '@/Components/ConfirmDialog';
import PageHeader from '@/Components/PageHeader';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { Checkbox } from '@/Components/ui/base/checkbox/checkbox';
import { Input } from '@/Components/ui/base/input/input';
import { Label } from '@/Components/ui/base/input/label';
import { RadioButton, RadioGroup } from '@/Components/ui/base/radio-buttons/radio-buttons';
import { Select } from '@/Components/ui/base/select/select';
import { Toggle } from '@/Components/ui/base/toggle/toggle';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { SearchLg, Trash01 } from '@untitledui/icons';
import React, { useMemo, useState } from 'react';

interface RoleOption {
    id: number;
    name: string;
    display_name: string;
    unit_scope: string;
    permissions: string[];
}

interface UserEditData {
    id: number;
    name: string;
    email: string;
    is_active: boolean;
    foto_profile_url: string | null;
    role: string;
    direct_permissions: string[];
    unit_scope_override: 'all' | 'binaan' | 'own' | null;
    pegawai: {
        id: number;
        nama: string;
        nip: string | null;
        jabatan: string;
    } | null;
    unit: {
        id: number;
        name: string;
    } | null;
}

interface EditProps extends PageProps {
    user: UserEditData;
    roles: RoleOption[];
    permissionGroups: Record<string, string[]>;
    units: { id: number; name: string; type: string }[];
    canResetPassword: boolean;
}

const DEFAULT_SCOPE = 'default';

const SCOPE_CHOICES: { value: string; label: string; hint: string }[] = [
    { value: 'all', label: 'Semua Unit (Kecamatan & Seluruh Kelurahan)', hint: 'Akses lintas seluruh unit kerja di wilayah Sagulung.' },
    { value: 'binaan', label: 'Kecamatan & Kelurahan Binaan', hint: 'Khusus pimpinan kecamatan untuk memantau kelurahan bawahannya.' },
    { value: 'own', label: 'Unit Sendiri Saja', hint: 'Terbatas pada data unit kerja pegawai yang bersangkutan.' },
];

function SectionTitle({ number, children }: { number: number; children: string }) {
    return (
        <h3 className="mb-4 border-b border-slate-100 pb-3 text-base font-bold text-slate-900">
            {number}. {children}
        </h3>
    );
}

export default function Edit({ auth, user, roles, permissionGroups, canResetPassword }: EditProps) {
    const [permSearch, setPermSearch] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    const { data, setData, put, processing, errors } = useForm({
        email: user.email,
        password: '',
        password_confirmation: '',
        is_active: user.is_active,
        role: user.role || (roles[0]?.name ?? ''),
        direct_permissions: user.direct_permissions || [],
        unit_scope_override: user.unit_scope_override || '',
    });

    const isSelf = user.id === auth.user?.id;
    const roleLocked = isSelf && user.role === 'kasubag';
    const errorCount = Object.keys(errors).length;

    // Active role object
    const selectedRole = useMemo(() => {
        return roles.find((r) => r.name === data.role) || roles[0];
    }, [roles, data.role]);

    // Permissions belonging to the selected role
    const rolePermissionsSet = useMemo(() => {
        return new Set(selectedRole?.permissions || []);
    }, [selectedRole]);

    const handlePermissionToggle = (perm: string) => {
        // If this permission is already in the selected role, don't toggle
        if (rolePermissionsSet.has(perm)) return;

        const current = [...data.direct_permissions];
        const index = current.indexOf(perm);
        if (index > -1) {
            current.splice(index, 1);
        } else {
            current.push(perm);
        }
        setData('direct_permissions', current);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put(route('users.update', user.id), {
            preserveScroll: true,
        });
    };

    const handleDeleteAccount = () => {
        setIsDeleting(true);
        router.delete(route('users.destroy', user.id), {
            preserveScroll: true,
            onFinish: () => {
                setIsDeleting(false);
                setConfirmingDelete(false);
            },
        });
    };

    // Filtered permission groups
    const filteredGroups = useMemo(() => {
        if (!permSearch) return permissionGroups;
        const query = permSearch.toLowerCase();
        const result: Record<string, string[]> = {};

        Object.entries(permissionGroups).forEach(([groupName, perms]) => {
            const matchesGroup = groupName.toLowerCase().includes(query);
            const matchesPerms = perms.filter((p) => p.toLowerCase().includes(query));

            if (matchesGroup) {
                result[groupName] = perms;
            } else if (matchesPerms.length > 0) {
                result[groupName] = matchesPerms;
            }
        });

        return result;
    }, [permissionGroups, permSearch]);

    return (
        <AuthenticatedLayout>
            <Head title={`Edit Pengguna - ${user.name}`} />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[
                        { label: 'Manajemen Pengguna', href: route('users.index') },
                        { label: user.name, href: route('users.show', user.id) },
                        { label: 'Edit Akses' },
                    ]}
                    title="Edit Pengguna & Hak Akses"
                />
                <p className="-mt-3 text-sm text-slate-500">
                    Atur peran (role), status akun, kata sandi, cakupan wilayah, dan hak akses khusus untuk{' '}
                    <span className="font-semibold text-slate-800">{user.name}</span>.
                </p>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Section 1: Profil Pegawai (Read-only) & Pengaturan Akun */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
                        <SectionTitle number={1}>Identitas Akun & Status Login</SectionTitle>

                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                                <div className="flex items-center gap-3">
                                    {user.foto_profile_url ? (
                                        <img src={user.foto_profile_url} alt={user.name} className="size-12 rounded-full border border-slate-200 object-cover" />
                                    ) : (
                                        <div className="flex size-12 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                                            {user.name.slice(0, 2).toUpperCase()}
                                        </div>
                                    )}
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-900">{user.name}</h4>
                                        <p className="text-xs tabular-nums text-slate-500">
                                            {user.pegawai?.nip ? `NIP: ${user.pegawai.nip}` : 'Pegawai SIBIMA'}
                                        </p>
                                        <p className="mt-0.5 text-xs text-slate-500">
                                            {user.pegawai?.jabatan || 'Jabatan belum diisi'} • {user.unit?.name ?? 'Kecamatan Sagulung'}
                                        </p>
                                    </div>
                                </div>
                                <p className="mt-3 border-t border-slate-200/60 pt-2 text-[11px] text-slate-400">
                                    * Nama dan jabatan pegawai terikat ke modul Data Pegawai untuk menjaga akuntabilitas dokumen.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <Input
                                    label="Email Login"
                                    type="email"
                                    isRequired
                                    value={data.email}
                                    onChange={(v) => setData('email', v)}
                                    isInvalid={Boolean(errors.email)}
                                    hint={errors.email}
                                />

                                <div className="rounded-lg border border-slate-200 bg-white p-3.5">
                                    <Toggle
                                        label="Status Aktif Akun"
                                        isSelected={data.is_active}
                                        isDisabled={isSelf}
                                        onChange={(v) => setData('is_active', v)}
                                        hint={
                                            <span className="text-xs leading-relaxed text-slate-500">
                                                Jika dinonaktifkan, pengguna tidak dapat masuk ke sistem. Sesi yang sedang berjalan akan langsung diputus.
                                                {isSelf && (
                                                    <span className="mt-1 block text-[11px] font-semibold text-amber-600">
                                                        (Anda tidak dapat menonaktifkan akun sendiri)
                                                    </span>
                                                )}
                                            </span>
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Reset Kata Sandi (Opsional) */}
                    {canResetPassword && (
                        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
                            <SectionTitle number={2}>Atur Ulang Kata Sandi (Opsional)</SectionTitle>
                            <p className="-mt-2 mb-4 text-xs text-slate-500">
                                Biarkan kolom kata sandi kosong jika tidak ingin mengubah kata sandi pengguna ini.
                            </p>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Input
                                    label="Kata Sandi Baru"
                                    type="password"
                                    autoComplete="new-password"
                                    placeholder="Minimal 8 karakter..."
                                    value={data.password}
                                    onChange={(v) => setData('password', v)}
                                    isInvalid={Boolean(errors.password)}
                                    hint={errors.password}
                                />
                                <Input
                                    label="Konfirmasi Kata Sandi Baru"
                                    type="password"
                                    autoComplete="new-password"
                                    placeholder="Ulangi kata sandi baru..."
                                    value={data.password_confirmation}
                                    onChange={(v) => setData('password_confirmation', v)}
                                />
                            </div>
                        </div>
                    )}

                    {/* Section 3: Penetapan Role & Scope */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
                        <SectionTitle number={3}>Peran Sistem (Role) & Cakupan Wilayah Data</SectionTitle>

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <div className="space-y-3.5">
                                <Select
                                    label="Pilih Peran (Role)"
                                    isRequired
                                    isDisabled={roleLocked}
                                    items={roles.map((r) => ({ id: r.name, label: `${r.display_name} (${r.name})` }))}
                                    selectedKey={data.role}
                                    onSelectionChange={(key) => setData('role', String(key))}
                                    isInvalid={Boolean(errors.role)}
                                    hint={errors.role ?? (roleLocked ? '* Anda tidak dapat mencabut peran Kasubag dari akun Anda sendiri.' : undefined)}
                                >
                                    {(item) => <Select.Item id={item.id} label={item.label} />}
                                </Select>

                                {selectedRole && (
                                    <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3.5 text-xs">
                                        <span className="block font-semibold text-blue-900">Hak Bawaan Peran: {selectedRole.display_name}</span>
                                        <p className="mt-0.5 text-[11px] leading-relaxed text-blue-800">
                                            Default Cakupan Wilayah: <span className="font-semibold">{selectedRole.unit_scope}</span>. Membawa{' '}
                                            <span className="font-semibold tabular-nums">{selectedRole.permissions.length} izin standar</span> yang otomatis aktif di
                                            bawah.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <RadioGroup
                                className="gap-2"
                                value={data.unit_scope_override || DEFAULT_SCOPE}
                                onChange={(v) => setData('unit_scope_override', v === DEFAULT_SCOPE ? '' : (v as 'all' | 'binaan' | 'own'))}
                            >
                                <Label>Cakupan Wilayah Data (Unit Scope Override)</Label>
                                <div className="space-y-2">
                                    <RadioButton
                                        value={DEFAULT_SCOPE}
                                        label={`Ikuti Default Peran (${selectedRole?.unit_scope})`}
                                        hint="Menggunakan cakupan bawaan dari peran yang dipilih."
                                        className="rounded-lg border border-slate-200 p-2.5 hover:bg-slate-50 data-selected:border-blue-600 data-selected:bg-blue-50/40"
                                    />
                                    {SCOPE_CHOICES.map((choice) => (
                                        <RadioButton
                                            key={choice.value}
                                            value={choice.value}
                                            label={choice.label}
                                            hint={choice.hint}
                                            className="rounded-lg border border-slate-200 p-2.5 hover:bg-slate-50 data-selected:border-blue-600 data-selected:bg-blue-50/40"
                                        />
                                    ))}
                                </div>
                            </RadioGroup>
                        </div>
                    </div>

                    {/* Section 4: Matriks Hak Akses Khusus */}
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h3 className="text-base font-bold text-slate-900">4. Matriks Izin Khusus (Direct Permission Overrides)</h3>
                                <p className="mt-0.5 text-xs text-slate-500">
                                    Izin yang telah dimiliki dari peran{' '}
                                    <span className="font-semibold text-blue-700">({selectedRole?.display_name})</span> ditandai aktif otomatis. Anda dapat
                                    mencentang izin tambahan untuk memberikan hak akses istimewa.
                                </p>
                            </div>

                            <div className="w-full sm:w-64">
                                <Input
                                    aria-label="Filter izin atau modul"
                                    size="sm"
                                    icon={SearchLg}
                                    placeholder="Filter izin atau modul..."
                                    value={permSearch}
                                    onChange={setPermSearch}
                                />
                            </div>
                        </div>

                        <div className="p-5">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {Object.entries(filteredGroups).map(([groupName, perms]) => (
                                    <div key={groupName} className="rounded-lg border border-slate-200 bg-slate-50/30 p-4">
                                        <div className="mb-3 flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">{groupName}</h4>
                                            <Badge type="color" size="sm" color="gray" className="rounded-sm tabular-nums">
                                                {perms.length}
                                            </Badge>
                                        </div>

                                        <div className="space-y-2">
                                            {perms.map((perm) => {
                                                const fromRole = rolePermissionsSet.has(perm);
                                                const isDirect = data.direct_permissions.includes(perm);

                                                return (
                                                    <Checkbox
                                                        key={perm}
                                                        isSelected={fromRole || isDirect}
                                                        isDisabled={fromRole}
                                                        onChange={() => handlePermissionToggle(perm)}
                                                        className={`w-full rounded-md border p-2 text-xs transition ${
                                                            fromRole
                                                                ? 'border-blue-100 bg-blue-50/50'
                                                                : isDirect
                                                                  ? 'border-emerald-200 bg-emerald-50/60'
                                                                  : 'border-slate-100 bg-white hover:border-slate-200'
                                                        }`}
                                                        label={
                                                            <span className="flex items-center justify-between gap-2">
                                                                <span className="truncate font-mono text-[11px]" title={perm}>
                                                                    {perm}
                                                                </span>
                                                                {fromRole && (
                                                                    <Badge type="color" size="sm" color="blue" className="shrink-0 rounded-sm">
                                                                        Dari Role
                                                                    </Badge>
                                                                )}
                                                                {!fromRole && isDirect && (
                                                                    <Badge type="color" size="sm" color="success" className="shrink-0 rounded-sm">
                                                                        Izin Khusus
                                                                    </Badge>
                                                                )}
                                                            </span>
                                                        }
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
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
                                        <span className="font-semibold tabular-nums text-slate-900">{data.direct_permissions.length}</span> izin khusus dipilih
                                    </>
                                )}
                            </p>
                            <div className="flex items-center gap-3">
                                <Button color="secondary" size="md" href={route('users.show', user.id)}>
                                    Batal
                                </Button>
                                <Button color="primary" size="md" type="submit" isLoading={processing}>
                                    Simpan Perubahan
                                </Button>
                            </div>
                        </div>
                    </div>
                </form>

                {/* Danger Zone: Hapus Akun Login */}
                {!isSelf && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-5 shadow-xs">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h4 className="flex items-center gap-2 text-sm font-bold text-rose-900">
                                    <Trash01 className="size-4 text-rose-600" aria-hidden="true" />
                                    Zona Berbahaya: Hapus Kredensial Login
                                </h4>
                                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-rose-800">
                                    Menghapus akun login pengguna ini dari sistem secara permanen. Data pegawai yang terhubung tidak akan terhapus. Jika
                                    pengguna memiliki riwayat tanda tangan persetujuan audit (approval actions), penghapusan akan dicegah secara otomatis demi
                                    keamanan audit trail.
                                </p>
                            </div>

                            <Button color="secondary-destructive" size="md" iconLeading={Trash01} className="shrink-0" onPress={() => setConfirmingDelete(true)}>
                                Hapus Akun Login
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {confirmingDelete && (
                <ConfirmDialog
                    title="Hapus Akun Login"
                    confirmLabel="Ya, Hapus Akun"
                    isLoading={isDeleting}
                    onConfirm={handleDeleteAccount}
                    onClose={() => setConfirmingDelete(false)}
                >
                    <p>
                        Apakah Anda yakin ingin menghapus akun login untuk{' '}
                        <strong className="text-slate-900">&quot;{user.name}&quot;</strong> ({user.email})?
                    </p>
                    <p className="mt-2">
                        Akun login akan dihapus, namun data pegawai tetap tersimpan. Jika akun ini memiliki riwayat persetujuan, penghapusan akan ditolak oleh
                        sistem untuk melindungi riwayat audit.
                    </p>
                </ConfirmDialog>
            )}
        </AuthenticatedLayout>
    );
}
```
Prop yang berbeda dari yang diasumsikan (`Toggle hint` bertipe ReactNode, `Checkbox label` bertipe ReactNode, `RadioGroup isInvalid`, `Select` tanpa `hint` bernilai `undefined`) disesuaikan dan dicatat sebagai `Ruling`.

- [ ] **Step 2: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
grep -n "window.confirm\|alert(" resources/js/Pages/Users/Edit.tsx
php artisan test --compact --filter='User'
git add resources/js/Pages/Users/Edit.tsx
git commit -m "feat(ui): migrate the user edit page to Untitled UI components"
```
Expected: bersih; `grep` kosong; test hijau.

- [ ] **Step 3: Cek runtime singkat dan GERBANG PENGGUNA — berhenti**

Cek di browser headless (super-admin): daftar (filter, pagination bila ada), detail, edit (izin dari role terkunci, mengganti role memperbarui kunci, kirim dengan email kosong untuk galat) tanpa menyimpan perubahan permanen.

Laporkan hasil Task 1–4, `Ruling`, dan hal yang tak bisa diverifikasi tanpa browser pengguna. Minta pengguna memeriksa:
- **Daftar**: filter Unit/Peran/Status menerapkan langsung, pencarian dengan Enter, "Hapus semua filter"; badge peran berwarna; tombol Detail (biru muda), Edit (hijau), Nonaktifkan (merah)/Aktifkan dengan tooltip; dialog konfirmasi aktif/nonaktif (tanpa kalimat "tidak dapat dibatalkan", Esc menutup); tombol tidak tampil untuk akun sendiri; pagination mempertahankan filter.
- **Detail**: badge status di samping judul, tiga kartu, tautan "Lihat Pegawai" ke detail pegawai, pencarian izin efektif, label "Izin Khusus" vs "Dari Role".
- **Ubah**: status aktif (Toggle) terkunci untuk akun sendiri; peran Kasubag terkunci untuk akun sendiri; mengganti peran memperbarui hitungan izin standar dan mengunci izin bawaan; radio cakupan (termasuk "Ikuti Default Peran" lalu simpan: server menerima kosong); kata sandi opsional (kosong tidak mengubah, galat per field); filter izin; bilah Simpan/Batal lengket; hapus akun lewat dialog (pesan peringatan lengkap; ditolak bila ada riwayat persetujuan).
- Keyboard (Tab/Spasi/Esc), layar 375 px, cincin fokus.
**Jangan memulai modul berikutnya** sebelum pengguna menyatakan lolos.
