import {
    CheckCircleIcon as CheckCircle2,
    ChevronRightIcon as ChevronRight,
    EyeIcon as Eye,
    EyeOffIcon as EyeOff,
    PencilIcon as Pencil,
    ShieldIcon as Shield,
    UserIcon as User,
    UserPlusIcon as UserPlus,
    XIcon as X,
} from '@/Components/Icons';
import InputError from '@/Components/InputError';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps, Pegawai } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

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

function formatRupiah(value: number | string | null | undefined): string {
    if (!value) return 'Rp 0';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(num);
}

function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
}

export default function Show({ pegawai, roles = [], can }: ShowProps) {
    const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
    const formattedRole = userRole
        ? ROLE_LABELS[userRole] || userRole
        : 'Belum Ditentukan';
    const isPns = pegawai.status_kepegawaian === 'pns';

    return (
        <AuthenticatedLayout>
            <Head title={`Detail Pegawai: ${pegawai.nama}`} />

            <div className="space-y-6">
                {/* Header Top Bar */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Link
                                href={route('dashboard')}
                                className="hover:text-blue-700"
                            >
                                Home
                            </Link>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                            <Link
                                href={route('pegawais.index')}
                                className="hover:text-blue-700"
                            >
                                Data Pegawai
                            </Link>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                            <span className="font-medium text-slate-800">
                                Detail Pegawai
                            </span>
                        </nav>
                        <div className="mt-1 flex flex-wrap items-center gap-3">
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                                {pegawai.nama}
                            </h1>
                            <span
                                className={`inline-flex items-center rounded px-2.5 py-0.5 text-xs font-semibold ${
                                    isPns
                                        ? 'border border-blue-200 bg-blue-50 text-blue-700'
                                        : 'border border-purple-200 bg-purple-50 text-purple-700'
                                }`}
                            >
                                {isPns ? 'PNS' : 'PPPK'}
                            </span>
                            <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                    hasAccount
                                        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                                        : 'border border-slate-200 bg-slate-100 text-slate-600'
                                }`}
                            >
                                <span
                                    className={`h-1.5 w-1.5 rounded-full ${
                                        hasAccount
                                            ? 'bg-emerald-500'
                                            : 'bg-slate-400'
                                    }`}
                                />
                                <span>
                                    {hasAccount
                                        ? 'Punya Akun'
                                        : 'Belum Ada Akun'}
                                </span>
                            </span>
                        </div>
                    </div>

                    {/* Header Action Buttons */}
                    <div className="flex flex-wrap items-center gap-3">
                        {can.createUser && !hasAccount && (
                            <button
                                type="button"
                                onClick={() => setIsCreateAccountOpen(true)}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            >
                                <UserPlus className="h-4 w-4 text-blue-600" />
                                <span>Buat Akun Login</span>
                            </button>
                        )}

                        {hasAccount && (
                            <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-600">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                <span>Akun Aktif: {pegawai.user?.email}</span>
                            </div>
                        )}

                        {can.update && (
                            <Link
                                href={route('pegawais.edit', pegawai.id)}
                                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            >
                                <Pencil className="h-4 w-4" />
                                <span>Edit Data</span>
                            </Link>
                        )}
                    </div>
                </div>

                {/* Two-Column Split Content */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    {/* Left Column: Photo & Quick Profile Card */}
                    <div className="lg:col-span-4 xl:col-span-3">
                        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                            {/* Photo Area */}
                            <div className="aspect-4/3 flex w-full items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                                {pegawai.foto_profile ? (
                                    <img
                                        src={`/storage/${pegawai.foto_profile}`}
                                        alt={pegawai.nama}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-200/80 text-slate-400">
                                        <User className="h-12 w-12" />
                                    </div>
                                )}
                            </div>

                            {/* Brief Info */}
                            <div className="mt-4 text-center">
                                <h2 className="text-lg font-bold text-slate-900">
                                    {pegawai.nama}
                                </h2>
                                <p className="mt-0.5 text-xs text-slate-500">
                                    {pegawai.nip
                                        ? `NIP: ${pegawai.nip}`
                                        : 'Tanpa NIP'}
                                </p>
                            </div>

                            {/* Divider */}
                            <div className="my-5 border-t border-slate-100" />

                            {/* Quick Stats */}
                            <div className="space-y-3 text-xs">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500">
                                        Jabatan
                                    </span>
                                    <span className="text-right font-semibold text-slate-900">
                                        {pegawai.jabatan}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500">
                                        Unit Kerja
                                    </span>
                                    <span className="text-right font-semibold text-slate-900">
                                        {pegawai.unit?.name ?? '-'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500">
                                        Aset Dipegang
                                    </span>
                                    <span className="rounded-md bg-blue-50 px-2 py-0.5 font-bold text-blue-700">
                                        {pegawai.assets?.length ?? 0} unit
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Kepegawaian & Akun SIBIMA Card */}
                    <div className="lg:col-span-8 xl:col-span-9">
                        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                            {/* Section: Data Kepegawaian */}
                            <div>
                                <h3 className="text-base font-bold text-slate-900">
                                    Data Kepegawaian
                                </h3>

                                <div className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-100 bg-slate-50/40 text-xs sm:text-sm">
                                    <div className="grid grid-cols-12 px-4 py-2.5">
                                        <div className="col-span-5 font-medium text-slate-500">
                                            Nama Lengkap
                                        </div>
                                        <div className="col-span-7 font-semibold text-slate-900">
                                            {pegawai.nama}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-12 px-4 py-2.5">
                                        <div className="col-span-5 font-medium text-slate-500">
                                            NIP
                                        </div>
                                        <div className="col-span-7 text-slate-900">
                                            {pegawai.nip ?? '-'}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-12 px-4 py-2.5">
                                        <div className="col-span-5 font-medium text-slate-500">
                                            Status Aparatur
                                        </div>
                                        <div className="col-span-7">
                                            <span className="font-semibold uppercase text-slate-900">
                                                {pegawai.status_kepegawaian}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-12 px-4 py-2.5">
                                        <div className="col-span-5 font-medium text-slate-500">
                                            Pangkat / Golongan
                                        </div>
                                        <div className="col-span-7 text-slate-900">
                                            {pegawai.pangkat_golongan ?? '-'}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-12 px-4 py-2.5">
                                        <div className="col-span-5 font-medium text-slate-500">
                                            Jabatan
                                        </div>
                                        <div className="col-span-7 font-medium text-slate-900">
                                            {pegawai.jabatan}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-12 px-4 py-2.5">
                                        <div className="col-span-5 font-medium text-slate-500">
                                            Unit Kerja
                                        </div>
                                        <div className="col-span-7 text-slate-900">
                                            {pegawai.unit?.name ?? '-'}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-12 px-4 py-2.5">
                                        <div className="col-span-5 font-medium text-slate-500">
                                            No. HP
                                        </div>
                                        <div className="col-span-7 text-slate-900">
                                            {pegawai.no_hp ?? '-'}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-12 px-4 py-2.5">
                                        <div className="col-span-5 font-medium text-slate-500">
                                            Email Dinas
                                        </div>
                                        <div className="col-span-7 text-slate-900">
                                            {pegawai.email_dinas ?? '-'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Divider Line */}
                            <div className="my-6 border-t border-slate-200" />

                            {/* Section: Informasi Akun SIBIMA */}
                            <div>
                                <div className="flex items-center gap-2">
                                    <Shield className="h-4 w-4 text-blue-700" />
                                    <h3 className="text-base font-bold text-slate-900">
                                        Informasi Akun SIBIMA
                                    </h3>
                                </div>

                                <div className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-100 bg-slate-50/40 text-xs sm:text-sm">
                                    <div className="grid grid-cols-12 items-center px-4 py-2.5">
                                        <div className="col-span-5 font-medium text-slate-500">
                                            Status Akun
                                        </div>
                                        <div className="col-span-7">
                                            {hasAccount ? (
                                                <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                                    Aktif
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                                    Belum Memiliki Akun
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-12 px-4 py-2.5">
                                        <div className="col-span-5 font-medium text-slate-500">
                                            Role Login
                                        </div>
                                        <div className="col-span-7 font-medium text-slate-900">
                                            {hasAccount ? formattedRole : '-'}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-12 px-4 py-2.5">
                                        <div className="col-span-5 font-medium text-slate-500">
                                            Email Login
                                        </div>
                                        <div className="col-span-7 font-mono text-xs text-slate-900">
                                            {pegawai.user?.email ?? '-'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Card: Daftar Aset yang Dipegang */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between pb-4">
                        <div className="flex items-center gap-3">
                            <h3 className="text-base font-bold text-slate-900">
                                Aset yang Dipegang
                            </h3>
                            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                                {pegawai.assets?.length ?? 0} aset
                            </span>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs sm:text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                    <th className="w-12 px-4 py-3 text-center">
                                        No
                                    </th>
                                    <th className="px-4 py-3">Nama Aset</th>
                                    <th className="px-4 py-3">Kode BMD</th>
                                    <th className="px-4 py-3">Kondisi</th>
                                    <th className="px-4 py-3 text-right">
                                        Nilai Perolehan
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {pegawai.assets && pegawai.assets.length > 0 ? (
                                    pegawai.assets.map((asset, index) => {
                                        const isBaik = asset.kondisi === 'baik';
                                        const isRusakRingan =
                                            asset.kondisi === 'rusak_ringan';

                                        return (
                                            <tr
                                                key={asset.id}
                                                className="transition-colors hover:bg-slate-50/80"
                                            >
                                                <td className="px-4 py-3 text-center text-slate-500">
                                                    {index + 1}
                                                </td>
                                                <td className="px-4 py-3 font-semibold text-slate-900">
                                                    {asset.nama_aset}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-xs text-slate-600">
                                                    {asset.kode_barang}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span
                                                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                                                            isBaik
                                                                ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                                                                : isRusakRingan
                                                                  ? 'border border-amber-200 bg-amber-50 text-amber-700'
                                                                  : 'border border-rose-200 bg-rose-50 text-rose-700'
                                                        }`}
                                                    >
                                                        {isBaik
                                                            ? 'Baik'
                                                            : isRusakRingan
                                                              ? 'Rusak Ringan'
                                                              : 'Rusak Berat'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium text-slate-900">
                                                    {formatRupiah(
                                                        asset.nilai_perolehan,
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-4 py-8 text-center text-xs text-slate-400"
                                        >
                                            Pegawai belum memegang aset apapun
                                            saat ini.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal: Buat Akun Login */}
            {isCreateAccountOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-base font-bold text-slate-900">
                                Buat Akun Login
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsCreateAccountOpen(false)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Employee Summary Card */}
                        <div className="my-4 flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-700 text-xs font-bold text-white">
                                {getInitials(pegawai.nama)}
                            </div>
                            <div>
                                <div className="text-sm font-bold text-slate-900">
                                    {pegawai.nama}
                                </div>
                                <div className="text-xs text-slate-500">
                                    {pegawai.nip
                                        ? `NIP: ${pegawai.nip}`
                                        : 'Tanpa NIP'}
                                </div>
                            </div>
                        </div>

                        {/* Modal Form */}
                        <form
                            onSubmit={submitCreateAccount}
                            className="space-y-4"
                        >
                            {/* Role Login */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700">
                                    Role Login{' '}
                                    <span className="text-rose-600">*</span>
                                </label>
                                <select
                                    value={createAccountForm.data.role}
                                    onChange={(e) =>
                                        createAccountForm.setData(
                                            'role',
                                            e.target.value,
                                        )
                                    }
                                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
                                    required
                                    disabled={roles.length === 0}
                                >
                                    {roles.length > 0 ? (
                                        roles.map((r) => (
                                            <option key={r.value} value={r.value}>
                                                {r.label}
                                            </option>
                                        ))
                                    ) : (
                                        <option value="" disabled>
                                            Tidak ada role yang dapat Anda delegasikan
                                        </option>
                                    )}
                                </select>
                                <InputError
                                    message={createAccountForm.errors.role}
                                    className="mt-1"
                                />
                            </div>

                            {/* Email Login */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700">
                                    Email Login{' '}
                                    <span className="text-rose-600">*</span>
                                </label>
                                <input
                                    type="email"
                                    value={createAccountForm.data.email}
                                    onChange={(e) =>
                                        createAccountForm.setData(
                                            'email',
                                            e.target.value,
                                        )
                                    }
                                    placeholder="nama@batam.go.id"
                                    className="mt-1 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                    required
                                />
                                <InputError
                                    message={createAccountForm.errors.email}
                                    className="mt-1"
                                />
                            </div>

                            {/* Kata Sandi */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700">
                                    Kata Sandi{' '}
                                    <span className="text-rose-600">*</span>
                                </label>
                                <div className="relative mt-1">
                                    <input
                                        type={
                                            showPassword ? 'text' : 'password'
                                        }
                                        value={createAccountForm.data.password}
                                        onChange={(e) =>
                                            createAccountForm.setData(
                                                'password',
                                                e.target.value,
                                            )
                                        }
                                        placeholder="••••••••"
                                        className="w-full rounded-lg border border-slate-200 px-3.5 py-2 pr-10 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowPassword(!showPassword)
                                        }
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                                <InputError
                                    message={createAccountForm.errors.password}
                                    className="mt-1"
                                />
                            </div>

                            {/* Konfirmasi Kata Sandi */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700">
                                    Konfirmasi Kata Sandi{' '}
                                    <span className="text-rose-600">*</span>
                                </label>
                                <div className="relative mt-1">
                                    <input
                                        type={
                                            showConfirmPassword
                                                ? 'text'
                                                : 'password'
                                        }
                                        value={
                                            createAccountForm.data
                                                .password_confirmation
                                        }
                                        onChange={(e) =>
                                            createAccountForm.setData(
                                                'password_confirmation',
                                                e.target.value,
                                            )
                                        }
                                        placeholder="••••••••"
                                        className="w-full rounded-lg border border-slate-200 px-3.5 py-2 pr-10 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowConfirmPassword(
                                                !showConfirmPassword,
                                            )
                                        }
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showConfirmPassword ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <p className="text-[11px] text-slate-500">
                                Pastikan kata sandi minimal 8 karakter dengan
                                kombinasi huruf dan angka.
                            </p>

                            {/* Modal Actions */}
                            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setIsCreateAccountOpen(false)
                                    }
                                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={createAccountForm.processing || roles.length === 0}
                                    className="rounded-lg bg-blue-700 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50"
                                >
                                    {createAccountForm.processing
                                        ? 'Menyimpan...'
                                        : 'Simpan & Aktifkan Akun'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
