import AssetSelectModal, { SelectableAsset } from '@/Components/AssetSelectModal';
import PageHeader from '@/Components/PageHeader';
import { Table } from '@/Components/ui/application/table/table';
import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import { Select } from '@/Components/ui/base/select/select';
import { TextArea } from '@/Components/ui/base/textarea/textarea';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Asset, MutationType, PageProps, Pegawai } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { Plus, Trash01 } from '@untitledui/icons';
import { useMemo, useState } from 'react';

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

const NONE = '__none';

const KECAMATAN_TYPES = [
    { id: 'kec_ke_kel', label: 'Mutasi Kecamatan ke Kelurahan' },
    { id: 'internal', label: 'Mutasi Internal Kecamatan' },
    { id: 'pengembalian', label: 'Pengembalian ke Inventaris' },
];

const KELURAHAN_TYPES = [
    { id: 'antar_kel', label: 'Mutasi Antar Kelurahan' },
    { id: 'retur_kel_ke_kec', label: 'Retur Kelurahan ke Kecamatan' },
    { id: 'internal', label: 'Mutasi Internal Kelurahan' },
    { id: 'pengembalian', label: 'Pengembalian ke Inventaris' },
];

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

    const errors = form.errors as Record<string, string>;
    const isReturn = form.data.jenis_mutasi === 'pengembalian';
    const isInternal = form.data.jenis_mutasi === 'internal';
    const sameUnit = isInternal || isReturn;

    const originUnit = useMemo(() => allUnits.find((u) => u.id === Number(form.data.origin_unit_id)), [allUnits, form.data.origin_unit_id]);

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
        return assets.filter((a) => a.unit_id === originId && a.status === 'aktif' && (!isReturn || a.current_holder != null));
    }, [assets, form.data.origin_unit_id, isReturn]);

    // Eligible pegawais for target holder dropdown
    const targetPegawaiOptions = useMemo(() => {
        const destId = sameUnit ? Number(form.data.origin_unit_id) : Number(form.data.destination_unit_id);

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

    const submit = () => {
        if (isInternal && form.data.items.some((i) => i.asset_id && !i.target_holder_id)) {
            form.setError('items', 'Mutasi internal wajib menentukan pegawai pemegang baru untuk setiap aset.');
            return;
        }

        // Convert string numbers to integers
        form.transform((data) => ({
            ...data,
            origin_unit_id: Number(data.origin_unit_id),
            destination_unit_id:
                data.jenis_mutasi === 'internal' || data.jenis_mutasi === 'pengembalian' ? Number(data.origin_unit_id) : Number(data.destination_unit_id),
            items: data.items
                .filter((item) => Boolean(item.asset_id))
                .map((item) => ({
                    asset_id: Number(item.asset_id),
                    target_holder_id: data.jenis_mutasi !== 'pengembalian' && item.target_holder_id ? Number(item.target_holder_id) : null,
                    catatan: item.catatan || null,
                })),
        }));

        form.post(route('asset-mutations.store'));
    };

    // Selected asset IDs to prevent picking duplicate assets in multi-item
    const selectedAssetIds = useMemo(() => form.data.items.map((i) => Number(i.asset_id)).filter(Boolean), [form.data.items]);

    const errorCount = Object.keys(errors).length;

    return (
        <AuthenticatedLayout>
            <Head title="Formulir Pengajuan Mutasi Aset" />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Mutasi Aset', href: route('asset-mutations.index') }, { label: 'Ajukan Mutasi' }]}
                    title="Formulir Pengajuan Mutasi Aset"
                />

                <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                        <div className="border-b border-slate-100 pb-3">
                            <h2 className="text-base font-semibold text-slate-900">Informasi Dokumen &amp; Alur Mutasi</h2>
                            <p className="text-xs text-slate-500">Identitas surat pengajuan dan relasi unit kerja yang terlibat</p>
                        </div>

                        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
                            <Input
                                label="Nomor Dokumen Mutasi"
                                isRequired
                                placeholder="MUT/YYYYMMDD/XXXX"
                                value={form.data.nomor_mutasi}
                                onChange={(v) => form.setData('nomor_mutasi', v)}
                                isInvalid={Boolean(errors.nomor_mutasi)}
                                hint={errors.nomor_mutasi}
                            />
                            <Input
                                label="Tanggal Mutasi"
                                type="date"
                                isRequired
                                value={form.data.tanggal_mutasi}
                                onChange={(v) => form.setData('tanggal_mutasi', v)}
                                isInvalid={Boolean(errors.tanggal_mutasi)}
                                hint={errors.tanggal_mutasi}
                            />
                            <Select
                                label="Jenis Mutasi"
                                isRequired
                                items={originUnit?.type === 'kecamatan' ? KECAMATAN_TYPES : KELURAHAN_TYPES}
                                selectedKey={form.data.jenis_mutasi}
                                onSelectionChange={(key) => handleTypeChange(String(key) as MutationType)}
                                isInvalid={Boolean(errors.jenis_mutasi)}
                                hint={
                                    errors.jenis_mutasi ??
                                    (isReturn
                                        ? 'Aset kembali menjadi stok unit setelah disetujui. Untuk memindahkan langsung ke pegawai lain gunakan Mutasi Internal.'
                                        : undefined)
                                }
                            >
                                {(item) => <Select.Item id={item.id} label={item.label} />}
                            </Select>
                            <Select
                                label="Unit Asal"
                                isRequired
                                items={units.map((u) => ({ id: String(u.id), label: u.name }))}
                                selectedKey={String(form.data.origin_unit_id)}
                                isDisabled={units.length <= 1}
                                onSelectionChange={(key) => {
                                    const newOriginId = Number(key);
                                    form.setData((d) => ({
                                        ...d,
                                        origin_unit_id: newOriginId,
                                        destination_unit_id: d.jenis_mutasi === 'internal' || d.jenis_mutasi === 'pengembalian' ? newOriginId : '',
                                        items: [{ ...EMPTY_ITEM }],
                                    }));
                                }}
                            >
                                {(item) => <Select.Item id={item.id} label={item.label} />}
                            </Select>

                            {!sameUnit && (
                                <div className="md:col-span-2">
                                    <Select
                                        label="Unit Tujuan"
                                        isRequired
                                        placeholder="Pilih unit tujuan..."
                                        items={destinationOptions.map((u) => ({ id: String(u.id), label: `${u.name} (${u.type})` }))}
                                        selectedKey={form.data.destination_unit_id ? String(form.data.destination_unit_id) : null}
                                        onSelectionChange={(key) => form.setData('destination_unit_id', String(key))}
                                        isInvalid={Boolean(errors.destination_unit_id)}
                                        hint={errors.destination_unit_id}
                                    >
                                        {(item) => <Select.Item id={item.id} label={item.label} />}
                                    </Select>
                                </div>
                            )}

                            <div className="md:col-span-2">
                                <TextArea
                                    label={`Keterangan / Alasan ${isReturn ? 'Pengembalian' : 'Mutasi'}`}
                                    isRequired={isReturn}
                                    rows={2}
                                    placeholder="Tuliskan catatan atau latar belakang pengalihan aset ini..."
                                    value={form.data.keterangan}
                                    onChange={(v) => form.setData('keterangan', v)}
                                    isInvalid={Boolean(errors.keterangan)}
                                    hint={errors.keterangan}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                        <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-base font-semibold text-slate-900">Daftar Aset yang Dimutasi</h2>
                                <p className="text-xs text-slate-500">
                                    Pilih barang aktif yang akan diserahterimakan (tersedia {availableAssets.length} aset aktif di {originUnit?.name}).
                                </p>
                            </div>
                            {hasSelectedAssets && (
                                <Button color="primary-sky" size="md" iconLeading={Plus} onPress={() => setIsModalOpen(true)}>
                                    Tambah / Ubah Pilihan Aset
                                </Button>
                            )}
                        </div>

                        {errors.items && <p className="mt-3 text-xs font-medium text-red-600">{errors.items}</p>}

                        {!hasSelectedAssets ? (
                            <div className="mt-6 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-8 text-center">
                                <h3 className="text-base font-bold text-slate-900">Belum Ada Aset yang Dipilih</h3>
                                <p className="mt-1 max-w-md text-xs text-slate-500">
                                    Pilih satu atau beberapa aset aktif di {originUnit?.name ?? 'unit asal'} yang akan dialihkan ke unit tujuan.
                                </p>
                                <Button className="mt-4" color="primary" size="md" iconLeading={Plus} onPress={() => setIsModalOpen(true)}>
                                    Buka Daftar &amp; Pilih Aset ({availableAssets.length} Tersedia)
                                </Button>
                            </div>
                        ) : (
                            <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                                <Table aria-label="Aset yang akan dimutasi" size="sm">
                                    <Table.Header>
                                        <Table.Head id="aset" label="Barang / Aset" isRowHeader />
                                        <Table.Head id="asal" label="Pemegang Asal" />
                                        {!isReturn && <Table.Head id="baru" label="Pemegang Baru di Tujuan" />}
                                        <Table.Head id="catatan" label="Catatan Barang" />
                                        <Table.Head id="aksi" label="Aksi" />
                                    </Table.Header>
                                    <Table.Body items={form.data.items.filter((item) => assets.some((a) => a.id === Number(item.asset_id)))}>
                                        {(item) => {
                                            const idx = form.data.items.indexOf(item);
                                            const selectedAsset = assets.find((a) => a.id === Number(item.asset_id))!;
                                            const holderError = errors[`items.${idx}.target_holder_id`];

                                            return (
                                                <Table.Row id={selectedAsset.id}>
                                                    <Table.Cell>
                                                        <span className="font-semibold text-slate-900">{selectedAsset.nama_aset}</span>
                                                        <span className="mt-0.5 block text-xs text-slate-500">
                                                            <span className="font-mono">{selectedAsset.kode_barang}</span> • Reg. #
                                                            {String(selectedAsset.nomor_register).padStart(4, '0')}
                                                            {selectedAsset.merk_type && <> • {selectedAsset.merk_type}</>}
                                                        </span>
                                                    </Table.Cell>
                                                    <Table.Cell className="whitespace-nowrap text-xs">
                                                        {selectedAsset.current_holder ? (
                                                            <span className="font-medium text-slate-800">{selectedAsset.current_holder.nama}</span>
                                                        ) : (
                                                            <span className="italic text-slate-400">Inventaris Unit</span>
                                                        )}
                                                    </Table.Cell>
                                                    {!isReturn && (
                                                        <Table.Cell className="min-w-56">
                                                            <Select
                                                                aria-label={`Pemegang baru ${selectedAsset.nama_aset}`}
                                                                size="sm"
                                                                placeholder="Pilih pegawai baru"
                                                                items={[
                                                                    ...(isInternal ? [] : [{ id: NONE, label: 'Inventaris Unit' }]),
                                                                    ...targetPegawaiOptions.map((p) => ({ id: String(p.id), label: `${p.nama} (${p.jabatan})` })),
                                                                ]}
                                                                selectedKey={item.target_holder_id ? String(item.target_holder_id) : isInternal ? null : NONE}
                                                                onSelectionChange={(key) => updateItem(idx, 'target_holder_id', key === NONE ? '' : String(key))}
                                                                isInvalid={Boolean(holderError)}
                                                                hint={holderError}
                                                            >
                                                                {(opt) => <Select.Item id={opt.id} label={opt.label} />}
                                                            </Select>
                                                        </Table.Cell>
                                                    )}
                                                    <Table.Cell className="min-w-48">
                                                        <Input
                                                            aria-label={`Catatan ${selectedAsset.nama_aset}`}
                                                            size="sm"
                                                            placeholder="Catatan kondisi/kelengkapan..."
                                                            value={item.catatan}
                                                            onChange={(v) => updateItem(idx, 'catatan', v)}
                                                        />
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <Button
                                                            color="primary-destructive"
                                                            size="sm"
                                                            iconLeading={Trash01}
                                                            aria-label={`Hapus ${selectedAsset.nama_aset} dari mutasi`}
                                                            onPress={() => removeItem(idx)}
                                                        />
                                                    </Table.Cell>
                                                </Table.Row>
                                            );
                                        }}
                                    </Table.Body>
                                </Table>
                            </div>
                        )}
                    </div>

                    <div className="sticky bottom-0 z-20 -mx-6 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur-xs lg:-mx-8 lg:px-8">
                        <div className="flex items-center justify-between gap-3">
                            <p role="alert" className="text-sm font-medium text-red-600">
                                {errorCount > 0 && `${errorCount} isian perlu diperbaiki`}
                            </p>
                            <div className="flex items-center gap-3">
                                <Button color="secondary" size="md" href={route('asset-mutations.index')}>
                                    Batal
                                </Button>
                                <Button color="primary" size="md" isLoading={form.processing} onPress={submit}>
                                    Kirim Pengajuan Mutasi
                                </Button>
                            </div>
                        </div>
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
