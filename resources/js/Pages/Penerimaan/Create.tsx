import { ChevronRightIcon as ChevronRight, PlusIcon as Plus, TrashIcon as Trash, UploadIcon as Upload } from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AssetCategory, PageProps } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

interface CreateProps extends PageProps {
    categories: AssetCategory[];
    kondisiOptions: { value: string; label: string }[];
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

export default function Create({ categories, kondisiOptions }: CreateProps) {
    const form = useForm({
        no_berita_acara: '',
        tanggal_penerimaan: '',
        sumber_perolehan: '',
        no_kontrak_spk: '',
        vendor: '',
        catatan: '',
        status: 'draft' as 'draft' | 'submitted',
        items: [EMPTY_ITEM] as ItemForm[],
        dokumen: [] as File[],
    });

    const updateItem = (index: number, field: keyof ItemForm, value: string) => {
        const items = [...form.data.items];
        items[index] = { ...items[index], [field]: value };
        form.setData('items', items);
    };

    const addItem = () => form.setData('items', [...form.data.items, EMPTY_ITEM]);

    const removeItem = (index: number) => form.setData('items', form.data.items.filter((_, i) => i !== index));

    const itemError = (index: number, field: keyof ItemForm): string | undefined =>
        (form.errors as Record<string, string>)[`items.${index}.${field}`];

    const submit = (status: 'draft' | 'submitted') => (e: FormEvent) => {
        e.preventDefault();
        form.transform((data) => ({ ...data, status }));
        form.post(route('penerimaan-aset.store'), { forceFormData: true });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Formulir Penerimaan Aset Baru" />

            <div className="space-y-6">
                <div>
                    <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Link href={route('dashboard')} className="hover:text-blue-700">Home</Link>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <Link href={route('penerimaan-aset.index')} className="hover:text-blue-700">Penerimaan Aset</Link>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span className="font-medium text-slate-800">Ajukan Penerimaan</span>
                    </nav>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Formulir Penerimaan Aset Baru</h1>
                </div>

                <form className="space-y-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <section className="space-y-4">
                        <h2 className="text-base font-semibold text-slate-900">Section 1: Informasi Berita Acara</h2>
                        <div className="grid grid-cols-2 gap-5">
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-900">No. Berita Acara *</label>
                                <input
                                    type="text"
                                    value={form.data.no_berita_acara}
                                    onChange={(e) => form.setData('no_berita_acara', e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                    placeholder="BA/xxx/xxx/2025"
                                />
                                {form.errors.no_berita_acara && <p className="mt-1 text-xs text-red-600">{form.errors.no_berita_acara}</p>}
                            </div>
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-900">Tanggal Penerimaan *</label>
                                <input
                                    type="date"
                                    value={form.data.tanggal_penerimaan}
                                    onChange={(e) => form.setData('tanggal_penerimaan', e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                />
                                {form.errors.tanggal_penerimaan && <p className="mt-1 text-xs text-red-600">{form.errors.tanggal_penerimaan}</p>}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-5">
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-900">Sumber Perolehan</label>
                                <input
                                    type="text"
                                    value={form.data.sumber_perolehan}
                                    onChange={(e) => form.setData('sumber_perolehan', e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                    placeholder="mis. APBD, Hibah"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-900">No. Kontrak/SPK *</label>
                                <input
                                    type="text"
                                    value={form.data.no_kontrak_spk}
                                    onChange={(e) => form.setData('no_kontrak_spk', e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                />
                                {form.errors.no_kontrak_spk && <p className="mt-1 text-xs text-red-600">{form.errors.no_kontrak_spk}</p>}
                            </div>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-slate-900">Vendor/Penyedia</label>
                            <input
                                type="text"
                                value={form.data.vendor}
                                onChange={(e) => form.setData('vendor', e.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                    </section>

                    <hr className="border-slate-200" />

                    <section className="space-y-4">
                        <h2 className="text-base font-semibold text-slate-900">Section 2: Data Aset yang Diterima</h2>
                        {form.data.items.map((item, index) => (
                            <div key={index} className="space-y-4 rounded-lg bg-slate-50 p-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-bold text-blue-700">Aset #{index + 1}</p>
                                    {form.data.items.length > 1 && (
                                        <button type="button" onClick={() => removeItem(index)} className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-red-600">
                                            <Trash className="h-3.5 w-3.5" /> Hapus
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-slate-900">Nama Barang *</label>
                                        <input
                                            type="text"
                                            value={item.nama_aset}
                                            onChange={(e) => updateItem(index, 'nama_aset', e.target.value)}
                                            className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                                        />
                                        {itemError(index, 'nama_aset') && <p className="mt-1 text-xs text-red-600">{itemError(index, 'nama_aset')}</p>}
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-slate-900">Merk/Tipe</label>
                                        <input
                                            type="text"
                                            value={item.merk_type}
                                            onChange={(e) => updateItem(index, 'merk_type', e.target.value)}
                                            className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-slate-900">Subkategori *</label>
                                        <select
                                            value={item.category_id}
                                            onChange={(e) => updateItem(index, 'category_id', e.target.value)}
                                            className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                                        >
                                            <option value="">Pilih subkategori...</option>
                                            {categories.map((c) => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                        {itemError(index, 'category_id') && <p className="mt-1 text-xs text-red-600">{itemError(index, 'category_id')}</p>}
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-slate-900">Kondisi Awal *</label>
                                        <select
                                            value={item.kondisi_awal}
                                            onChange={(e) => updateItem(index, 'kondisi_awal', e.target.value)}
                                            className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                                        >
                                            {kondisiOptions.map((o) => (
                                                <option key={o.value} value={o.value}>{o.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-slate-900">Jumlah Unit *</label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={item.jumlah_unit}
                                            onChange={(e) => updateItem(index, 'jumlah_unit', e.target.value)}
                                            className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                                        />
                                        {itemError(index, 'jumlah_unit') && <p className="mt-1 text-xs text-red-600">{itemError(index, 'jumlah_unit')}</p>}
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-slate-900">Nilai per Unit (Rp) *</label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={item.nilai_per_unit}
                                            onChange={(e) => updateItem(index, 'nilai_per_unit', e.target.value)}
                                            className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                                        />
                                        {itemError(index, 'nilai_per_unit') && <p className="mt-1 text-xs text-red-600">{itemError(index, 'nilai_per_unit')}</p>}
                                    </div>
                                </div>
                            </div>
                        ))}
                        <button type="button" onClick={addItem} className="flex items-center gap-1.5 text-sm font-semibold text-blue-700">
                            <Plus className="h-3.5 w-3.5" /> Tambah Barang Lain
                        </button>
                    </section>

                    <hr className="border-slate-200" />

                    <section className="space-y-4">
                        <h2 className="text-base font-semibold text-slate-900">Section 3: Dokumen Pendukung</h2>
                        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 p-6 text-center hover:bg-slate-50">
                            <Upload className="h-6 w-6 text-slate-400" />
                            <span className="text-sm font-medium text-slate-900">Klik untuk unggah dokumen Berita Acara (PDF/JPG)</span>
                            <span className="text-xs text-slate-500">Maks. 5MB per file</span>
                            <input
                                type="file"
                                multiple
                                accept=".pdf,.jpg,.jpeg,.png"
                                className="hidden"
                                onChange={(e) => form.setData('dokumen', Array.from(e.target.files ?? []))}
                            />
                        </label>
                        {form.data.dokumen.length > 0 && (
                            <ul className="space-y-1 text-xs text-slate-600">
                                {form.data.dokumen.map((file, i) => <li key={i}>{file.name}</li>)}
                            </ul>
                        )}

                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-slate-900">Catatan / Keterangan</label>
                            <textarea
                                value={form.data.catatan}
                                onChange={(e) => form.setData('catatan', e.target.value)}
                                rows={3}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                    </section>

                    <div className="flex items-center justify-end gap-3">
                        <button
                            type="button"
                            disabled={form.processing}
                            onClick={submit('draft')}
                            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                            Simpan Draft
                        </button>
                        <button
                            type="button"
                            disabled={form.processing}
                            onClick={submit('submitted')}
                            className="rounded-lg bg-[#1E40AF] px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                        >
                            Ajukan Penerimaan
                        </button>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
