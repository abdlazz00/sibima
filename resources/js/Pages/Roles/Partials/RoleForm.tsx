import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { Checkbox } from '@/Components/ui/base/checkbox/checkbox';
import { Input } from '@/Components/ui/base/input/input';
import { Label } from '@/Components/ui/base/input/label';
import { RadioButton, RadioGroup } from '@/Components/ui/base/radio-buttons/radio-buttons';
import { Select } from '@/Components/ui/base/select/select';
import { TextArea } from '@/Components/ui/base/textarea/textarea';
import { formatPermissionLabel } from '@/lib/permissions';
import { InertiaFormProps } from '@inertiajs/react';
import { FormEvent } from 'react';

export type RoleFormData = {
    name: string;
    display_name: string;
    unit_scope: 'all' | 'binaan' | 'own';
    unit_head_of: '' | 'kecamatan' | 'kelurahan';
    description: string;
    permissions: string[];
};

type Props = {
    form: InertiaFormProps<RoleFormData>;
    permissionGroups: Record<string, string[]>;
    isSystemRole?: boolean;
    submitLabel: string;
    onSubmit: (e: FormEvent) => void;
    cancelHref: string;
};

const NONE = '__none';

const SCOPE_OPTIONS: { value: RoleFormData['unit_scope']; label: string; hint: string }[] = [
    {
        value: 'all',
        label: 'Semua Unit (All)',
        hint: 'Dapat mengakses seluruh data aset di semua unit kecamatan dan seluruh kelurahan.',
    },
    {
        value: 'binaan',
        label: 'Unit & Binaan',
        hint: 'Dapat mengakses unit induk sendiri dan seluruh kelurahan binaannya (contoh: Camat).',
    },
    {
        value: 'own',
        label: 'Unit Sendiri Saja',
        hint: 'Terisolasi hanya pada data aset milik unit tempat pengguna bertugas.',
    },
];

const HEAD_ITEMS = [
    { id: NONE, label: 'Bukan pimpinan unit' },
    { id: 'kecamatan', label: 'Pimpinan Kecamatan' },
    { id: 'kelurahan', label: 'Pimpinan Kelurahan' },
];

export default function RoleForm({ form, permissionGroups, isSystemRole = false, submitLabel, onSubmit, cancelHref }: Props) {
    const { data, setData, processing, errors } = form;

    const allPermissions = Object.values(permissionGroups).flat();
    const errorCount = Object.keys(errors).length;

    const togglePermission = (perm: string) => {
        setData(
            'permissions',
            data.permissions.includes(perm) ? data.permissions.filter((p) => p !== perm) : [...data.permissions, perm],
        );
    };

    const toggleGroup = (perms: string[]) => {
        const allSelected = perms.every((p) => data.permissions.includes(p));
        setData(
            'permissions',
            allSelected
                ? data.permissions.filter((p) => !perms.includes(p))
                : [...data.permissions, ...perms.filter((p) => !data.permissions.includes(p))],
        );
    };

    return (
        <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
                {/* Identitas */}
                <section className="space-y-4">
                    <div className="border-b border-slate-100 pb-2">
                        <h2 className="text-base font-semibold text-slate-900">Identitas Role</h2>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input
                            label="Nama Tampilan"
                            isRequired
                            placeholder="Contoh: Auditor Aset Wilayah"
                            value={data.display_name}
                            onChange={(v) => setData('display_name', v)}
                            isInvalid={Boolean(errors.display_name)}
                            hint={errors.display_name}
                        />
                        <Input
                            label="Nama Teknis (Identifier Sistem)"
                            isRequired
                            isDisabled={isSystemRole}
                            placeholder="contoh: auditor_aset"
                            inputClassName="font-mono"
                            value={data.name}
                            onChange={(v) => setData('name', v.toLowerCase().replace(/[^a-z0-9_-]/g, '_'))}
                            isInvalid={Boolean(errors.name)}
                            hint={
                                errors.name ??
                                (isSystemRole
                                    ? 'Nama teknis role sistem terproteksi dan tidak dapat diubah.'
                                    : 'Huruf kecil, angka, garis bawah (underscore).')
                            }
                        />
                    </div>
                </section>

                {/* Cakupan unit */}
                <section className="space-y-4">
                    <div className="border-b border-slate-100 pb-2">
                        <h2 className="text-base font-semibold text-slate-900">Cakupan Data</h2>
                    </div>

                    <RadioGroup
                        isRequired
                        className="gap-2"
                        value={data.unit_scope}
                        onChange={(v) => setData('unit_scope', v as RoleFormData['unit_scope'])}
                        isInvalid={Boolean(errors.unit_scope)}
                    >
                        <Label isRequired>Cakupan Data Unit (Unit Scope)</Label>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            {SCOPE_OPTIONS.map((option) => (
                                <RadioButton
                                    key={option.value}
                                    value={option.value}
                                    label={option.label}
                                    hint={option.hint}
                                    className="rounded-xl border border-slate-200 p-3.5 transition hover:border-slate-300 data-selected:border-blue-600 data-selected:bg-blue-50/50 data-selected:ring-1 data-selected:ring-blue-600"
                                />
                            ))}
                        </div>
                        {errors.unit_scope && <p className="text-sm text-red-600">{errors.unit_scope}</p>}
                    </RadioGroup>

                    <Select
                        label='Pimpinan Unit (untuk langkah "Atasan Unit")'
                        items={HEAD_ITEMS}
                        selectedKey={data.unit_head_of || NONE}
                        onSelectionChange={(key) =>
                            setData('unit_head_of', key === NONE ? '' : (String(key) as RoleFormData['unit_head_of']))
                        }
                        isInvalid={Boolean(errors.unit_head_of)}
                        hint={errors.unit_head_of ?? 'Role ini menjadi atasan otomatis bagi pengajuan dari unit sejenis.'}
                    >
                        {(item) => <Select.Item id={item.id} label={item.label} />}
                    </Select>

                    <TextArea
                        label="Deskripsi / Catatan Tambahan"
                        rows={2}
                        placeholder="Jelaskan tujuan atau fungsi peran ini dalam tata kelola aset..."
                        value={data.description}
                        onChange={(v) => setData('description', v)}
                        isInvalid={Boolean(errors.description)}
                        hint={errors.description}
                    />
                </section>

                {/* Matriks izin */}
                <section className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <div>
                            <h2 className="text-base font-semibold text-slate-900">Matriks Hak Akses &amp; Izin (Permissions)</h2>
                            <p className="text-xs text-slate-500">
                                <span className="font-semibold tabular-nums text-slate-700">{data.permissions.length}</span> dari{' '}
                                <span className="tabular-nums">{allPermissions.length}</span> izin dipilih.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button color="secondary" size="sm" onPress={() => setData('permissions', [...allPermissions])}>
                                Pilih Semua
                            </Button>
                            <Button color="secondary" size="sm" onPress={() => setData('permissions', [])}>
                                Batal Semua
                            </Button>
                        </div>
                    </div>

                    {errors.permissions && (
                        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                            {errors.permissions}
                        </div>
                    )}

                    <div className="space-y-4">
                        {Object.entries(permissionGroups).map(([groupTitle, perms]) => {
                            const groupSelectedCount = perms.filter((p) => data.permissions.includes(p)).length;
                            const isGroupAllSelected = groupSelectedCount === perms.length;

                            return (
                                <div key={groupTitle} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                                    <div className="mb-2.5 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-slate-900">{groupTitle}</span>
                                            <Badge type="color" size="sm" color="gray" className="rounded-sm tabular-nums">
                                                {groupSelectedCount} / {perms.length}
                                            </Badge>
                                        </div>
                                        <Button color="link-color" size="sm" onPress={() => toggleGroup(perms)}>
                                            {isGroupAllSelected ? 'Batal Grup' : 'Pilih Grup'}
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                        {perms.map((perm) => {
                                            const isChecked = data.permissions.includes(perm);

                                            return (
                                                <Checkbox
                                                    key={perm}
                                                    isSelected={isChecked}
                                                    onChange={() => togglePermission(perm)}
                                                    label={formatPermissionLabel(perm)}
                                                    hint={<span className="font-mono text-[11px] text-slate-400">{perm}</span>}
                                                    className={`rounded-lg border p-2.5 transition ${
                                                        isChecked ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200 bg-white hover:bg-slate-50'
                                                    }`}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </div>

            {/* Bilah aksi lengket */}
            <div className="sticky bottom-0 z-20 -mx-6 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur-xs lg:-mx-8 lg:px-8">
                <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-slate-600" aria-live="polite">
                        {errorCount > 0 ? (
                            <span role="alert" className="font-medium text-red-600">
                                {errorCount} isian perlu diperbaiki
                            </span>
                        ) : (
                            <>
                                <span className="font-semibold tabular-nums text-slate-900">{data.permissions.length}</span> izin dipilih
                            </>
                        )}
                    </p>
                    <div className="flex items-center gap-3">
                        <Button color="secondary" size="md" href={cancelHref}>
                            Batal
                        </Button>
                        <Button color="primary" size="md" type="submit" isLoading={processing}>
                            {submitLabel}
                        </Button>
                    </div>
                </div>
            </div>
        </form>
    );
}
