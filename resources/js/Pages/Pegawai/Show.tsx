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
