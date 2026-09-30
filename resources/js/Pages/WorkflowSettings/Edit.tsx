import { ChevronRightIcon as ChevronRight, PlusIcon as Plus, TrashIcon as Trash } from '@/Components/Icons';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';

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
}

interface UserOption {
    id: number;
    name: string;
    role: string | null;
    unit: string | null;
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

const FIELD = 'w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm focus:border-blue-600 focus:outline-none';

export default function Edit({ workflow, options, logs }: EditProps) {
    const form = useForm({ steps: workflow.steps.map(toStepForm) });

    const errors = form.errors as Record<string, string>;

    const setSteps = (steps: StepForm[]) => form.setData('steps', steps);

    const update = (index: number, changes: Partial<StepForm>) =>
        setSteps(form.data.steps.map((s, i) => (i === index ? { ...s, ...changes } : s)));

    const move = (index: number, delta: number) => {
        const target = index + delta;
        if (target < 0 || target >= form.data.steps.length) return;
        const steps = [...form.data.steps];
        [steps[index], steps[target]] = [steps[target], steps[index]];
        setSteps(steps);
    };

    const add = () =>
        setSteps([...form.data.steps, { label: '', approver_type: 'role', approver_role: '', approver_user_id: '', unit_scope: 'none' }]);

    const remove = (index: number) => setSteps(form.data.steps.filter((_, i) => i !== index));

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
        if (window.confirm('Kembalikan alur ini ke pengaturan default? Perubahan yang belum tersimpan hilang.')) {
            router.post(
                route('workflow-settings.reset', workflow.id),
                {},
                {
                    preserveScroll: true,
                    onSuccess: (page) => {
                        form.clearErrors();
                        form.setData('steps', (page.props as unknown as EditProps).workflow.steps.map(toStepForm));
                    },
                },
            );
        }
    };

    return (
        <AuthenticatedLayout>
            <Head title={`Atur Alur: ${workflow.name}`} />

            <div className="space-y-6">
                <div>
                    <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Link href={route('dashboard')} className="hover:text-blue-700">Home</Link>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <Link href={route('workflow-settings.index')} className="hover:text-blue-700">Pengaturan Alur</Link>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span className="font-medium text-slate-800">{workflow.name}</span>
                    </nav>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{workflow.name}</h1>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Pengajuan yang sedang berjalan tidak terpengaruh. Perubahan hanya berlaku untuk pengajuan baru.
                </div>

                {errors.steps && <p className="text-sm text-red-600">{errors.steps}</p>}

                <div className="space-y-4">
                    {form.data.steps.map((step, index) => (
                        <div key={index} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-bold text-blue-700">Langkah {index + 1}</p>
                                <div className="flex items-center gap-1 text-xs">
                                    <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="rounded border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-40">Naik</button>
                                    <button type="button" onClick={() => move(index, 1)} disabled={index === form.data.steps.length - 1} className="rounded border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-40">Turun</button>
                                    <button type="button" onClick={() => remove(index)} className="flex items-center gap-1 rounded px-2 py-1 font-medium text-slate-500 hover:text-red-600">
                                        <Trash className="h-3.5 w-3.5" /> Hapus
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-slate-900">Nama Langkah *</label>
                                    <input type="text" value={step.label} onChange={(e) => update(index, { label: e.target.value })} className={FIELD} placeholder="mis. Verifikasi Kasubag" />
                                    {errors[`steps.${index}.label`] && <p className="mt-1 text-xs text-red-600">{errors[`steps.${index}.label`]}</p>}
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-slate-900">Tipe Approver *</label>
                                    <select value={step.approver_type} onChange={(e) => update(index, { approver_type: e.target.value as ApproverType })} className={FIELD}>
                                        {options.types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                    {errors[`steps.${index}.approver_type`] && <p className="mt-1 text-xs text-red-600">{errors[`steps.${index}.approver_type`]}</p>}
                                </div>
                            </div>

                            {step.approver_type === 'role' && (
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-slate-900">Role *</label>
                                        <select value={step.approver_role} onChange={(e) => update(index, { approver_role: e.target.value })} className={FIELD}>
                                            <option value="">Pilih role...</option>
                                            {options.roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                                        </select>
                                        {errors[`steps.${index}.approver_role`] && <p className="mt-1 text-xs text-red-600">{errors[`steps.${index}.approver_role`]}</p>}
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-slate-900">Cakupan Unit</label>
                                        <select value={step.unit_scope} onChange={(e) => update(index, { unit_scope: e.target.value })} className={FIELD}>
                                            {options.scopes.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                                        </select>
                                        {errors[`steps.${index}.unit_scope`] && <p className="mt-1 text-xs text-red-600">{errors[`steps.${index}.unit_scope`]}</p>}
                                    </div>
                                </div>
                            )}

                            {step.approver_type === 'user' && (
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-slate-900">User *</label>
                                    <select value={step.approver_user_id} onChange={(e) => update(index, { approver_user_id: e.target.value })} className={FIELD}>
                                        <option value="">Pilih user...</option>
                                        {options.users.map((u) => (
                                            <option key={u.id} value={u.id}>{u.name} ({u.role ?? '-'}{u.unit ? `, ${u.unit}` : ''})</option>
                                        ))}
                                    </select>
                                    {errors[`steps.${index}.approver_user_id`] && <p className="mt-1 text-xs text-red-600">{errors[`steps.${index}.approver_user_id`]}</p>}
                                    <p className="mt-1 text-xs text-slate-500">Hanya user ini yang dapat menyetujui langkah ini.</p>
                                </div>
                            )}

                            {step.approver_type === 'atasan_unit' && (
                                <p className="text-xs text-slate-500">Otomatis: Camat bila unit pengajuan kecamatan, Lurah bila kelurahan.</p>
                            )}
                        </div>
                    ))}
                </div>

                <button type="button" onClick={add} className="flex items-center gap-1.5 text-sm font-semibold text-blue-700">
                    <Plus className="h-3.5 w-3.5" /> Tambah Langkah
                </button>

                <div className="flex items-center justify-between">
                    <button type="button" onClick={reset} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                        Kembalikan ke Default
                    </button>
                    <button type="button" onClick={save} disabled={form.processing} className="rounded-lg bg-[#1E40AF] px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                        {form.processing ? 'Menyimpan...' : 'Simpan Alur'}
                    </button>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="mb-4 text-base font-semibold text-slate-900">Riwayat Perubahan</p>
                    {logs.length === 0 ? (
                        <p className="text-sm text-slate-400">Belum ada perubahan.</p>
                    ) : (
                        <ul className="space-y-3 text-sm">
                            {logs.map((l) => (
                                <li key={l.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                                    <p className="font-semibold text-slate-900">{l.event === 'reset' ? 'Dikembalikan ke default' : 'Diubah'} oleh {l.user}</p>
                                    <p className="text-xs text-slate-500">{l.created_at}</p>
                                    <p className="mt-1 text-xs text-slate-600">Sebelum: {l.before || '-'}</p>
                                    <p className="text-xs text-slate-600">Sesudah: {l.after || '-'}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
