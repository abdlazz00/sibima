import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import { Label } from '@/Components/ui/base/input/label';
import { RadioButton, RadioGroup } from '@/Components/ui/base/radio-buttons/radio-buttons';
import { Select } from '@/Components/ui/base/select/select';
import { TextArea } from '@/Components/ui/base/textarea/textarea';
import { AssetCategory } from '@/types';
import { InertiaFormProps } from '@inertiajs/react';
import { FormEvent } from 'react';

export type CategoryFormData = {
    name: string;
    parent_id: number | '';
    code: string;
    description: string;
};

type Props = {
    form: InertiaFormProps<CategoryFormData>;
    parents: AssetCategory[];
    categoryType: 'child' | 'parent';
    onCategoryTypeChange: (type: 'child' | 'parent') => void;
    childDisabled?: boolean;
    parentHint: string;
    submitLabel: string;
    onSubmit: (e: FormEvent) => void;
    cancelHref: string;
};

export default function CategoryForm({
    form,
    parents,
    categoryType,
    onCategoryTypeChange,
    childDisabled = false,
    parentHint,
    submitLabel,
    onSubmit,
    cancelHref,
}: Props) {
    const { data, setData, processing, errors } = form;

    const codeInput = (placeholder: string) => (
        <Input
            label="Kode Kategori"
            placeholder={placeholder}
            value={data.code}
            onChange={(v) => setData('code', v)}
            isInvalid={Boolean(errors.code)}
            hint={errors.code ?? 'Kode akan mengikuti format standar BMD'}
        />
    );

    return (
        <form onSubmit={onSubmit} className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
                <h2 className="border-b border-slate-100 pb-4 text-base font-semibold text-slate-900">
                    Informasi Kategori
                </h2>

                <div className="space-y-6 pt-6">
                    <RadioGroup
                        isRequired
                        className="gap-2"
                        value={categoryType}
                        onChange={(v) => onCategoryTypeChange(v as 'child' | 'parent')}
                    >
                        <Label isRequired>Jenis Kategori</Label>
                        <div className="flex flex-wrap items-center gap-6">
                            <RadioButton value="parent" label="Kategori Utama (Induk)" />
                            <RadioButton value="child" label="Subkategori" isDisabled={childDisabled} />
                        </div>
                        {childDisabled && (
                            <p className="text-xs text-amber-600">
                                Kategori ini memiliki subkategori, sehingga tidak dapat dijadikan subkategori dari
                                kategori lain.
                            </p>
                        )}
                    </RadioGroup>

                    {categoryType === 'child' ? (
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            <Select
                                label="Kategori Induk"
                                isRequired
                                placeholder="Pilih Kategori Induk"
                                items={parents.map((p) => ({ id: p.id, label: p.name }))}
                                selectedKey={data.parent_id === '' ? null : data.parent_id}
                                onSelectionChange={(key) => setData('parent_id', key == null ? '' : Number(key))}
                                isInvalid={Boolean(errors.parent_id)}
                                hint={errors.parent_id ?? parentHint}
                            >
                                {(item) => <Select.Item id={item.id} label={item.label} />}
                            </Select>
                            {codeInput('Contoh: 02.09.04')}
                        </div>
                    ) : (
                        <div className="max-w-md">{codeInput('Contoh: 02.09')}</div>
                    )}

                    <Input
                        label="Nama Kategori"
                        isRequired
                        placeholder="Masukkan nama kategori (huruf kapital)"
                        value={data.name}
                        onChange={(v) => setData('name', v)}
                        isInvalid={Boolean(errors.name)}
                        hint={errors.name}
                    />
                    <TextArea
                        label="Deskripsi (Opsional)"
                        rows={4}
                        placeholder="Tambahkan keterangan kategori jika diperlukan"
                        value={data.description}
                        onChange={(v) => setData('description', v)}
                        isInvalid={Boolean(errors.description)}
                        hint={errors.description}
                    />
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
