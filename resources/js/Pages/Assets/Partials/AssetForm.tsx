import { UploadIcon as CloudUpload, PlusIcon as Plus, XIcon as X } from '@/Components/Icons';
import InputError from '@/Components/InputError';
import { AssetCategory, AssetPhoto } from '@/types';
import { InertiaFormProps } from '@inertiajs/react';
import { ChangeEvent, FormEvent, useRef } from 'react';

export type AssetFormData = {
    category_id: number | '';
    kode_barang: string;
    nama_aset: string;
    merk_type: string;
    kondisi?: string;
    tanggal_perolehan: string;
    sumber_perolehan: string;
    nilai_perolehan: string;
    nilai_buku: string;
    no_dokumen: string;
    keterangan: string;
    photos: File[];
};

type Props = {
    form: InertiaFormProps<AssetFormData>;
    categories: AssetCategory[];
    kondisiOptions?: { value: string; label: string }[];
    maxPhotos: number;
    existingPhotos?: AssetPhoto[];
    onRemoveExistingPhoto?: (photo: AssetPhoto) => void;
    submitLabel: string;
    onSubmit: (e: FormEvent) => void;
    cancelHref: string;
};

export default function AssetForm({
    form,
    categories,
    kondisiOptions,
    maxPhotos,
    existingPhotos = [],
    onRemoveExistingPhoto,
    submitLabel,
    onSubmit,
    cancelHref,
}: Props) {
    const { data, setData, processing, errors } = form;
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handlePhotosChange = (e: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        setData('photos', [...data.photos, ...files].slice(0, maxPhotos));
    };

    const removeNewPhoto = (index: number) => {
        setData(
            'photos',
            data.photos.filter((_, i) => i !== index),
        );
    };

    const totalPhotoCount = existingPhotos.length + data.photos.length;

    return (
        <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                {/* Informasi Dasar Aset */}
                <section className="space-y-4">
                    <div className="border-b border-slate-100 pb-2">
                        <h2 className="text-base font-semibold text-slate-900">Informasi Dasar Aset</h2>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700">
                                Subkategori Aset <span className="text-rose-600">*</span>
                            </label>
                            <select
                                value={data.category_id}
                                onChange={(e) => setData('category_id', e.target.value ? Number(e.target.value) : '')}
                                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                required
                            >
                                <option value="">Pilih subkategori...</option>
                                {categories.map((kategori) => (
                                    <optgroup key={kategori.id} label={kategori.name}>
                                        {(kategori.children ?? []).map((sub) => (
                                            <option key={sub.id} value={sub.id}>
                                                {sub.name}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                            <InputError message={errors.category_id} className="mt-1" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-700">
                                Kode Barang BMD <span className="text-rose-600">*</span>
                            </label>
                            <input
                                type="text"
                                value={data.kode_barang}
                                onChange={(e) => setData('kode_barang', e.target.value)}
                                placeholder="1.3.2.05.02.04.xxx"
                                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 font-mono text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                required
                            />
                            <InputError message={errors.kode_barang} className="mt-1" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-700">
                                Nama Barang <span className="text-rose-600">*</span>
                            </label>
                            <input
                                type="text"
                                value={data.nama_aset}
                                onChange={(e) => setData('nama_aset', e.target.value)}
                                placeholder="Masukkan nama barang aset"
                                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                required
                            />
                            <InputError message={errors.nama_aset} className="mt-1" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-700">Merk / Tipe Pabrikasi</label>
                            <input
                                type="text"
                                value={data.merk_type}
                                onChange={(e) => setData('merk_type', e.target.value)}
                                placeholder="Masukkan merk atau tipe"
                                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            />
                            <InputError message={errors.merk_type} className="mt-1" />
                        </div>
                        {kondisiOptions && (
                            <div>
                                <label className="block text-xs font-semibold text-slate-700">
                                    Kondisi Saat Dicatat <span className="text-rose-600">*</span>
                                </label>
                                <select
                                    value={data.kondisi}
                                    onChange={(e) => setData('kondisi', e.target.value)}
                                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                    required
                                >
                                    {kondisiOptions.map((o) => (
                                        <option key={o.value} value={o.value}>
                                            {o.label}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={errors.kondisi} className="mt-1" />
                            </div>
                        )}
                    </div>
                </section>

                {/* Informasi Perolehan */}
                <section className="space-y-4">
                    <div className="border-b border-slate-100 pb-2">
                        <h2 className="text-base font-semibold text-slate-900">Informasi Perolehan</h2>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700">
                                Tanggal Perolehan <span className="text-rose-600">*</span>
                            </label>
                            <input
                                type="date"
                                value={data.tanggal_perolehan}
                                onChange={(e) => setData('tanggal_perolehan', e.target.value)}
                                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                required
                            />
                            <InputError message={errors.tanggal_perolehan} className="mt-1" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-700">Sumber Perolehan</label>
                            <input
                                type="text"
                                value={data.sumber_perolehan}
                                onChange={(e) => setData('sumber_perolehan', e.target.value)}
                                placeholder="mis. APBD, Hibah, Bantuan"
                                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            />
                            <InputError message={errors.sumber_perolehan} className="mt-1" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-700">
                                Nilai Perolehan (Rp) <span className="text-rose-600">*</span>
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={data.nilai_perolehan}
                                onChange={(e) => setData('nilai_perolehan', e.target.value)}
                                placeholder="Masukkan nilai perolehan"
                                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                required
                            />
                            <InputError message={errors.nilai_perolehan} className="mt-1" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-700">
                                Nilai Buku Saat Ini (Rp) <span className="text-rose-600">*</span>
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={data.nilai_buku}
                                onChange={(e) => setData('nilai_buku', e.target.value)}
                                placeholder="Masukkan nilai buku saat ini"
                                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                required
                            />
                            <InputError message={errors.nilai_buku} className="mt-1" />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-slate-700">No. Dokumen Pengadaan / BAST</label>
                            <input
                                type="text"
                                value={data.no_dokumen}
                                onChange={(e) => setData('no_dokumen', e.target.value)}
                                placeholder="Masukkan nomor dokumen pengadaan atau berita acara serah terima"
                                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            />
                            <InputError message={errors.no_dokumen} className="mt-1" />
                        </div>
                    </div>
                </section>

                {/* Foto Aset */}
                <section className="space-y-4">
                    <div className="border-b border-slate-100 pb-2">
                        <h2 className="text-base font-semibold text-slate-900">Foto Aset</h2>
                    </div>
                    <div className="space-y-3">
                        <label className="block text-xs font-semibold text-slate-700">Unggah Foto Aset</label>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handlePhotosChange}
                            accept="image/jpeg,image/png,image/webp"
                            multiple
                            className="hidden"
                        />
                        {totalPhotoCount < maxPhotos && (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center transition hover:border-blue-400 hover:bg-blue-50/30"
                            >
                                <CloudUpload className="h-8 w-8 text-slate-400" />
                                <p className="text-sm text-slate-700">
                                    <span className="font-semibold text-slate-900">Klik untuk unggah</span> atau seret foto ke sini
                                </p>
                                <p className="text-xs text-slate-500">
                                    Maksimal {maxPhotos} foto, masing-masing maks. 5MB (JPG, PNG, WebP)
                                </p>
                            </div>
                        )}
                        <InputError message={errors.photos} className="mt-1" />

                        {(existingPhotos.length > 0 || data.photos.length > 0) && (
                            <div className="flex flex-wrap gap-3">
                                {existingPhotos.map((photo) => (
                                    <div key={photo.id} className="relative h-20 w-20 shrink-0 overflow-hidden rounded bg-slate-100">
                                        <img src={photo.url} alt="" className="h-full w-full object-cover" />
                                        {onRemoveExistingPhoto && (
                                            <button
                                                type="button"
                                                onClick={() => onRemoveExistingPhoto(photo)}
                                                className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white"
                                                title="Hapus foto"
                                            >
                                                <X className="h-2.5 w-2.5" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {data.photos.map((file, idx) => (
                                    <div key={idx} className="relative h-20 w-20 shrink-0 overflow-hidden rounded bg-slate-100">
                                        <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => removeNewPhoto(idx)}
                                            className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white"
                                            title="Batalkan"
                                        >
                                            <X className="h-2.5 w-2.5" />
                                        </button>
                                    </div>
                                ))}
                                {totalPhotoCount < maxPhotos && (
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex h-20 w-20 shrink-0 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-blue-400 hover:text-blue-600"
                                    >
                                        <Plus className="h-5 w-5" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </section>

                {/* Keterangan */}
                <section className="space-y-4">
                    <div className="border-b border-slate-100 pb-2">
                        <h2 className="text-base font-semibold text-slate-900">Keterangan Tambahan</h2>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-700">Keterangan</label>
                        <textarea
                            value={data.keterangan}
                            onChange={(e) => setData('keterangan', e.target.value)}
                            placeholder="Tambahkan catatan atau keterangan tambahan mengenai kondisi detail aset..."
                            rows={4}
                            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                        <InputError message={errors.keterangan} className="mt-1" />
                    </div>
                </section>
            </div>

            <div className="flex items-center justify-end gap-3">
                <a
                    href={cancelHref}
                    className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                    Batal
                </a>
                <button
                    type="submit"
                    disabled={processing}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1E40AF] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50"
                >
                    <span>{processing ? 'Menyimpan...' : submitLabel}</span>
                </button>
            </div>
        </form>
    );
}
