import AssetSelectModal, { SelectableAsset } from '@/Components/AssetSelectModal';
import {
    ChevronRightIcon as ChevronRight,
    PlusIcon as Plus,
    TrashIcon as Trash,
} from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Asset, MutationType, PageProps, Pegawai } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent, useMemo, useState } from 'react';

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

    const [isModalOpen, setIsModalOpen] = useState(false);

    const form = useForm({
        nomor_mutasi: defaultDocNumber,
        tanggal_mutasi: todayStr,
        jenis_mutasi: (isOriginKecamatan ? 'kec_ke_kel' : 'antar_kel') as MutationType,
        origin_unit_id: defaultOriginId,
        destination_unit_id: '' as string | number,
        keterangan: '',
        items: [{ ...EMPTY_ITEM }] as ItemForm[],
    });

    const isReturn = form.data.jenis_mutasi === 'pengembalian';
    const sameUnit = form.data.jenis_mutasi === 'internal' || isReturn;

    const originUnit = useMemo(
        () => allUnits.find((u) => u.id === Number(form.data.origin_unit_id)),
        [allUnits, form.data.origin_unit_id]
    );

    // Eligible destination units based on mutation type & origin unit
    const destinationOptions = useMemo(() => {
        const originId = Number(form.data.origin_unit_id);

        if (sameUnit) {
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
        return assets.filter(
            (a) => a.unit_id === originId && a.status === 'aktif' && (!isReturn || a.current_holder != null),
        );
    }, [assets, form.data.origin_unit_id, isReturn]);

    // Eligible pegawais for target holder dropdown
    const targetPegawaiOptions = useMemo(() => {
        const destId =
            sameUnit
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

            if (newType === 'internal' || newType === 'pengembalian') {
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
                items: data.items.map((i) => {
                    const held = assets.find((a) => a.id === Number(i.asset_id))?.current_holder != null;
                    return {
                        ...i,
                        target_holder_id: '',
                        asset_id: newType === 'pengembalian' && !held ? '' : i.asset_id,
                    };
                }),
            };
        });
    };

    const updateItem = (index: number, field: keyof ItemForm, value: string | number) => {
        const newItems = [...form.data.items];
        newItems[index] = { ...newItems[index], [field]: value };
        form.setData('items', newItems);
    };

    const selectableAssets: SelectableAsset[] = useMemo(() => {
        return availableAssets.map((a) => ({
            id: a.id,
            kode_barang: a.kode_barang,
            nomor_register: a.nomor_register,
            nama_aset: a.nama_aset,
            merk_type: a.merk_type,
            kondisi: a.kondisi,
            holder: a.current_holder?.nama,
            unit_id: a.unit_id,
        }));
    }, [availableAssets]);

    const handleConfirmAssets = (newSelected: SelectableAsset[]) => {
        const prevMap = new Map(form.data.items.map((i) => [Number(i.asset_id), i]));

        const nextItems: ItemForm[] = newSelected.map((asset) => {
            const existing = prevMap.get(asset.id);
            if (existing) {
                return existing;
            }
            return {
                asset_id: asset.id,
                target_holder_id: '',
                catatan: '',
            };
        });

        form.setData('items', nextItems.length > 0 ? nextItems : [{ ...EMPTY_ITEM }]);
    };

    const removeItem = (index: number) => {
        const next = form.data.items.filter((_, i) => i !== index);
        form.setData('items', next.length > 0 ? next : [{ ...EMPTY_ITEM }]);
    };

    const hasSelectedAssets = form.data.items.length > 0 && form.data.items.some((i) => Boolean(i.asset_id));

    const submit = (e: FormEvent) => {
        e.preventDefault();

        // Convert string numbers to integers
        form.transform((data) => ({
            ...data,
            origin_unit_id: Number(data.origin_unit_id),
            destination_unit_id:
                data.jenis_mutasi === 'internal' || data.jenis_mutasi === 'pengembalian'
                    ? Number(data.origin_unit_id)
                    : Number(data.destination_unit_id),
            items: data.items
                .filter((item) => Boolean(item.asset_id))
                .map((item) => ({
                    asset_id: Number(item.asset_id),
                    target_holder_id:
                        data.jenis_mutasi !== 'pengembalian' && item.target_holder_id ? Number(item.target_holder_id) : null,
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
                                            <option value="pengembalian">Pengembalian ke Inventaris</option>
                                        </>
                                    ) : (
                                        <>
                                            <option value="antar_kel">Mutasi Antar Kelurahan</option>
                                            <option value="retur_kel_ke_kec">Retur Kelurahan ke Kecamatan</option>
                                            <option value="internal">Mutasi Internal Kelurahan</option>
                                            <option value="pengembalian">Pengembalian ke Inventaris</option>
                                        </>
                                    )}
                                </select>
                                {form.errors.jenis_mutasi && (
                                    <p className="mt-1 text-xs text-red-600">{form.errors.jenis_mutasi}</p>
                                )}
                                {isReturn && (
                                    <p className="mt-1 text-xs text-slate-500">
                                        Aset kembali menjadi stok unit setelah disetujui. Untuk memindahkan langsung ke pegawai lain
                                        gunakan Mutasi Internal.
                                    </p>
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
                                                d.jenis_mutasi === 'internal' || d.jenis_mutasi === 'pengembalian' ? newOriginId : '',
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

                            {!sameUnit && (
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
                                    Keterangan / Alasan {isReturn ? 'Pengembalian' : 'Mutasi'}
                                    {isReturn && <span className="text-red-500"> *</span>}
                                </label>
                                <textarea
                                    rows={2}
                                    required={isReturn}
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
                            {hasSelectedAssets && (
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(true)}
                                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-blue-600 bg-blue-50/50 px-3.5 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100/60 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-1 sm:w-auto"
                                >
                                    <Plus className="h-3.5 w-3.5" /> Tambah / Ubah Pilihan Aset
                                </button>
                            )}
                        </div>

                        {form.errors.items && (
                            <p className="mt-3 text-xs font-medium text-red-600">{form.errors.items}</p>
                        )}

                        {!hasSelectedAssets ? (
                            <div className="mt-6 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-8 text-center transition hover:border-blue-400">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                                    <Plus className="h-6 w-6" />
                                </div>
                                <h3 className="mt-3 text-base font-bold text-slate-900">Belum Ada Aset yang Dipilih</h3>
                                <p className="mt-1 max-w-md text-xs text-slate-500">
                                    Pilih satu atau beberapa aset aktif di {originUnit?.name ?? 'unit asal'} yang akan dialihkan ke unit tujuan.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(true)}
                                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#1E40AF] px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-800"
                                >
                                    <Plus className="h-4 w-4" /> Buka Daftar & Pilih Aset ({availableAssets.length} Tersedia)
                                </button>
                            </div>
                        ) : (
                            <div className="mt-5 space-y-4">
                                <div className="overflow-x-auto rounded-xl border border-slate-200">
                                    <table className="w-full border-collapse text-left text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-200 bg-slate-100/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                                                <th className="py-3 px-3.5">Barang / Aset</th>
                                                <th className="py-3 px-3.5">Pemegang Asal</th>
                                                {!isReturn && <th className="py-3 px-3.5">Pemegang Baru di Tujuan</th>}
                                                <th className="py-3 px-3.5">Catatan Barang</th>
                                                <th className="py-3 px-3 w-16 text-center">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {form.data.items.map((item, idx) => {
                                                const selectedAsset = assets.find((a) => a.id === Number(item.asset_id));
                                                if (!selectedAsset) return null;
                                                const itemHolderError = (form.errors as Record<string, string>)[`items.${idx}.target_holder_id`];

                                                return (
                                                    <tr key={item.asset_id} className="hover:bg-slate-50/50">
                                                        <td className="py-3 px-3.5">
                                                            <div className="font-semibold text-slate-900">{selectedAsset.nama_aset}</div>
                                                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                                                                <span className="font-mono">{selectedAsset.kode_barang}</span>
                                                                <span>&bull;</span>
                                                                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-700">
                                                                    Reg. #{String(selectedAsset.nomor_register).padStart(4, '0')}
                                                                </span>
                                                                {selectedAsset.merk_type && (
                                                                    <>
                                                                        <span>&bull;</span>
                                                                        <span>{selectedAsset.merk_type}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-3.5 text-xs whitespace-nowrap">
                                                            {selectedAsset.current_holder ? (
                                                                <span className="font-medium text-slate-800">{selectedAsset.current_holder.nama}</span>
                                                            ) : (
                                                                <span className="italic text-slate-400">Inventaris Unit</span>
                                                            )}
                                                        </td>
                                                        {!isReturn && (
                                                            <td className="py-3 px-3.5 min-w-[200px]">
                                                                <select
                                                                    value={item.target_holder_id}
                                                                    onChange={(e) => updateItem(idx, 'target_holder_id', e.target.value)}
                                                                    required={form.data.jenis_mutasi === 'internal'}
                                                                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-100"
                                                                >
                                                                    <option value="">
                                                                        {form.data.jenis_mutasi === 'internal'
                                                                            ? '-- Pilih Pegawai Baru * --'
                                                                            : '-- Inventaris Unit --'}
                                                                    </option>
                                                                    {targetPegawaiOptions.map((p) => (
                                                                        <option key={p.id} value={p.id}>
                                                                            {p.nama} ({p.jabatan})
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                                {itemHolderError && (
                                                                    <p className="mt-1 text-[11px] text-red-600">{itemHolderError}</p>
                                                                )}
                                                            </td>
                                                        )}
                                                        <td className="py-3 px-3.5 min-w-[180px]">
                                                            <input
                                                                type="text"
                                                                value={item.catatan}
                                                                onChange={(e) => updateItem(idx, 'catatan', e.target.value)}
                                                                placeholder="Catatan kondisi/kelengkapan..."
                                                                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-100"
                                                            />
                                                        </td>
                                                        <td className="py-3 px-3 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeItem(idx)}
                                                                title="Hapus aset ini dari mutasi"
                                                                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                                                            >
                                                                <Trash className="h-4 w-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
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

                <AssetSelectModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    assets={selectableAssets}
                    selectedIds={selectedAssetIds}
                    onConfirm={handleConfirmAssets}
                    mode="multiple"
                    title={`Pilih Aset dari ${originUnit?.name ?? 'Unit Asal'}`}
                    description={`Centang aset yang ingin dipindahkan (${availableAssets.length} aset aktif tersedia).`}
                />
            </div>
        </AuthenticatedLayout>
    );
}
