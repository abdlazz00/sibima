import {
    CameraIcon as Camera,
    ChevronRightIcon as ChevronRight,
    UploadIcon as Upload,
    XIcon as X,
} from '@/Components/Icons';
import InputError from '@/Components/InputError';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { ChangeEvent, FormEvent, useRef, useState } from 'react';

interface UnitOption {
    id: number;
    name: string;
    type: 'kecamatan' | 'kelurahan';
}

interface CreateProps extends PageProps {
    units: UnitOption[];
}

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

export default function Create({ units }: CreateProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);

    const { data, setData, post, processing, errors } = useForm({
        nama: '',
        nip: '',
        status_kepegawaian: 'pns' as 'pns' | 'pppk',
        no_hp: '',
        email_dinas: '',
        pangkat_golongan: '',
        jabatan: '',
        unit_id: units[0]?.id ? String(units[0].id) : '',
        foto_profile: null as File | null,
    });

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

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('pegawais.store'), {
            forceFormData: true,
        });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Tambah Pegawai Baru" />

            <div className="space-y-6">
                {/* Header & Breadcrumbs */}
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
                            Tambah Pegawai
                        </span>
                    </nav>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                        Tambah Pegawai Baru
                    </h1>
                </div>

                {/* Form Card */}
                <form onSubmit={submit} className="space-y-6">
                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                        {/* Top Section: Photo and Personal Data */}
                        <div className="flex flex-col gap-8 md:flex-row md:items-start">
                            {/* Left Column: Photo Upload Area */}
                            <div className="w-full md:w-64 lg:w-72 shrink-0">
                                <label className="block text-sm font-semibold text-slate-900">
                                    Foto Pegawai (Opsional)
                                </label>

                                <div className="mt-3">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handlePhotoChange}
                                        accept="image/jpeg,image/png,image/jpg"
                                        className="hidden"
                                    />

                                    {photoPreview ? (
                                        <div className="aspect-3/4 relative flex w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-inner">
                                            <img
                                                src={photoPreview}
                                                alt="Preview foto pegawai"
                                                className="h-full w-full object-cover"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleRemovePhoto}
                                                className="absolute right-2 top-2 rounded-full bg-slate-900/70 p-1.5 text-white backdrop-blur-sm transition hover:bg-rose-600"
                                                title="Hapus foto"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div
                                            onClick={() =>
                                                fileInputRef.current?.click()
                                            }
                                            className="aspect-3/4 group flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-6 text-center transition hover:border-blue-500 hover:bg-blue-50/30"
                                        >
                                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm transition group-hover:scale-105 group-hover:text-blue-600">
                                                <Camera className="h-6 w-6" />
                                            </div>
                                            <div className="mt-4 text-sm font-semibold text-slate-800 group-hover:text-blue-700">
                                                Klik untuk unggah foto
                                            </div>
                                            <p className="mt-1 text-xs text-slate-500">
                                                Format JPG/PNG, maks. 2MB
                                            </p>
                                        </div>
                                    )}

                                    <InputError
                                        message={errors.foto_profile}
                                        className="mt-2"
                                    />
                                </div>
                            </div>

                            {/* Right Column: Personal Data */}
                            <div className="flex-1 min-w-0 space-y-5">
                                <div className="border-b border-slate-100 pb-2">
                                    <h2 className="text-base font-semibold text-slate-900">
                                        Data Pribadi
                                    </h2>
                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    {/* Nama Lengkap */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700">
                                            Nama Lengkap{' '}
                                            <span className="text-rose-600">
                                                *
                                            </span>
                                        </label>
                                        <input
                                            type="text"
                                            value={data.nama}
                                            onChange={(e) =>
                                                setData('nama', e.target.value)
                                            }
                                            placeholder="Masukkan nama lengkap pegawai"
                                            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                            required
                                        />
                                        <InputError
                                            message={errors.nama}
                                            className="mt-1"
                                        />
                                    </div>

                                    {/* NIP */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700">
                                            NIP
                                        </label>
                                        <input
                                            type="text"
                                            value={data.nip}
                                            onChange={(e) =>
                                                setData('nip', e.target.value)
                                            }
                                            placeholder="Masukkan NIP (18 digit)"
                                            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                        />
                                        <p className="mt-1 text-[11px] text-slate-500">
                                            Kosongkan jika PPPK tanpa NIP
                                        </p>
                                        <InputError
                                            message={errors.nip}
                                            className="mt-1"
                                        />
                                    </div>

                                    {/* Status Aparatur */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700">
                                            Status Aparatur{' '}
                                            <span className="text-rose-600">
                                                *
                                            </span>
                                        </label>
                                        <div className="h-9.5 mt-1.5 flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-3.5 py-2 shadow-sm">
                                            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
                                                <input
                                                    type="radio"
                                                    name="status_kepegawaian"
                                                    value="pns"
                                                    checked={
                                                        data.status_kepegawaian ===
                                                        'pns'
                                                    }
                                                    onChange={() =>
                                                        setData(
                                                            'status_kepegawaian',
                                                            'pns',
                                                        )
                                                    }
                                                    className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span>PNS</span>
                                            </label>
                                            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
                                                <input
                                                    type="radio"
                                                    name="status_kepegawaian"
                                                    value="pppk"
                                                    checked={
                                                        data.status_kepegawaian ===
                                                        'pppk'
                                                    }
                                                    onChange={() =>
                                                        setData(
                                                            'status_kepegawaian',
                                                            'pppk',
                                                        )
                                                    }
                                                    className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span>PPPK</span>
                                            </label>
                                        </div>
                                        <InputError
                                            message={errors.status_kepegawaian}
                                            className="mt-1"
                                        />
                                    </div>

                                    {/* No. HP */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700">
                                            No. HP
                                        </label>
                                        <input
                                            type="text"
                                            value={data.no_hp}
                                            onChange={(e) =>
                                                setData('no_hp', e.target.value)
                                            }
                                            placeholder="08xx-xxxx-xxxx"
                                            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                        />
                                        <InputError
                                            message={errors.no_hp}
                                            className="mt-1"
                                        />
                                    </div>

                                    {/* Email Dinas */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700">
                                            Email Dinas
                                        </label>
                                        <input
                                            type="email"
                                            value={data.email_dinas}
                                            onChange={(e) =>
                                                setData(
                                                    'email_dinas',
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="nama@batam.go.id"
                                            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                        />
                                        <InputError
                                            message={errors.email_dinas}
                                            className="mt-1"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Divider Line */}
                        <div className="my-8 border-t border-slate-200" />

                        {/* Bottom Section: Rank & Position */}
                        <div className="space-y-4">
                            <h2 className="text-base font-semibold text-slate-900">
                                Data Kepangkatan &amp; Jabatan
                            </h2>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {/* Pangkat / Golongan */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700">
                                        Pangkat / Golongan
                                    </label>
                                    <select
                                        value={data.pangkat_golongan}
                                        onChange={(e) =>
                                            setData(
                                                'pangkat_golongan',
                                                e.target.value,
                                            )
                                        }
                                        className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                    >
                                        <option value="">Pilih pangkat</option>
                                        {PANGKAT_OPTIONS.map((pangkat) => (
                                            <option
                                                key={pangkat}
                                                value={pangkat}
                                            >
                                                {pangkat}
                                            </option>
                                        ))}
                                    </select>
                                    <InputError
                                        message={errors.pangkat_golongan}
                                        className="mt-1"
                                    />
                                </div>

                                {/* Jabatan */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700">
                                        Jabatan{' '}
                                        <span className="text-rose-600">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={data.jabatan}
                                        onChange={(e) =>
                                            setData('jabatan', e.target.value)
                                        }
                                        placeholder="Masukkan jabatan dinas"
                                        className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                        required
                                    />
                                    <InputError
                                        message={errors.jabatan}
                                        className="mt-1"
                                    />
                                </div>

                                {/* Unit Kerja */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700">
                                        Unit Kerja{' '}
                                        <span className="text-rose-600">*</span>
                                    </label>
                                    <select
                                        value={data.unit_id}
                                        onChange={(e) =>
                                            setData('unit_id', e.target.value)
                                        }
                                        className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                        required
                                    >
                                        <option value="">
                                            Pilih unit kerja penugasan
                                        </option>
                                        {units.map((unit) => (
                                            <option
                                                key={unit.id}
                                                value={unit.id}
                                            >
                                                {unit.name} (
                                                {unit.type === 'kecamatan'
                                                    ? 'Kecamatan'
                                                    : 'Kelurahan'}
                                                )
                                            </option>
                                        ))}
                                    </select>
                                    <InputError
                                        message={errors.unit_id}
                                        className="mt-1"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="flex items-center justify-end gap-3">
                        <Link
                            href={route('pegawais.index')}
                            className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
                        >
                            Batal
                        </Link>
                        <button
                            type="submit"
                            disabled={processing}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50"
                        >
                            <Upload className="h-4 w-4" />
                            <span>
                                {processing ? 'Menyimpan...' : 'Simpan Pegawai'}
                            </span>
                        </button>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
