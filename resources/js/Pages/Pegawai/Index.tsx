import DangerButton from '@/Components/DangerButton';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps, Pegawai } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

interface UnitOption {
    id: number;
    name: string;
    type: 'kecamatan' | 'kelurahan';
}

type PegawaiForm = {
    nama: string;
    nip: string;
    pangkat_golongan: string;
    jabatan: string;
    status_kepegawaian: 'pns' | 'pppk';
    unit_id: number | '';
    foto_profile: File | null;
};

const emptyForm: PegawaiForm = {
    nama: '',
    nip: '',
    pangkat_golongan: '',
    jabatan: '',
    status_kepegawaian: 'pns',
    unit_id: '',
    foto_profile: null,
};

function CreateUserForm({ pegawai, canCreateUser }: { pegawai: Pegawai; canCreateUser: boolean }) {
    const [open, setOpen] = useState(false);
    const form = useForm({ email: '', password: '', role: 'admin_kelurahan' });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(route('pegawais.create-user', pegawai.id), {
            preserveScroll: true,
            onSuccess: () => setOpen(false),
        });
    };

    if (pegawai.user_id) {
        return <span className="text-xs text-green-700">Sudah punya akun ({pegawai.user?.email})</span>;
    }

    if (!canCreateUser) {
        return <span className="text-xs text-gray-400">Belum ada akun</span>;
    }

    if (!open) {
        return (
            <SecondaryButton type="button" onClick={() => setOpen(true)}>
                Buat akun login
            </SecondaryButton>
        );
    }

    return (
        <form onSubmit={submit} className="flex flex-wrap items-start gap-2">
            <div>
                <TextInput
                    type="email"
                    placeholder="Email"
                    value={form.data.email}
                    onChange={(e) => form.setData('email', e.target.value)}
                />
                <InputError message={form.errors.email} className="mt-1" />
            </div>
            <div>
                <TextInput
                    type="password"
                    placeholder="Password"
                    value={form.data.password}
                    onChange={(e) => form.setData('password', e.target.value)}
                />
                <InputError message={form.errors.password} className="mt-1" />
            </div>
            <select
                value={form.data.role}
                onChange={(e) => form.setData('role', e.target.value)}
                className="rounded-md border-gray-300 text-sm shadow-sm"
            >
                <option value="kasubag">Kasubag</option>
                <option value="camat">Camat</option>
                <option value="admin_kecamatan">Admin Kecamatan</option>
                <option value="admin_kelurahan">Admin Kelurahan</option>
                <option value="lurah">Lurah</option>
            </select>
            <PrimaryButton disabled={form.processing}>Simpan</PrimaryButton>
            <SecondaryButton type="button" onClick={() => setOpen(false)}>
                Batal
            </SecondaryButton>
        </form>
    );
}

export default function Index({ pegawais, units, can }: PageProps<{ pegawais: Pegawai[]; units: UnitOption[]; can: { create: boolean; createUser: boolean } }>) {
    const form = useForm<PegawaiForm>(emptyForm);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(route('pegawais.store'), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    };

    const remove = (pegawai: Pegawai) => {
        if (confirm(`Hapus data pegawai "${pegawai.nama}"?`)) {
            router.delete(route('pegawais.destroy', pegawai.id), { preserveScroll: true });
        }
    };

    return (
        <AuthenticatedLayout header={<h1 className="text-xl font-semibold text-gray-800">Data Pegawai</h1>}>
            <Head title="Data Pegawai" />

            {can.create && (
                <form onSubmit={submit} className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-white p-4 shadow-sm md:grid-cols-3">
                    <div>
                        <TextInput placeholder="Nama" value={form.data.nama} onChange={(e) => form.setData('nama', e.target.value)} className="w-full" />
                        <InputError message={form.errors.nama} className="mt-1" />
                    </div>
                    <div>
                        <TextInput placeholder="NIP (opsional)" value={form.data.nip} onChange={(e) => form.setData('nip', e.target.value)} className="w-full" />
                        <InputError message={form.errors.nip} className="mt-1" />
                    </div>
                    <div>
                        <TextInput placeholder="Pangkat/Golongan" value={form.data.pangkat_golongan} onChange={(e) => form.setData('pangkat_golongan', e.target.value)} className="w-full" />
                    </div>
                    <div>
                        <TextInput placeholder="Jabatan" value={form.data.jabatan} onChange={(e) => form.setData('jabatan', e.target.value)} className="w-full" />
                        <InputError message={form.errors.jabatan} className="mt-1" />
                    </div>
                    <select
                        value={form.data.status_kepegawaian}
                        onChange={(e) => form.setData('status_kepegawaian', e.target.value as 'pns' | 'pppk')}
                        className="rounded-md border-gray-300 text-sm shadow-sm"
                    >
                        <option value="pns">PNS</option>
                        <option value="pppk">PPPK</option>
                    </select>
                    <select
                        value={form.data.unit_id}
                        onChange={(e) => form.setData('unit_id', e.target.value === '' ? '' : Number(e.target.value))}
                        className="rounded-md border-gray-300 text-sm shadow-sm"
                    >
                        <option value="">— Unit —</option>
                        {units.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.name}
                            </option>
                        ))}
                    </select>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => form.setData('foto_profile', e.target.files?.[0] ?? null)}
                        className="text-sm"
                    />
                    <PrimaryButton disabled={form.processing}>Tambah Pegawai</PrimaryButton>
                </form>
            )}

            <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead>
                        <tr className="text-left text-xs uppercase text-gray-500">
                            <th className="px-4 py-2">Nama</th>
                            <th className="px-4 py-2">NIP</th>
                            <th className="px-4 py-2">Jabatan</th>
                            <th className="px-4 py-2">Unit</th>
                            <th className="px-4 py-2">Akun Login</th>
                            <th className="px-4 py-2"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {pegawais.map((pegawai) => (
                            <tr key={pegawai.id}>
                                <td className="px-4 py-2">{pegawai.nama}</td>
                                <td className="px-4 py-2">{pegawai.nip ?? '—'}</td>
                                <td className="px-4 py-2">{pegawai.jabatan}</td>
                                <td className="px-4 py-2">{pegawai.unit?.name}</td>
                                <td className="px-4 py-2">
                                    <CreateUserForm pegawai={pegawai} canCreateUser={can.createUser} />
                                </td>
                                <td className="px-4 py-2">
                                    <DangerButton type="button" onClick={() => remove(pegawai)}>
                                        Hapus
                                    </DangerButton>
                                </td>
                            </tr>
                        ))}
                        {pegawais.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                                    Belum ada data pegawai.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </AuthenticatedLayout>
    );
}
