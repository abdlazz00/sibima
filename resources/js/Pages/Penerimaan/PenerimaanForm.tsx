import PageHeader from '@/Components/PageHeader';
import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import { Select } from '@/Components/ui/base/select/select';
import { TextArea } from '@/Components/ui/base/textarea/textarea';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { rupiah } from '@/lib/format';
import { AssetCategory, BeritaAcaraPenerimaan, PageProps } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { Plus, Trash01, UploadCloud02 } from '@untitledui/icons';
import { useRef } from 'react';

export interface PenerimaanFormProps extends PageProps {
    categories: AssetCategory[];
    kondisiOptions: { value: string; label: string }[];
    beritaAcara?: BeritaAcaraPenerimaan;
    existingAssetNames?: Record<number, string[]>;
}

interface ItemForm {
    nama_aset: string;
    merk_type: string;
    category_id: string;
    jumlah_unit: string;
    nilai_per_unit: string;
    kondisi_awal: string;
}

const EMPTY_ITEM: ItemForm = {
    nama_aset: '',
    merk_type: '',
    category_id: '',
    jumlah_unit: '1',
    nilai_per_unit: '',
    kondisi_awal: 'baik',
};

const rupiahHint = (value: string) => (value === '' || Number.isNaN(Number(value)) ? undefined : rupiah(Number(value)));

export default function PenerimaanForm({ categories, kondisiOptions, beritaAcara, existingAssetNames = {} }: PenerimaanFormProps) {
    const isEdit = beritaAcara !== undefined;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const form = useForm({
        no_berita_acara: beritaAcara?.no_berita_acara ?? '',
        tanggal_penerimaan: beritaAcara?.tanggal_penerimaan?.slice(0, 10) ?? '',
        sumber_perolehan: beritaAcara?.sumber_perolehan ?? '',
        no_kontrak_spk: beritaAcara?.no_kontrak_spk ?? '',
        vendor: beritaAcara?.vendor ?? '',
        catatan: beritaAcara?.catatan ?? '',
        status: 'draft' as 'draft' | 'submitted',
        items: (beritaAcara?.items?.map((i) => ({
            nama_aset: i.nama_aset,
            merk_type: i.merk_type ?? '',
            category_id: String(i.category_id),
            jumlah_unit: String(i.jumlah_unit),
            nilai_per_unit: String(Math.round(Number(i.nilai_per_unit))),
            kondisi_awal: i.kondisi_awal,
        })) ?? [EMPTY_ITEM]) as ItemForm[],
        dokumen: [] as File[],
        hapus_dokumen: [] as number[],
    });

    const errors = form.errors as Record<string, string>;
    const errorCount = Object.keys(errors).length;

    const toggleHapusDokumen = (id: number) =>
        form.setData('hapus_dokumen', form.data.hapus_dokumen.includes(id) ? form.data.hapus_dokumen.filter((d) => d !== id) : [...form.data.hapus_dokumen, id]);

    const updateItem = (index: number, field: keyof ItemForm, value: string) => {
        const items = [...form.data.items];
        items[index] = { ...items[index], [field]: value };
        form.setData('items', items);
    };

    const addItem = () => form.setData('items', [...form.data.items, EMPTY_ITEM]);

    const removeItem = (index: number) => form.setData('items', form.data.items.filter((_, i) => i !== index));

    const itemError = (index: number, field: keyof ItemForm): string | undefined => errors[`items.${index}.${field}`];

    const send = (status: 'draft' | 'submitted') => {
        // PHP does not parse multipart bodies on PUT, so edits are POSTed with method spoofing.
        form.transform((data) => (isEdit ? { ...data, status, _method: 'put' } : { ...data, status }));
        form.post(isEdit ? route('penerimaan-aset.update', beritaAcara.id) : route('penerimaan-aset.store'), { forceFormData: true });
    };

    return (
        <AuthenticatedLayout>
            <Head title={isEdit ? 'Edit Draft Penerimaan Aset' : 'Formulir Penerimaan Aset Baru'} />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Penerimaan Aset', href: route('penerimaan-aset.index') }, { label: isEdit ? 'Edit Draft' : 'Ajukan Penerimaan' }]}
                    title={isEdit ? `Edit Draft #${beritaAcara.no_berita_acara}` : 'Formulir Penerimaan Aset Baru'}
                />

                <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
                    <div className="space-y-8 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                        <section className="space-y-4">
                            <h2 className="text-base font-semibold text-slate-900">1. Informasi Berita Acara</h2>
                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                <Input
                                    label="No. Berita Acara"
                                    isRequired
                                    placeholder="BA/xxx/xxx/2025"
                                    value={form.data.no_berita_acara}
                                    onChange={(v) => form.setData('no_berita_acara', v)}
                                    isInvalid={Boolean(errors.no_berita_acara)}
                                    hint={errors.no_berita_acara}
                                />
                                <Input
                                    label="Tanggal Penerimaan"
                                    type="date"
                                    isRequired
                                    value={form.data.tanggal_penerimaan}
                                    onChange={(v) => form.setData('tanggal_penerimaan', v)}
                                    isInvalid={Boolean(errors.tanggal_penerimaan)}
                                    hint={errors.tanggal_penerimaan}
                                />
                                <Input
                                    label="Sumber Perolehan"
                                    placeholder="mis. APBD, Hibah"
                                    value={form.data.sumber_perolehan}
                                    onChange={(v) => form.setData('sumber_perolehan', v)}
                                    isInvalid={Boolean(errors.sumber_perolehan)}
                                    hint={errors.sumber_perolehan}
                                />
                                <Input
                                    label="No. Kontrak/SPK"
                                    isRequired
                                    value={form.data.no_kontrak_spk}
                                    onChange={(v) => form.setData('no_kontrak_spk', v)}
                                    isInvalid={Boolean(errors.no_kontrak_spk)}
                                    hint={errors.no_kontrak_spk}
                                />
                            </div>
                            <Input
                                label="Vendor/Penyedia"
                                value={form.data.vendor}
                                onChange={(v) => form.setData('vendor', v)}
                                isInvalid={Boolean(errors.vendor)}
                                hint={errors.vendor}
                            />
                        </section>

                        <hr className="border-slate-200" />

                        <section className="space-y-4">
                            <h2 className="text-base font-semibold text-slate-900">2. Data Aset yang Diterima</h2>
                            {form.data.items.map((item, index) => (
                                <div key={index} className="space-y-4 rounded-lg bg-slate-50 p-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-bold text-blue-700">Aset #{index + 1}</p>
                                        {form.data.items.length > 1 && (
                                            <Button
                                                color="primary-destructive"
                                                size="sm"
                                                iconLeading={Trash01}
                                                aria-label={`Hapus aset ${index + 1}`}
                                                onPress={() => removeItem(index)}
                                            >
                                                Hapus
                                            </Button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <Input
                                            label="Nama Barang"
                                            isRequired
                                            list={item.category_id ? `asset-suggestions-${item.category_id}` : undefined}
                                            placeholder="Contoh: Lap Top, P.C Unit, Printer"
                                            value={item.nama_aset}
                                            onChange={(v) => updateItem(index, 'nama_aset', v)}
                                            isInvalid={Boolean(itemError(index, 'nama_aset'))}
                                            hint={itemError(index, 'nama_aset') ?? 'Ketik nama baru atau pilih saran dari aset yang sudah ada agar terstandar.'}
                                        />
                                        <Input
                                            label="Merk/Tipe"
                                            placeholder="Contoh: Asus Vivobook 14, Epson L3210"
                                            value={item.merk_type}
                                            onChange={(v) => updateItem(index, 'merk_type', v)}
                                            isInvalid={Boolean(itemError(index, 'merk_type'))}
                                            hint={itemError(index, 'merk_type')}
                                        />
                                        <Select
                                            label="Subkategori"
                                            isRequired
                                            placeholder="Pilih subkategori..."
                                            items={categories.map((c) => ({ id: String(c.id), label: c.name }))}
                                            selectedKey={item.category_id || null}
                                            onSelectionChange={(key) => updateItem(index, 'category_id', String(key))}
                                            isInvalid={Boolean(itemError(index, 'category_id'))}
                                            hint={itemError(index, 'category_id')}
                                        >
                                            {(opt) => <Select.Item id={opt.id} label={opt.label} />}
                                        </Select>
                                        <Select
                                            label="Kondisi Awal"
                                            isRequired
                                            items={kondisiOptions.map((o) => ({ id: o.value, label: o.label }))}
                                            selectedKey={item.kondisi_awal}
                                            onSelectionChange={(key) => updateItem(index, 'kondisi_awal', String(key))}
                                            isInvalid={Boolean(itemError(index, 'kondisi_awal'))}
                                            hint={itemError(index, 'kondisi_awal')}
                                        >
                                            {(opt) => <Select.Item id={opt.id} label={opt.label} />}
                                        </Select>
                                        <Input
                                            label="Jumlah Unit"
                                            type="number"
                                            inputMode="numeric"
                                            isRequired
                                            inputClassName="tabular-nums"
                                            value={item.jumlah_unit}
                                            onChange={(v) => updateItem(index, 'jumlah_unit', v)}
                                            isInvalid={Boolean(itemError(index, 'jumlah_unit'))}
                                            hint={itemError(index, 'jumlah_unit')}
                                        />
                                        <Input
                                            label="Nilai per Unit (Rp)"
                                            type="number"
                                            inputMode="numeric"
                                            isRequired
                                            inputClassName="tabular-nums"
                                            value={item.nilai_per_unit}
                                            onChange={(v) => updateItem(index, 'nilai_per_unit', v)}
                                            isInvalid={Boolean(itemError(index, 'nilai_per_unit'))}
                                            hint={itemError(index, 'nilai_per_unit') ?? rupiahHint(item.nilai_per_unit)}
                                        />
                                    </div>
                                </div>
                            ))}
                            <Button color="primary-sky" size="md" iconLeading={Plus} onPress={addItem}>
                                Tambah Barang Lain
                            </Button>

                            {Object.entries(existingAssetNames).map(([catId, names]) => (
                                <datalist key={catId} id={`asset-suggestions-${catId}`}>
                                    {names.map((name) => (
                                        <option key={name} value={name} />
                                    ))}
                                </datalist>
                            ))}
                        </section>

                        <hr className="border-slate-200" />

                        <section className="space-y-4">
                            <h2 className="text-base font-semibold text-slate-900">3. Dokumen Pendukung</h2>
                            <input
                                type="file"
                                ref={fileInputRef}
                                multiple
                                accept=".pdf,.jpg,.jpeg,.png"
                                className="hidden"
                                onChange={(e) => form.setData('dokumen', Array.from(e.target.files ?? []))}
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 p-6 text-center outline-hidden hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
                            >
                                <UploadCloud02 className="size-6 text-slate-400" aria-hidden="true" />
                                <span className="text-sm font-medium text-slate-900">Klik untuk unggah dokumen Berita Acara (PDF/JPG)</span>
                                <span className="text-xs text-slate-500">Maks. 5MB per file</span>
                            </button>
                            {isEdit && (beritaAcara.photos?.length ?? 0) > 0 && (
                                <ul className="space-y-1.5 text-sm">
                                    {beritaAcara.photos?.map((photo) => (
                                        <li key={photo.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
                                            <a
                                                href={`/storage/${photo.path}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className={`truncate text-blue-700 hover:underline ${form.data.hapus_dokumen.includes(photo.id) ? 'line-through opacity-50' : ''}`}
                                            >
                                                {photo.path.split('/').pop()}
                                            </a>
                                            <Button color="link-gray" size="sm" onPress={() => toggleHapusDokumen(photo.id)}>
                                                {form.data.hapus_dokumen.includes(photo.id) ? 'Batal hapus' : 'Hapus'}
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {form.data.dokumen.length > 0 && (
                                <ul className="space-y-1 text-xs text-slate-600">
                                    {form.data.dokumen.map((file, i) => (
                                        <li key={i}>{file.name}</li>
                                    ))}
                                </ul>
                            )}

                            <TextArea
                                label="Catatan / Keterangan"
                                rows={3}
                                value={form.data.catatan}
                                onChange={(v) => form.setData('catatan', v)}
                                isInvalid={Boolean(errors.catatan)}
                                hint={errors.catatan}
                            />
                        </section>
                    </div>

                    {/* Bilah aksi lengket */}
                    <div className="sticky bottom-0 z-20 -mx-6 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur-xs lg:-mx-8 lg:px-8">
                        <div className="flex items-center justify-between gap-3">
                            <p role="alert" className="text-sm font-medium text-red-600">
                                {errorCount > 0 && `${errorCount} isian perlu diperbaiki`}
                            </p>
                            <div className="flex items-center gap-3">
                                <Button color="primary-sky" size="md" isDisabled={form.processing} onPress={() => send('draft')}>
                                    Simpan Draft
                                </Button>
                                <Button color="primary" size="md" isLoading={form.processing} onPress={() => send('submitted')}>
                                    Ajukan Penerimaan
                                </Button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
