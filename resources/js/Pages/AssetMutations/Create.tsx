import {
    ChevronRightIcon as ChevronRight,
    PlusIcon as Plus,
    TrashIcon as Trash,
} from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Asset, MutationType, PageProps, Pegawai } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent, useMemo } from 'react';

interface UnitOption {
    id: number;
    name: string;
    type: 'kecamatan' | 'kelurahan';
}

interface CreateProps extends PageProps {
    units: UnitOption[];
    allUnits: UnitOption[];
    assets: Asset[];
    pegawais: Pegawai[];
}

interface ItemForm {
    asset_id: string | number;
    target_holder_id: string | number;
    catatan: string;
}

const EMPTY_ITEM: ItemForm = {
    asset_id: '',
    target_holder_id: '',
    catatan: '',
};

export default function Create({ units, allUnits, assets, pegawais, auth }: CreateProps) {
    // Default origin to user's assigned unit or first accessible unit
    const defaultOriginId = auth.user?.unit?.id ?? units[0]?.id ?? 1;
    const defaultOriginUnit = allUnits.find((u) => u.id === defaultOriginId);
    const isOriginKecamatan = defaultOriginUnit?.type === 'kecamatan';

    // Auto-generate suggested document number
    const todayStr = new Date().toISOString().slice(0, 10);
    const dateNum = todayStr.replace(/-/g, '');
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const defaultDocNumber = `MUT/${dateNum}/${randNum}`;

    const form = useForm({
        nomor_mutasi: defaultDocNumber,
        tanggal_mutasi: todayStr,
        jenis_mutasi: (isOriginKecamatan ? 'kec_ke_kel' : 'antar_kel') as MutationType,
        origin_unit_id: defaultOriginId,
        destination_unit_id: '' as string | number,
        keterangan: '',
        items: [{ ...EMPTY_ITEM }] as ItemForm[],
    });

    const originUnit = useMemo(
        () => allUnits.find((u) => u.id === Number(form.data.origin_unit_id)),
        [allUnits, form.data.origin_unit_id]
    );

    // Eligible destination units based on mutation type & origin unit
    const destinationOptions = useMemo(() => {
        const originId = Number(form.data.origin_unit_id);

        if (form.data.jenis_mutasi === 'internal') {
            const origin = allUnits.find((u) => u.id === originId);
            return origin ? [origin] : [];
        }

        if (form.data.jenis_mutasi === 'kec_ke_kel') {
            return allUnits.filter((u) => u.type === 'kelurahan');
        }

        if (form.data.jenis_mutasi === 'retur_kel_ke_kec') {
            return allUnits.filter((u) => u.type === 'kecamatan');
        }

        if (form.data.jenis_mutasi === 'antar_kel') {
            return allUnits.filter((u) => u.type === 'kelurahan' && u.id !== originId);
        }

        return allUnits.filter((u) => u.id !== originId);
    }, [allUnits, form.data.jenis_mutasi, form.data.origin_unit_id]);

    // Available assets from selected origin unit
    const availableAssets = useMemo(() => {
        const originId = Number(form.data.origin_unit_id);
        return assets.filter((a) => a.unit_id === originId && a.status === 'aktif');
    }, [assets, form.data.origin_unit_id]);

    // Eligible pegawais for target holder dropdown
    const targetPegawaiOptions = useMemo(() => {
        const destId =
            form.data.jenis_mutasi === 'internal'
                ? Number(form.data.origin_unit_id)
                : Number(form.data.destination_unit_id);

        if (!destId) return [];
        return pegawais.filter((p) => p.unit_id === destId);
    }, [pegawais, form.data.jenis_mutasi, form.data.origin_unit_id, form.data.destination_unit_id]);

    // Handle change of mutation type
    const handleTypeChange = (newType: MutationType) => {
        form.setData((data) => {
            let nextDest = data.destination_unit_id;
            const originId = Number(data.origin_unit_id);

            if (newType === 'internal') {
                nextDest = originId;
            } else if (newType === 'retur_kel_ke_kec') {
                const kec = allUnits.find((u) => u.type === 'kecamatan');
                nextDest = kec ? kec.id : '';
            } else if (nextDest === originId) {
                nextDest = '';
            }

            return {
                ...data,
                jenis_mutasi: newType,
                destination_unit_id: nextDest,
                // reset holders on type change
                items: data.items.map((i) => ({ ...i, target_holder_id: '' })),
            };
        });
    };

    const updateItem = (index: number, field: keyof ItemForm, value: string | number) => {
        const newItems = [...form.data.items];
        newItems[index] = { ...newItems[index], [field]: value };
        form.setData('items', newItems);
    };

    const addItem = () => {
        form.setData('items', [...form.data.items, { ...EMPTY_ITEM }]);
    };

    const removeItem = (index: number) => {
        if (form.data.items.length <= 1) return;
        form.setData(
            'items',
            form.data.items.filter((_, i) => i !== index)
        );
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();

        // Convert string numbers to integers
        form.transform((data) => ({
            ...data,
            origin_unit_id: Number(data.origin_unit_id),
            destination_unit_id:
                data.jenis_mutasi === 'internal'
                    ? Number(data.origin_unit_id)
                    : Number(data.destination_unit_id),
            items: data.items.map((item) => ({
                asset_id: Number(item.asset_id),
                target_holder_id: item.target_holder_id ? Number(item.target_holder_id) : null,
                catatan: item.catatan || null,
            })),
        }));

        form.post(route('asset-mutations.store'));
    };

    // Selected asset IDs to prevent picking duplicate assets in multi-item
    const selectedAssetIds = useMemo(
        () => form.data.items.map((i) => Number(i.asset_id)).filter(Boolean),
        [form.data.items]
    );

    return (
        <AuthenticatedLayout>
            <Head title="Formulir Pengajuan Mutasi Aset" />

            <div className="space-y-6">
                {/* Breadcrumbs & Header */}
                <div>
                    <nav className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <Link href={route('dashboard')} className="transition hover:text-blue-700">
                            Home
                        </Link>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <Link href={route('asset-mutations.index')} className="transition hover:text-blue-700">
                            Mutasi Aset
                        </Link>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span className="font-medium text-slate-800">Ajukan Mutasi</span>
                    </nav>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                        Formulir Pengajuan Mutasi Aset
                    </h1>
                    <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                        Lengkapi dokumen berita acara mutasi dan tentukan aset yang dialihkan kepemilikannya.
                    </p>
                </div>

                <form onSubmit={submit} className="space-y-6 sm:space-y-8">
                    {/* Section 1: Informasi Dokumen Mutasi */}
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-6 lg:p-8">
                        <div className="border-b border-slate-100 pb-3">
                            <h2 className="text-base font-semibold text-slate-900">
                                Informasi Dokumen & Alur Mutasi
                            </h2>
                            <p className="text-xs text-slate-500">
                                Identitas surat pengajuan dan relasi unit kerja yang terlibat
                            </p>
                        </div>

                        <div className="mt-5 grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                                    Nomor Dokumen Mutasi <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.data.nomor_mutasi}
                                    onChange={(e) => form.setData('nomor_mutasi', e.target.value)}
                                    placeholder="MUT/YYYYMMDD/XXXX"
                                    required
                                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 transition focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                />
                                {form.errors.nomor_mutasi && (
                                    <p className="mt-1 text-xs text-red-600">{form.errors.nomor_mutasi}</p>
                                )}
                            </div>

                            <div>
                                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                                    Tanggal Mutasi <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={form.data.tanggal_mutasi}
                                    onChange={(e) => form.setData('tanggal_mutasi', e.target.value)}
                                    required
                                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 transition focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                />
                                {form.errors.tanggal_mutasi && (
                                    <p className="mt-1 text-xs text-red-600">{form.errors.tanggal_mutasi}</p>
                                )}
                            </div>

                            <div>
                                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                                    Jenis Mutasi <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={form.data.jenis_mutasi}
                                    onChange={(e) => handleTypeChange(e.target.value as MutationType)}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                >
                                    {originUnit?.type === 'kecamatan' ? (
                                        <>
                                            <option value="kec_ke_kel">Mutasi Kecamatan ke Kelurahan</option>
                                            <option value="internal">Mutasi Internal Kecamatan</option>
                                        </>
                                    ) : (
                                        <>
                                            <option value="antar_kel">Mutasi Antar Kelurahan</option>
                                            <option value="retur_kel_ke_kec">Retur Kelurahan ke Kecamatan</option>
                                            <option value="internal">Mutasi Internal Kelurahan</option>
                                        </>
                                    )}
                                </select>
                                {form.errors.jenis_mutasi && (
                                    <p className="mt-1 text-xs text-red-600">{form.errors.jenis_mutasi}</p>
                                )}
                            </div>

                            <div>
                                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                                    Unit Asal <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={form.data.origin_unit_id}
                                    onChange={(e) => {
                                        const newOriginId = Number(e.target.value);
                                        form.setData((d) => ({
                                            ...d,
                                            origin_unit_id: newOriginId,
                                            destination_unit_id:
                                                d.jenis_mutasi === 'internal' ? newOriginId : '',
                                            items: [{ ...EMPTY_ITEM }],
                                        }));
                                    }}
                                    disabled={units.length <= 1}
                                    className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 transition focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-80"
                                >
                                    {units.map((u) => (
                                        <option key={u.id} value={u.id}>
                                            {u.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {form.data.jenis_mutasi !== 'internal' && (
                                <div className="md:col-span-2">
                                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                                        Unit Tujuan <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={form.data.destination_unit_id}
                                        onChange={(e) => form.setData('destination_unit_id', e.target.value)}
                                        required
                                        className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                    >
                                        <option value="">-- Pilih Unit Tujuan --</option>
                                        {destinationOptions.map((u) => (
                                            <option key={u.id} value={u.id}>
                                                {u.name} ({u.type})
                                            </option>
                                        ))}
                                    </select>
                                    {form.errors.destination_unit_id && (
                                        <p className="mt-1 text-xs text-red-600">
                                            {form.errors.destination_unit_id}
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="md:col-span-2">
                                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                                    Keterangan / Alasan Mutasi
                                </label>
                                <textarea
                                    rows={2}
                                    value={form.data.keterangan}
                                    onChange={(e) => form.setData('keterangan', e.target.value)}
                                    placeholder="Tuliskan catatan atau latar belakang pengalihan aset ini..."
                                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 transition focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                />
                                {form.errors.keterangan && (
                                    <p className="mt-1 text-xs text-red-600">{form.errors.keterangan}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Daftar Aset yang Dimutasi */}
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-6 lg:p-8">
                        <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-base font-semibold text-slate-900">
                                    Daftar Aset yang Dimutasi
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Pilih barang aktif yang akan diserahterimakan (tersedia {availableAssets.length} aset aktif di {originUnit?.name}).
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={addItem}
                                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-blue-600 bg-blue-50/50 px-3.5 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100/60 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-1 sm:w-auto"
                            >
                                <Plus className="h-3.5 w-3.5" /> Tambah Aset Lain
                            </button>
                        </div>

                        {form.errors.items && (
                            <p className="mt-3 text-xs font-medium text-red-600">{form.errors.items}</p>
                        )}

                        <div className="mt-5 space-y-4">
                            {form.data.items.map((item, idx) => {
                                const selectedAsset = assets.find((a) => a.id === Number(item.asset_id));
                                const itemAssetError = (form.errors as Record<string, string>)[
                                    `items.${idx}.asset_id`
                                ];
                                const itemHolderError = (form.errors as Record<string, string>)[
                                    `items.${idx}.target_holder_id`
                                ];

                                return (
                                    <div
                                        key={idx}
                                        className="relative rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition hover:border-slate-300 sm:p-5"
                                    >
                                        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                                            <span className="text-xs font-bold text-slate-800">
                                                Aset #{idx + 1}
                                            </span>
                                            {form.data.items.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(idx)}
                                                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 hover:text-red-700"
                                                >
                                                    <Trash className="h-3.5 w-3.5" /> Hapus
                                                </button>
                                            )}
                                        </div>

                                        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
                                            {/* Pilih Aset */}
                                            <div className="lg:col-span-5">
                                                <label className="mb-1 block text-xs font-medium text-slate-700">
                                                    Pilih Barang / Aset <span className="text-red-500">*</span>
                                                </label>
                                                <select
                                                    value={item.asset_id}
                                                    onChange={(e) => updateItem(idx, 'asset_id', e.target.value)}
                                                    required
                                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                                >
                                                    <option value="">-- Pilih Aset Aktif --</option>
                                                    {availableAssets.map((a) => {
                                                        const isSelectedElsewhere =
                                                            selectedAssetIds.includes(a.id) &&
                                                            Number(item.asset_id) !== a.id;
                                                        return (
                                                            <option
                                                                key={a.id}
                                                                value={a.id}
                                                                disabled={isSelectedElsewhere}
                                                            >
                                                                {a.kode_barang} - {a.nama_aset}
                                                                {isSelectedElsewhere ? ' (sudah dipilih)' : ''}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                                {itemAssetError && (
                                                    <p className="mt-1 text-xs text-red-600">{itemAssetError}</p>
                                                )}
                                                {selectedAsset && (
                                                    <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                                                        <span>Merk: {selectedAsset.merk_type ?? '—'}</span>
                                                        <span aria-hidden="true">&bull;</span>
                                                        <span>
                                                            Pemegang Saat Ini:{' '}
                                                            <strong className="font-medium text-slate-700">
                                                                {selectedAsset.current_holder?.nama ?? 'Inventaris Unit'}
                                                            </strong>
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Pemegang Baru */}
                                            <div className="lg:col-span-4">
                                                <label className="mb-1 block text-xs font-medium text-slate-700">
                                                    Pegawai Pemegang Baru{' '}
                                                    {form.data.jenis_mutasi === 'internal' ? (
                                                        <span className="text-red-500">*</span>
                                                    ) : (
                                                        <span className="text-xs font-normal text-slate-400">
                                                            (Opsional)
                                                        </span>
                                                    )}
                                                </label>
                                                <select
                                                    value={item.target_holder_id}
                                                    onChange={(e) =>
                                                        updateItem(idx, 'target_holder_id', e.target.value)
                                                    }
                                                    required={form.data.jenis_mutasi === 'internal'}
                                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                                >
                                                    <option value="">
                                                        {form.data.jenis_mutasi === 'internal'
                                                            ? '-- Pilih Pegawai Baru --'
                                                            : '-- Inventaris Unit (Tanpa Pemegang Langsung) --'}
                                                    </option>
                                                    {targetPegawaiOptions.map((p) => (
                                                        <option key={p.id} value={p.id}>
                                                            {p.nama} ({p.jabatan})
                                                        </option>
                                                    ))}
                                                </select>
                                                {itemHolderError && (
                                                    <p className="mt-1 text-xs text-red-600">{itemHolderError}</p>
                                                )}
                                            </div>

                                            {/* Catatan Item */}
                                            <div className="lg:col-span-3">
                                                <label className="mb-1 block text-xs font-medium text-slate-700">
                                                    Catatan Fisik / Kelengkapan
                                                </label>
                                                <input
                                                    type="text"
                                                    value={item.catatan}
                                                    onChange={(e) => updateItem(idx, 'catatan', e.target.value)}
                                                    placeholder="mis. Lengkap charger & mouse"
                                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Submit Actions */}
                    <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
                        <Link
                            href={route('asset-mutations.index')}
                            className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 sm:w-auto"
                        >
                            Batal
                        </Link>
                        <button
                            type="submit"
                            disabled={form.processing}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1E40AF] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-60 sm:w-auto"
                        >
                            {form.processing ? 'Menyimpan...' : 'Kirim Pengajuan Mutasi'}
                        </button>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
