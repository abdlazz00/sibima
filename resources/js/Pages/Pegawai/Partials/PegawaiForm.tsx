import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import { Label } from '@/Components/ui/base/input/label';
import { RadioButton, RadioGroup } from '@/Components/ui/base/radio-buttons/radio-buttons';
import { Select } from '@/Components/ui/base/select/select';
import { InertiaFormProps } from '@inertiajs/react';
import { Camera01, XClose } from '@untitledui/icons';
import { ChangeEvent, FormEvent, useRef, useState } from 'react';

export type PegawaiFormData = {
    nama: string;
    nip: string;
    status_kepegawaian: 'pns' | 'pppk';
    no_hp: string;
    email_dinas: string;
    pangkat_golongan: string;
    jabatan: string;
    unit_id: string;
    foto_profile: File | null;
};

export interface UnitOption {
    id: number;
    name: string;
    type: 'kecamatan' | 'kelurahan';
}

type Props = {
    form: InertiaFormProps<PegawaiFormData>;
    units: UnitOption[];
    existingPhotoUrl?: string | null;
    submitLabel: string;
    onSubmit: (e: FormEvent) => void;
    cancelHref: string;
};

const NONE = '__none';

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

const pangkatItems = [
    { id: NONE, label: 'Tanpa pangkat' },
    ...PANGKAT_OPTIONS.map((pangkat) => ({ id: pangkat, label: pangkat })),
];

export default function PegawaiForm({ form, units, existingPhotoUrl, submitLabel, onSubmit, cancelHref }: Props) {
    const { data, setData, processing, errors } = form;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);

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

    const pickPhoto = () => fileInputRef.current?.click();

    const photoFrame =
        'aspect-3/4 relative flex w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-inner';

    return (
        <form onSubmit={onSubmit} className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
                {/* Top Section: Photo and Personal Data */}
                <div className="flex flex-col gap-8 md:flex-row md:items-start">
                    {/* Left Column: Photo Upload Area */}
                    <div className="w-full shrink-0 md:w-64 lg:w-72">
                        <p className="text-sm font-semibold text-slate-900">Foto Pegawai (Opsional)</p>

                        <div className="mt-3">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handlePhotoChange}
                                accept="image/jpeg,image/png,image/jpg"
                                className="hidden"
                            />

                            {photoPreview ? (
                                <div className={photoFrame}>
                                    <img src={photoPreview} alt="Pratinjau foto pegawai" className="h-full w-full object-cover" />
                                    <Button
                                        color="secondary"
                                        size="sm"
                                        iconLeading={XClose}
                                        aria-label="Hapus foto baru"
                                        className="absolute right-2 top-2"
                                        onPress={handleRemovePhoto}
                                    />
                                </div>
                            ) : existingPhotoUrl ? (
                                <div className={photoFrame}>
                                    <img src={existingPhotoUrl} alt="Foto pegawai saat ini" className="h-full w-full object-cover" />
                                    <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-slate-900/80 p-3 pt-6 text-center">
                                        <Button color="primary-teal" size="sm" iconLeading={Camera01} onPress={pickPhoto}>
                                            Ganti Foto
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={pickPhoto}
                                    className="aspect-3/4 group flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-6 text-center outline-hidden transition hover:border-blue-500 hover:bg-blue-50/30 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
                                >
                                    <span className="flex size-12 items-center justify-center rounded-full bg-white text-slate-500 shadow-xs transition group-hover:text-blue-600">
                                        <Camera01 className="size-6" aria-hidden="true" />
                                    </span>
                                    <span className="mt-4 text-sm font-semibold text-slate-800 group-hover:text-blue-700">
                                        Klik untuk unggah foto
                                    </span>
                                    <span className="mt-1 text-xs text-slate-500">Format JPG/PNG, maks. 2MB</span>
                                </button>
                            )}

                            {errors.foto_profile && (
                                <p role="alert" className="mt-2 text-sm text-red-600">
                                    {errors.foto_profile}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Personal Data */}
                    <div className="min-w-0 flex-1 space-y-5">
                        <div className="border-b border-slate-100 pb-2">
                            <h2 className="text-base font-semibold text-slate-900">Data Pribadi</h2>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Input
                                label="Nama Lengkap"
                                isRequired
                                placeholder="Masukkan nama lengkap pegawai"
                                value={data.nama}
                                onChange={(v) => setData('nama', v)}
                                isInvalid={Boolean(errors.nama)}
                                hint={errors.nama}
                            />
                            <Input
                                label="NIP"
                                placeholder="Masukkan NIP (18 digit)"
                                value={data.nip}
                                onChange={(v) => setData('nip', v)}
                                isInvalid={Boolean(errors.nip)}
                                hint={errors.nip ?? 'Kosongkan jika PPPK tanpa NIP'}
                            />
                            <RadioGroup
                                isRequired
                                className="gap-2"
                                value={data.status_kepegawaian}
                                onChange={(v) => setData('status_kepegawaian', v as 'pns' | 'pppk')}
                                isInvalid={Boolean(errors.status_kepegawaian)}
                            >
                                <Label isRequired>Status Aparatur</Label>
                                <div className="flex items-center gap-6">
                                    <RadioButton value="pns" label="PNS" />
                                    <RadioButton value="pppk" label="PPPK" />
                                </div>
                                {errors.status_kepegawaian && (
                                    <p className="text-sm text-red-600">{errors.status_kepegawaian}</p>
                                )}
                            </RadioGroup>
                            <Input
                                label="No. HP"
                                placeholder="08xx-xxxx-xxxx"
                                value={data.no_hp}
                                onChange={(v) => setData('no_hp', v)}
                                isInvalid={Boolean(errors.no_hp)}
                                hint={errors.no_hp}
                            />
                            <Input
                                label="Email Dinas"
                                type="email"
                                placeholder="nama@batam.go.id"
                                value={data.email_dinas}
                                onChange={(v) => setData('email_dinas', v)}
                                isInvalid={Boolean(errors.email_dinas)}
                                hint={errors.email_dinas}
                            />
                        </div>
                    </div>
                </div>

                <div className="my-8 border-t border-slate-200" />

                {/* Bottom Section: Rank & Position */}
                <div className="space-y-4">
                    <h2 className="text-base font-semibold text-slate-900">Data Kepangkatan &amp; Jabatan</h2>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Select
                            label="Pangkat / Golongan"
                            placeholder="Pilih pangkat"
                            items={pangkatItems}
                            selectedKey={data.pangkat_golongan || null}
                            onSelectionChange={(key) => setData('pangkat_golongan', key === NONE || key == null ? '' : String(key))}
                            isInvalid={Boolean(errors.pangkat_golongan)}
                            hint={errors.pangkat_golongan}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                        <Input
                            label="Jabatan"
                            isRequired
                            placeholder="Masukkan jabatan dinas"
                            value={data.jabatan}
                            onChange={(v) => setData('jabatan', v)}
                            isInvalid={Boolean(errors.jabatan)}
                            hint={errors.jabatan}
                        />
                        <Select
                            label="Unit Kerja"
                            isRequired
                            placeholder="Pilih unit kerja penugasan"
                            items={units.map((unit) => ({
                                id: String(unit.id),
                                label: `${unit.name} (${unit.type === 'kecamatan' ? 'Kecamatan' : 'Kelurahan'})`,
                            }))}
                            selectedKey={data.unit_id || null}
                            onSelectionChange={(key) => setData('unit_id', key == null ? '' : String(key))}
                            isInvalid={Boolean(errors.unit_id)}
                            hint={errors.unit_id}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-end gap-3">
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
