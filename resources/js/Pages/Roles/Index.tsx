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
                                                        color="primary-green"
                                                        size="sm"
                                                        iconLeading={Edit01}
                                                        aria-label={`Ubah role ${r.display_name}`}
                                                        href={route('roles.edit', r.id)}
                                                    />
                                                </Tooltip>
                                                <span title={deleteReason}>
                                                    <Button
                                                        color="primary-destructive"
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
