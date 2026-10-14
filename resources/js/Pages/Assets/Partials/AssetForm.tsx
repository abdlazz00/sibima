import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import { Select } from '@/Components/ui/base/select/select';
import { TextArea } from '@/Components/ui/base/textarea/textarea';
import { AssetCategory, AssetPhoto } from '@/types';
import { InertiaFormProps } from '@inertiajs/react';
import { Plus, UploadCloud02, XClose } from '@untitledui/icons';
import { ChangeEvent, FormEvent, useEffect, useRef } from 'react';

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

const rupiah = (value: string) =>
    value === '' || Number.isNaN(Number(value))
        ? undefined
        : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value));

function SectionTitle({ children }: { children: string }) {
    return (
        <div className="border-b border-slate-100 pb-2">
            <h2 className="text-base font-semibold text-slate-900">{children}</h2>
        </div>
    );
}

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
    const formRef = useRef<HTMLFormElement>(null);
    const errorCount = Object.keys(errors).length;

    // Form panjang: setelah kirim gagal, bawa pengguna ke isian bermasalah pertama.
    useEffect(() => {
        if (errorCount === 0) return;
        const field = formRef.current?.querySelector<HTMLElement>('[data-invalid], [data-photo-error]');
        const target = field?.matches('input, textarea, button, [tabindex]')
            ? field
            : field?.querySelector<HTMLElement>('input, textarea, button');
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target?.focus({ preventScroll: true });
    }, [errors]);

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

    const categoryItems = categories.flatMap((kategori) =>
        (kategori.children ?? []).map((sub) => ({ id: sub.id, label: `${kategori.name} › ${sub.name}` })),
    );

    const photoButtonClass =
        'rounded-sm outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1';

    return (
        <form ref={formRef} onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-8 rounded-xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
                {/* Informasi Dasar Aset */}
                <section className="space-y-4">
                    <SectionTitle>Informasi Dasar Aset</SectionTitle>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Select
                            label="Subkategori Aset"
                            isRequired
                            placeholder="Pilih subkategori..."
                            popoverClassName="w-[46rem]! max-w-[calc(100vw-2rem)]"
                            items={categoryItems}
                            selectedKey={data.category_id === '' ? null : data.category_id}
                            onSelectionChange={(key) => setData('category_id', key == null ? '' : Number(key))}
                            isInvalid={Boolean(errors.category_id)}
                            hint={errors.category_id}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                        <Input
                            label="Kode Barang BMD"
                            isRequired
                            placeholder="1.3.2.05.02.04.xxx"
                            inputClassName="font-mono"
                            value={data.kode_barang}
                            onChange={(v) => setData('kode_barang', v)}
                            isInvalid={Boolean(errors.kode_barang)}
                            hint={errors.kode_barang ?? 'Format kode BMD, mis. 1.3.2.05.02.04.xxx'}
                        />
                        <Input
                            label="Nama Barang"
                            isRequired
                            placeholder="Masukkan nama barang aset"
                            value={data.nama_aset}
                            onChange={(v) => setData('nama_aset', v)}
                            isInvalid={Boolean(errors.nama_aset)}
                            hint={errors.nama_aset}
                        />
                        <Input
                            label="Merk / Tipe Pabrikasi"
                            placeholder="Masukkan merk atau tipe"
                            value={data.merk_type}
                            onChange={(v) => setData('merk_type', v)}
                            isInvalid={Boolean(errors.merk_type)}
                            hint={errors.merk_type}
                        />
                        {kondisiOptions && (
                            <Select
                                label="Kondisi Saat Dicatat"
                                isRequired
                                items={kondisiOptions.map((o) => ({ id: o.value, label: o.label }))}
                                selectedKey={data.kondisi ?? null}
                                onSelectionChange={(key) => setData('kondisi', String(key))}
                                isInvalid={Boolean(errors.kondisi)}
                                hint={errors.kondisi}
                            >
                                {(item) => <Select.Item id={item.id} label={item.label} />}
                            </Select>
                        )}
                    </div>
                </section>

                {/* Informasi Perolehan */}
                <section className="space-y-4">
                    <SectionTitle>Informasi Perolehan</SectionTitle>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input
                            label="Tanggal Perolehan"
                            type="date"
                            isRequired
                            value={data.tanggal_perolehan}
                            onChange={(v) => setData('tanggal_perolehan', v)}
                            isInvalid={Boolean(errors.tanggal_perolehan)}
                            hint={errors.tanggal_perolehan}
                        />
                        <Input
                            label="Sumber Perolehan"
                            placeholder="mis. APBD, Hibah, Bantuan"
                            value={data.sumber_perolehan}
                            onChange={(v) => setData('sumber_perolehan', v)}
                            isInvalid={Boolean(errors.sumber_perolehan)}
                            hint={errors.sumber_perolehan}
                        />
                        <Input
                            label="Nilai Perolehan (Rp)"
                            type="number"
                            inputMode="numeric"
                            isRequired
                            placeholder="Masukkan nilai perolehan"
                            inputClassName="tabular-nums"
                            value={data.nilai_perolehan}
                            onChange={(v) => setData('nilai_perolehan', v)}
                            isInvalid={Boolean(errors.nilai_perolehan)}
                            hint={errors.nilai_perolehan ?? rupiah(data.nilai_perolehan)}
                        />
                        <Input
                            label="Nilai Buku Saat Ini (Rp)"
                            type="number"
                            inputMode="numeric"
                            isRequired
                            placeholder="Masukkan nilai buku saat ini"
                            inputClassName="tabular-nums"
                            value={data.nilai_buku}
                            onChange={(v) => setData('nilai_buku', v)}
                            isInvalid={Boolean(errors.nilai_buku)}
                            hint={
                                errors.nilai_buku ??
                                [rupiah(data.nilai_buku), 'Tidak boleh melebihi nilai perolehan'].filter(Boolean).join(' · ')
                            }
                        />
                        <div className="sm:col-span-2">
                            <Input
                                label="No. Dokumen Pengadaan / BAST"
                                placeholder="Masukkan nomor dokumen pengadaan atau berita acara serah terima"
                                value={data.no_dokumen}
                                onChange={(v) => setData('no_dokumen', v)}
                                isInvalid={Boolean(errors.no_dokumen)}
                                hint={errors.no_dokumen}
                            />
                        </div>
                    </div>
                </section>

                {/* Foto Aset */}
                <section className="space-y-4">
                    <SectionTitle>Foto Aset</SectionTitle>
                    <div className="space-y-3">
                        <p className="text-sm font-medium text-slate-700">Unggah Foto Aset</p>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handlePhotosChange}
                            accept="image/jpeg,image/png,image/webp"
                            multiple
                            className="hidden"
                        />
                        {totalPhotoCount < maxPhotos && (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center outline-hidden transition hover:border-blue-400 hover:bg-blue-50/30 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
                            >
                                <UploadCloud02 className="size-8 text-slate-400" aria-hidden="true" />
                                <span className="text-sm text-slate-700">
                                    <span className="font-semibold text-slate-900">Klik untuk unggah</span> foto aset
                                </span>
                                <span className="text-xs text-slate-500">
                                    Maksimal {maxPhotos} foto, masing-masing maks. 5MB (JPG, PNG, WebP)
                                </span>
                            </button>
                        )}
                        {errors.photos && (
                            <p data-photo-error tabIndex={-1} className="text-sm text-red-600 outline-hidden">
                                {errors.photos}
                            </p>
                        )}

                        {(existingPhotos.length > 0 || data.photos.length > 0) && (
                            <div className="flex flex-wrap gap-3">
                                {existingPhotos.map((photo) => (
                                    <div key={photo.id} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-sm bg-slate-100">
                                        <img src={photo.url} alt="" className="h-full w-full object-cover" />
                                        {onRemoveExistingPhoto && (
                                            <button
                                                type="button"
                                                onClick={() => onRemoveExistingPhoto(photo)}
                                                className={`absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-red-500 text-white before:absolute before:-inset-1.5 ${photoButtonClass}`}
                                                aria-label="Hapus foto"
                                            >
                                                <XClose className="size-3" aria-hidden="true" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {data.photos.map((file, idx) => (
                                    <div key={idx} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-sm bg-slate-100">
                                        <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => removeNewPhoto(idx)}
                                            className={`absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-red-500 text-white before:absolute before:-inset-1.5 ${photoButtonClass}`}
                                            aria-label="Batalkan foto"
                                        >
                                            <XClose className="size-3" aria-hidden="true" />
                                        </button>
                                    </div>
                                ))}
                                {totalPhotoCount < maxPhotos && (
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        aria-label="Tambah foto"
                                        className={`flex h-20 w-20 shrink-0 items-center justify-center border border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-blue-400 hover:text-blue-600 ${photoButtonClass}`}
                                    >
                                        <Plus className="size-5" aria-hidden="true" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </section>

                {/* Keterangan */}
                <section className="space-y-4">
                    <SectionTitle>Keterangan Tambahan</SectionTitle>
                    <TextArea
                        label="Keterangan"
                        rows={4}
                        placeholder="Tambahkan catatan atau keterangan tambahan mengenai kondisi detail aset..."
                        value={data.keterangan}
                        onChange={(v) => setData('keterangan', v)}
                        isInvalid={Boolean(errors.keterangan)}
                        hint={errors.keterangan}
                    />
                </section>
            </div>

            <div className="flex items-center justify-end gap-3">
                {errorCount > 0 && (
                    <p role="alert" className="mr-auto text-sm font-medium text-red-600">
                        {errorCount} isian perlu diperbaiki
                    </p>
                )}
                <Button color="secondary" size="md" href={cancelHref}>
                    Batal
                </Button>
                <Button color="primary" size="md" type="submit" isLoading={processing}>
                    {submitLabel}
                </Button>
            </div>
        </form>
    );
}
