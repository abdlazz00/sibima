import AssetSelectModal, { SelectableAsset } from '@/Components/AssetSelectModal';
import PageHeader from '@/Components/PageHeader';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import { Label } from '@/Components/ui/base/input/label';
import { RadioButton, RadioGroup } from '@/Components/ui/base/radio-buttons/radio-buttons';
import { Select } from '@/Components/ui/base/select/select';
import { TextArea } from '@/Components/ui/base/textarea/textarea';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_BADGE_COLOR, KONDISI_LABEL, REPORT_TYPE_LABEL } from '@/lib/assetReport';
import { AssetReportType, PageProps } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { Plus, UploadCloud02 } from '@untitledui/icons';
import { useMemo, useRef, useState } from 'react';

interface ReportableAsset {
    id: number;
    kode_barang: string;
    nomor_register: number | string;
    nama_aset: string;
    merk_type: string | null;
    kondisi: string;
    holder: string | null;
}

interface CreateProps extends PageProps {
    assets: ReportableAsset[];
    kondisiOptions: { value: string; label: string }[];
}

export default function Create({ assets, kondisiOptions }: CreateProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const form = useForm({
        asset_id: '',
        jenis: 'rusak' as AssetReportType,
        kondisi_baru: 'rusak_ringan',
        tanggal_kejadian: new Date().toISOString().slice(0, 10),
        kronologi: '',
        photos: [] as File[],
    });

    const selectableAssets: SelectableAsset[] = useMemo(() => {
        return assets.map((a) => ({
            id: a.id,
            kode_barang: a.kode_barang,
            nomor_register: a.nomor_register,
            nama_aset: a.nama_aset,
            merk_type: a.merk_type,
            kondisi: a.kondisi,
            holder: a.holder,
        }));
    }, [assets]);

    const asset = assets.find((a) => String(a.id) === form.data.asset_id);
    const photoError = Object.entries(form.errors).find(([key]) => key.startsWith('photos'))?.[1];
    const isRusak = form.data.jenis === 'rusak';

    const submit = () => {
        form.transform((data) => ({ ...data, kondisi_baru: data.jenis === 'rusak' ? data.kondisi_baru : '' }));
        form.post(route('asset-reports.store'), { forceFormData: true });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Buat Laporan Rusak/Hilang" />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Lapor Rusak/Hilang', href: route('asset-reports.index') }, { label: 'Buat Laporan' }]}
                    title="Buat Laporan Rusak/Hilang"
                />

                <form onSubmit={(e) => e.preventDefault()} className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                    <div className="space-y-1.5">
                        <Label isRequired>Aset yang Dilaporkan</Label>
                        {assets.length === 0 ? (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
                                Tidak ada aset yang dapat dilaporkan di unit Anda.
                            </div>
                        ) : !asset ? (
                            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
                                <p className="text-sm font-semibold text-slate-800">Belum ada aset yang dipilih</p>
                                <p className="mt-1 text-xs text-slate-500">
                                    Buka tabel daftar aset untuk memilih aset yang mengalami kerusakan atau kehilangan
                                </p>
                                <Button className="mt-3" color="primary" size="md" iconLeading={Plus} onPress={() => setIsModalOpen(true)}>
                                    Pilih Aset yang Dilaporkan
                                </Button>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs font-semibold text-slate-600">{asset.kode_barang}</span>
                                            <Badge type="color" size="sm" color="gray" className="rounded-sm">
                                                Reg. #{String(asset.nomor_register).padStart(4, '0')}
                                            </Badge>
                                        </div>
                                        <h3 className="mt-1 text-base font-bold text-slate-900">{asset.nama_aset}</h3>
                                        <p className="text-xs text-slate-500">{asset.merk_type || '—'}</p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-4">
                                        <div className="text-left sm:text-right">
                                            <p className="text-[11px] font-medium text-slate-500">Kondisi Saat Ini</p>
                                            <Badge type="color" size="sm" color={KONDISI_BADGE_COLOR[asset.kondisi] ?? 'gray'} className="mt-0.5 rounded-sm">
                                                {KONDISI_LABEL[asset.kondisi] ?? asset.kondisi}
                                            </Badge>
                                        </div>
                                        <div className="text-left sm:text-right">
                                            <p className="text-[11px] font-medium text-slate-500">Pemegang</p>
                                            <span className="mt-0.5 inline-block text-xs font-semibold text-slate-800">{asset.holder ?? 'Inventaris Unit'}</span>
                                        </div>
                                        <Button color="secondary-brand" size="sm" onPress={() => setIsModalOpen(true)}>
                                            Ganti Aset
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                        {form.errors.asset_id && <p className="text-xs font-medium text-red-600">{form.errors.asset_id}</p>}
                    </div>

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <RadioGroup
                            isRequired
                            className="gap-2"
                            value={form.data.jenis}
                            onChange={(v) => form.setData('jenis', v as AssetReportType)}
                            isInvalid={Boolean(form.errors.jenis)}
                        >
                            <Label isRequired>Jenis Laporan</Label>
                            <div className="flex gap-6">
                                {(['rusak', 'hilang'] as AssetReportType[]).map((j) => (
                                    <RadioButton key={j} value={j} label={REPORT_TYPE_LABEL[j]} />
                                ))}
                            </div>
                            {form.errors.jenis && <p className="text-xs text-red-600">{form.errors.jenis}</p>}
                        </RadioGroup>
                        {isRusak && (
                            <Select
                                label="Kondisi Baru"
                                isRequired
                                items={kondisiOptions.map((o) => ({ id: o.value, label: o.label }))}
                                selectedKey={form.data.kondisi_baru}
                                onSelectionChange={(key) => form.setData('kondisi_baru', String(key))}
                                isInvalid={Boolean(form.errors.kondisi_baru)}
                                hint={form.errors.kondisi_baru}
                            >
                                {(item) => <Select.Item id={item.id} label={item.label} />}
                            </Select>
                        )}
                    </div>

                    <div className="max-w-xs">
                        <Input
                            label="Tanggal Kejadian"
                            type="date"
                            isRequired
                            value={form.data.tanggal_kejadian}
                            onChange={(v) => form.setData('tanggal_kejadian', v)}
                            isInvalid={Boolean(form.errors.tanggal_kejadian)}
                            hint={form.errors.tanggal_kejadian ?? 'Tidak boleh di masa depan.'}
                        />
                    </div>

                    <TextArea
                        label="Kronologi"
                        isRequired
                        rows={4}
                        placeholder="Jelaskan kejadian, waktu, dan penyebabnya."
                        value={form.data.kronologi}
                        onChange={(v) => form.setData('kronologi', v)}
                        isInvalid={Boolean(form.errors.kronologi)}
                        hint={form.errors.kronologi}
                    />

                    <div className="space-y-1.5">
                        <Label isRequired={isRusak}>Foto Pendukung {isRusak ? '(minimal 1)' : '(opsional)'}</Label>
                        <input
                            type="file"
                            ref={fileInputRef}
                            multiple
                            accept=".jpg,.jpeg,.png,.webp"
                            className="hidden"
                            onChange={(e) => form.setData('photos', Array.from(e.target.files ?? []))}
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 p-6 text-center outline-hidden hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
                        >
                            <UploadCloud02 className="size-6 text-slate-400" aria-hidden="true" />
                            <span className="text-sm font-medium text-slate-900">Klik untuk unggah foto (JPG/PNG/WEBP)</span>
                            <span className="text-xs text-slate-500">Maks. 10 foto, 5MB per foto</span>
                        </button>
                        {form.data.photos.length > 0 && (
                            <ul className="space-y-1 text-xs text-slate-600">
                                {form.data.photos.map((f, i) => (
                                    <li key={i}>{f.name}</li>
                                ))}
                            </ul>
                        )}
                        {photoError && <p className="text-xs text-red-600">{photoError}</p>}
                    </div>

                    <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                        <Button color="secondary" size="md" href={route('asset-reports.index')}>
                            Batal
                        </Button>
                        <Button color="primary" size="md" isLoading={form.processing} isDisabled={!form.data.asset_id} onPress={submit}>
                            Ajukan Laporan
                        </Button>
                    </div>
                </form>
            </div>

            <AssetSelectModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                assets={selectableAssets}
                selectedIds={form.data.asset_id ? [Number(form.data.asset_id)] : []}
                onConfirm={(confirmed) => {
                    if (confirmed.length > 0) {
                        form.setData('asset_id', String(confirmed[0].id));
                    }
                    setIsModalOpen(false);
                }}
                mode="single"
                title="Pilih Aset yang Dilaporkan"
                description="Pilih 1 aset dari tabel di bawah ini yang mengalami kerusakan atau kehilangan."
            />
        </AuthenticatedLayout>
    );
}
