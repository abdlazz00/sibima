import PageHeader from '@/Components/PageHeader';
import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import { Label } from '@/Components/ui/base/input/label';
import { RadioButton, RadioGroup } from '@/Components/ui/base/radio-buttons/radio-buttons';
import { Select } from '@/Components/ui/base/select/select';
import { TextArea } from '@/Components/ui/base/textarea/textarea';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AssetRequestType, PageProps } from '@/types';
import { Head, useForm } from '@inertiajs/react';

interface CreateProps extends PageProps {
    pegawais: { id: number; nama: string; jabatan: string | null }[];
    categories: { id: number; name: string }[];
    canUnit: boolean;
}

export default function Create({ pegawais, categories, canUnit }: CreateProps) {
    const form = useForm({
        jenis: 'pegawai' as AssetRequestType,
        pegawai_id: '',
        jumlah: '1',
        category_id: '',
        keterangan: '',
    });

    const submit = () => {
        form.transform((data) => (data.jenis === 'pegawai' ? { ...data, jumlah: '' } : { ...data, pegawai_id: '' }));
        form.post(route('asset-requests.store'));
    };

    return (
        <AuthenticatedLayout>
            <Head title="Buat Permohonan Aset" />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Permohonan Aset', href: route('asset-requests.index') }, { label: 'Buat Permohonan' }]}
                    title="Buat Permohonan Aset"
                />

                <form onSubmit={(e) => e.preventDefault()} className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                    <RadioGroup
                        isRequired
                        className="gap-2"
                        value={form.data.jenis}
                        onChange={(v) => form.setData('jenis', v as AssetRequestType)}
                        isInvalid={Boolean(form.errors.jenis)}
                    >
                        <Label isRequired>Jenis Permohonan</Label>
                        <RadioButton value="pegawai" label="Untuk pegawai (aset diserahkan ke pegawai dari stok unit)" />
                        {canUnit && <RadioButton value="unit" label="Untuk unit (minta stok dari kecamatan)" />}
                        {form.errors.jenis && <p className="text-xs text-red-600">{form.errors.jenis}</p>}
                    </RadioGroup>

                    {form.data.jenis === 'pegawai' ? (
                        <Select
                            label="Pegawai"
                            isRequired
                            placeholder="Pilih pegawai..."
                            items={pegawais.map((p) => ({ id: String(p.id), label: `${p.nama}${p.jabatan ? ` — ${p.jabatan}` : ''}` }))}
                            selectedKey={form.data.pegawai_id || null}
                            onSelectionChange={(key) => form.setData('pegawai_id', String(key))}
                            isInvalid={Boolean(form.errors.pegawai_id)}
                            hint={form.errors.pegawai_id}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                    ) : (
                        <div className="max-w-xs">
                            <Input
                                label="Jumlah Barang"
                                type="number"
                                inputMode="numeric"
                                isRequired
                                inputClassName="tabular-nums"
                                value={form.data.jumlah}
                                onChange={(v) => form.setData('jumlah', v)}
                                isInvalid={Boolean(form.errors.jumlah)}
                                hint={form.errors.jumlah}
                            />
                        </div>
                    )}

                    <Select
                        label="Subkategori Aset yang Diminta"
                        isRequired
                        placeholder="Pilih subkategori..."
                        items={categories.map((c) => ({ id: String(c.id), label: c.name }))}
                        selectedKey={form.data.category_id || null}
                        onSelectionChange={(key) => form.setData('category_id', String(key))}
                        isInvalid={Boolean(form.errors.category_id)}
                        hint={form.errors.category_id}
                    >
                        {(item) => <Select.Item id={item.id} label={item.label} />}
                    </Select>

                    <TextArea
                        label="Keterangan / Alasan"
                        isRequired
                        rows={4}
                        placeholder="Jelaskan kebutuhan dan alasan permohonan."
                        value={form.data.keterangan}
                        onChange={(v) => form.setData('keterangan', v)}
                        isInvalid={Boolean(form.errors.keterangan)}
                        hint={form.errors.keterangan}
                    />

                    <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                        <Button color="secondary" size="md" href={route('asset-requests.index')}>
                            Batal
                        </Button>
                        <Button color="primary" size="md" isLoading={form.processing} onPress={submit}>
                            Ajukan Permohonan
                        </Button>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
