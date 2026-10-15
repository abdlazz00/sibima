import ConfirmDialog from '@/Components/ConfirmDialog';
import PageHeader from '@/Components/PageHeader';
import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import { Select } from '@/Components/ui/base/select/select';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { ArrowDown, ArrowUp, Plus, Trash01 } from '@untitledui/icons';
import { useState } from 'react';

type ApproverType = 'role' | 'user' | 'atasan_unit';

interface StepForm {
    label: string;
    approver_type: ApproverType;
    approver_role: string;
    approver_user_id: string;
    unit_scope: string;
}

interface Option {
    value: string;
    label: string;
    can_act?: boolean;
}

interface UserOption {
    id: number;
    name: string;
    role: string | null;
    unit: string | null;
    can_act: boolean;
}

interface LogRow {
    id: number;
    event: string;
    user: string | null;
    created_at: string | null;
    before: string;
    after: string;
}

interface EditProps extends PageProps {
    workflow: {
        id: number;
        code: string;
        name: string;
        capability: string;
        steps: { label: string; approver_type: ApproverType; approver_role: string | null; approver_user_id: number | null; unit_scope: string }[];
    };
    options: { roles: Option[]; types: Option[]; scopes: Option[]; users: UserOption[] };
    logs: LogRow[];
}

type ServerStep = EditProps['workflow']['steps'][number];

const toStepForm = (s: ServerStep): StepForm => ({
    label: s.label,
    approver_type: s.approver_type,
    approver_role: s.approver_role ?? '',
    approver_user_id: s.approver_user_id ? String(s.approver_user_id) : '',
    unit_scope: s.unit_scope,
});

const warning = (text: string) => <span className="text-amber-700">{text}</span>;

export default function Edit({ workflow, options, logs }: EditProps) {
    const form = useForm({ steps: workflow.steps.map(toStepForm) });
    const [confirmingReset, setConfirmingReset] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [announce, setAnnounce] = useState('');

    const errors = form.errors as Record<string, string>;
    const stepError = (index: number, field: string): string | undefined => errors[`steps.${index}.${field}`];

    const setSteps = (steps: StepForm[]) => form.setData('steps', steps);

    const update = (index: number, changes: Partial<StepForm>) =>
        setSteps(form.data.steps.map((s, i) => (i === index ? { ...s, ...changes } : s)));

    const move = (index: number, delta: number) => {
        const target = index + delta;
        if (target < 0 || target >= form.data.steps.length) return;
        const steps = [...form.data.steps];
        [steps[index], steps[target]] = [steps[target], steps[index]];
        setSteps(steps);
        setAnnounce(`Langkah dipindah ke posisi ${target + 1}`);
    };

    const add = () => {
        setSteps([...form.data.steps, { label: '', approver_type: 'role', approver_role: '', approver_user_id: '', unit_scope: 'none' }]);
        setAnnounce(`Langkah ${form.data.steps.length + 1} ditambahkan`);
    };

    const remove = (index: number) => {
        setSteps(form.data.steps.filter((_, i) => i !== index));
        setAnnounce(`Langkah ${index + 1} dihapus`);
    };

    const save = () => {
        form.transform((data) => ({
            steps: data.steps.map((s) => ({
                ...s,
                approver_role: s.approver_type === 'role' ? s.approver_role || null : null,
                approver_user_id: s.approver_type === 'user' ? Number(s.approver_user_id) || null : null,
                unit_scope: s.approver_type === 'role' ? s.unit_scope : 'none',
            })),
        }));
        form.put(route('workflow-settings.update', workflow.id), { preserveScroll: true });
    };

    const reset = () => {
        setResetting(true);
        router.post(
            route('workflow-settings.reset', workflow.id),
            {},
            {
                preserveScroll: true,
                onSuccess: (page) => {
                    form.clearErrors();
                    form.setData('steps', (page.props as unknown as EditProps).workflow.steps.map(toStepForm));
                },
                onFinish: () => {
                    setResetting(false);
                    setConfirmingReset(false);
                },
            },
        );
    };

    return (
        <AuthenticatedLayout>
            <Head title={`Atur Alur: ${workflow.name}`} />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Pengaturan Alur', href: route('workflow-settings.index') }, { label: workflow.name }]}
                    title={workflow.name}
                />

                <p className="sr-only" aria-live="polite">
                    {announce}
                </p>

                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Pengajuan yang sedang berjalan tidak terpengaruh. Perubahan hanya berlaku untuk pengajuan baru.
                </div>

                {errors.steps && (
                    <p role="alert" className="text-sm text-red-600">
                        {errors.steps}
                    </p>
                )}

                <div className="space-y-4">
                    {form.data.steps.map((step, index) => {
                        const selectedRole = options.roles.find((r) => r.value === step.approver_role);
                        const selectedUser = options.users.find((u) => String(u.id) === step.approver_user_id);

                        return (
                            <div key={index} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-bold text-blue-700">Langkah {index + 1}</p>
                                    <div className="flex items-center gap-1.5">
                                        <Button
                                            color="secondary"
                                            size="sm"
                                            iconLeading={ArrowUp}
                                            aria-label={`Naikkan langkah ${index + 1}`}
                                            isDisabled={index === 0}
                                            onPress={() => move(index, -1)}
                                        />
                                        <Button
                                            color="secondary"
                                            size="sm"
                                            iconLeading={ArrowDown}
                                            aria-label={`Turunkan langkah ${index + 1}`}
                                            isDisabled={index === form.data.steps.length - 1}
                                            onPress={() => move(index, 1)}
                                        />
                                        <Button
                                            color="primary-destructive"
                                            size="sm"
                                            iconLeading={Trash01}
                                            aria-label={`Hapus langkah ${index + 1}`}
                                            onPress={() => remove(index)}
                                        >
                                            Hapus
                                        </Button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <Input
                                        label="Nama Langkah"
                                        isRequired
                                        placeholder="mis. Verifikasi Kasubag"
                                        value={step.label}
                                        onChange={(v) => update(index, { label: v })}
                                        isInvalid={Boolean(stepError(index, 'label'))}
                                        hint={stepError(index, 'label')}
                                    />
                                    <Select
                                        label="Tipe Approver"
                                        isRequired
                                        items={options.types.map((t) => ({ id: t.value, label: t.label }))}
                                        selectedKey={step.approver_type}
                                        onSelectionChange={(key) => update(index, { approver_type: String(key) as ApproverType })}
                                        isInvalid={Boolean(stepError(index, 'approver_type'))}
                                        hint={stepError(index, 'approver_type')}
                                    >
                                        {(item) => <Select.Item id={item.id} label={item.label} />}
                                    </Select>
                                </div>

                                {step.approver_type === 'role' && (
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <Select
                                            label="Role"
                                            isRequired
                                            placeholder="Pilih role..."
                                            items={options.roles.map((r) => ({ id: r.value, label: r.label }))}
                                            selectedKey={step.approver_role || null}
                                            onSelectionChange={(key) => update(index, { approver_role: String(key) })}
                                            isInvalid={Boolean(stepError(index, 'approver_role'))}
                                            hint={
                                                stepError(index, 'approver_role') ??
                                                (selectedRole?.can_act === false
                                                    ? warning('Role ini belum memegang izin "Setujui / Tolak"; anggotanya tidak akan bisa menyetujui langkah ini.')
                                                    : undefined)
                                            }
                                        >
                                            {(item) => <Select.Item id={item.id} label={item.label} />}
                                        </Select>
                                        <Select
                                            label="Cakupan Unit"
                                            items={options.scopes.map((s) => ({ id: s.value, label: s.label }))}
                                            selectedKey={step.unit_scope}
                                            onSelectionChange={(key) => update(index, { unit_scope: String(key) })}
                                            isInvalid={Boolean(stepError(index, 'unit_scope'))}
                                            hint={stepError(index, 'unit_scope')}
                                        >
                                            {(item) => <Select.Item id={item.id} label={item.label} />}
                                        </Select>
                                    </div>
                                )}

                                {step.approver_type === 'user' && (
                                    <Select
                                        label="User"
                                        isRequired
                                        placeholder="Pilih user..."
                                        items={options.users.map((u) => ({
                                            id: String(u.id),
                                            label: `${u.name} (${u.role ?? '-'}${u.unit ? `, ${u.unit}` : ''})`,
                                        }))}
                                        selectedKey={step.approver_user_id || null}
                                        onSelectionChange={(key) => update(index, { approver_user_id: String(key) })}
                                        isInvalid={Boolean(stepError(index, 'approver_user_id'))}
                                        hint={
                                            stepError(index, 'approver_user_id') ??
                                            (selectedUser?.can_act === false
                                                ? warning('User ini belum memegang izin "Setujui / Tolak" sehingga tidak akan bisa menyetujui langkah ini.')
                                                : 'Hanya user ini yang dapat menyetujui langkah ini.')
                                        }
                                    >
                                        {(item) => <Select.Item id={item.id} label={item.label} />}
                                    </Select>
                                )}

                                {step.approver_type === 'atasan_unit' && (
                                    <p className="text-xs text-slate-500">Otomatis: Camat bila unit pengajuan kecamatan, Lurah bila kelurahan.</p>
                                )}
                            </div>
                        );
                    })}
                </div>

                <Button color="primary-sky" size="md" iconLeading={Plus} onPress={add}>
                    Tambah Langkah
                </Button>

                <div className="flex items-center justify-between">
                    <Button color="secondary" size="md" onPress={() => setConfirmingReset(true)}>
                        Kembalikan ke Default
                    </Button>
                    <Button color="primary" size="md" isLoading={form.processing} onPress={save}>
                        Simpan Alur
                    </Button>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                    <p className="mb-4 text-base font-semibold text-slate-900">Riwayat Perubahan</p>
                    {logs.length === 0 ? (
                        <p className="text-sm text-slate-400">Belum ada perubahan.</p>
                    ) : (
                        <ul className="space-y-3 text-sm">
                            {logs.map((l) => (
                                <li key={l.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                                    <p className="font-semibold text-slate-900">
                                        {l.event === 'reset' ? 'Dikembalikan ke default' : 'Diubah'} oleh {l.user}
                                    </p>
                                    <p className="text-xs text-slate-500">{l.created_at}</p>
                                    <p className="mt-1 text-xs text-slate-600">Sebelum: {l.before || '-'}</p>
                                    <p className="text-xs text-slate-600">Sesudah: {l.after || '-'}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {confirmingReset && (
                <ConfirmDialog
                    title="Kembalikan ke Default"
                    confirmLabel="Ya, Kembalikan"
                    isLoading={resetting}
                    onConfirm={reset}
                    onClose={() => setConfirmingReset(false)}
                >
                    Kembalikan alur ini ke pengaturan default? Perubahan yang belum tersimpan hilang.
                </ConfirmDialog>
            )}
        </AuthenticatedLayout>
    );
}
