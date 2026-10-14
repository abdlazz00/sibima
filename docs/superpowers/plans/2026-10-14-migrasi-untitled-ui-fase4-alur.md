# Migrasi Untitled UI, Fase 4: Pengaturan Alur Persetujuan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memigrasikan halaman Pengaturan Alur (`WorkflowSettings/Index`, `WorkflowSettings/Edit`) ke komponen Untitled UI tanpa mengubah logika, props Inertia, atau backend, dan mengganti `window.confirm` dengan `ConfirmDialog`.

**Architecture:** Hanya frontend. `Index` memakai `PageHeader` dan daftar baris dengan `Button`. `Edit` memakai `Input`/`Select` per langkah, `Button` ikon untuk Naik/Turun/Hapus (dengan `aria-label` per langkah), dan `ConfirmDialog` untuk "Kembalikan ke Default".

**Tech Stack:** React 19, Inertia 2, Tailwind 4, Untitled UI (React Aria Components), `@untitledui/icons`.

**Spec:** `docs/superpowers/specs/2026-10-14-migrasi-untitled-ui-design.md` §3.5 butir 4 (Pengaturan). Pola acuan: plan Pengguna dan Role di `docs/superpowers/plans/`.

Plan ini sudah memuat hasil review ponytail dan impeccable (2026-10-14).

## Global Constraints

- Hanya komponen Untitled UI gratis. Panduan UI/UX menang untuk identitas; Untitled UI menang untuk semantik, keyboard, fokus.
- Logika tidak berubah: `useForm({ steps })`, `toStepForm`, `update`/`move`/`add`/`remove`, `transform` pada `save` (pemetaan `approver_role`/`approver_user_id`/`unit_scope` per tipe), `form.put(workflow-settings.update, { preserveScroll })`, `router.post(workflow-settings.reset)` dengan pemuatan ulang langkah dari props baru, galat `steps` dan `steps.N.field`, peringatan `can_act`, props Inertia, dan nama berkas.
- `window.confirm` diganti `ConfirmDialog` dengan teks yang sama.
- Warna tombol: Atur `secondary-green`; Simpan `primary`; Tambah Langkah `secondary-brand`; Naik/Turun `secondary` (ikon); Hapus langkah `secondary-destructive`; Kembalikan ke Default `secondary`.
- Kunci kosong tidak valid pada `Select`: pilihan yang belum dipilih memakai `selectedKey={… || null}` dengan `placeholder`.
- Impor `@/Components/...` berhuruf besar; tanpa komponen Breeze atau `@/Components/Icons`; tanpa dependensi baru.
- Verifikasi: `npx tsc --noEmit`, `npm run build`, test backend `--filter='Workflow'`. Cek runtime singkat di browser diperbolehkan untuk menangkap error (tanpa menyimpan perubahan permanen); penilaian visual oleh pengguna di gerbang.
- Git: commit per task di `main`, tanpa trailer Co-Authored-By, stage dengan path eksplisit, tanpa push.

## Review Focus

1. **Urutan langkah tidak boleh rusak saat Naik/Turun/Hapus**: indeks dipakai sebagai kunci dan galat server dipetakan per indeks (`steps.N.field`). Pagar: logika `move`/`remove` tidak diubah (Task 2); butir gerbang.
2. **Tombol Naik di langkah pertama dan Turun di langkah terakhir nonaktif**, dan setiap tombol ikon punya nama yang jelas ("Naikkan langkah 2"). Pagar: `isDisabled` + `aria-label` (Task 2).
3. **Ganti tipe approver** menampilkan field yang sesuai (Role + Cakupan, User, atau keterangan otomatis) dan saat disimpan field tipe lain dikosongkan oleh `transform`. Pagar: `transform` tidak diubah.
4. **Peringatan `can_act`** (role/user belum memegang izin Setujui/Tolak) tetap tampil dan tidak menimpa galat validasi. Pagar: galat didahulukan, peringatan sebagai petunjuk (Task 2).
5. **"Kembalikan ke Default" mengganti langkah yang sedang diedit** dan menghapus perubahan yang belum disimpan; konfirmasi tidak boleh tertutup saat permintaan berjalan, dan galat lama dihapus setelah berhasil. Pagar: `ConfirmDialog` + `onSuccess` yang sama (Task 2).
6. **Pengguna pembaca layar tidak tahu hasil Naik/Turun/Tambah/Hapus** karena fokus tombol ikut berpindah. Pagar: wilayah `aria-live` yang mengumumkan posisi baru (Task 2).
7. **Alur tanpa langkah / daftar alur kosong** tidak crash dan menampilkan keterangan. Pagar: Task 1 dan 2.

---

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `resources/js/Pages/WorkflowSettings/Index.tsx` | Daftar alur |
| `resources/js/Pages/WorkflowSettings/Edit.tsx` | Editor langkah alur + riwayat |

---

### Task 1: `Index`

**Files:**
- Modify: `resources/js/Pages/WorkflowSettings/Index.tsx` (ganti seluruh isi)

**Interfaces:**
- Consumes: `PageHeader`, `Button`. Produces: halaman dengan props Inertia sama (`workflows`).

- [ ] **Step 1: Tulis ulang `Index.tsx`**

```tsx
import PageHeader from '@/Components/PageHeader';
import { Button } from '@/Components/ui/base/buttons/button';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head } from '@inertiajs/react';

interface WorkflowRow {
    id: number;
    code: string;
    name: string;
    summary: string;
    step_count: number;
    pending_count: number;
    last_changed_at: string | null;
}

interface IndexProps extends PageProps {
    workflows: WorkflowRow[];
}

export default function Index({ workflows }: IndexProps) {
    return (
        <AuthenticatedLayout>
            <Head title="Pengaturan Alur Persetujuan" />

            <div className="space-y-6">
                <PageHeader crumbs={[{ label: 'Pengaturan Alur' }]} title="Pengaturan Alur Persetujuan" />
                <p className="-mt-3 text-sm text-slate-500">
                    Atur langkah dan approver tiap alur. Perubahan hanya berlaku untuk pengajuan baru.
                </p>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    {workflows.length === 0 ? (
                        <p className="py-12 text-center text-sm text-slate-400">Belum ada alur persetujuan.</p>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {workflows.map((w) => (
                                <li key={w.id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50/60">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-slate-900">{w.name}</p>
                                        <p className="truncate text-xs text-slate-500">{w.summary || 'Belum ada langkah'}</p>
                                        <p className="mt-1 text-[11px] tabular-nums text-slate-400">
                                            {w.step_count} langkah · {w.pending_count} pengajuan berjalan
                                            {w.last_changed_at ? ` · diubah ${new Date(w.last_changed_at).toLocaleDateString('id-ID')}` : ''}
                                        </p>
                                    </div>
                                    <Button color="secondary-green" size="md" className="shrink-0" href={route('workflow-settings.edit', w.id)}>
                                        Atur
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
```

- [ ] **Step 2: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
php artisan test --compact --filter='Workflow'
git add resources/js/Pages/WorkflowSettings/Index.tsx
git commit -m "feat(ui): migrate the workflow list page to Untitled UI components"
```
Expected: bersih; test hijau.

---

### Task 2: `Edit`

**Files:**
- Modify: `resources/js/Pages/WorkflowSettings/Edit.tsx` (ganti seluruh isi)

**Interfaces:**
- Consumes: `PageHeader`, `ConfirmDialog`, `Input`, `Select`, `Button`; ikon `ArrowDown`, `ArrowUp`, `Plus`, `Trash01`. Produces: halaman dengan props Inertia sama.

- [ ] **Step 1: Tulis ulang `Edit.tsx`**

```tsx
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
                                            color="secondary-destructive"
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

                <Button color="secondary-brand" size="md" iconLeading={Plus} onPress={add}>
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
```
Perhatian: `Button onPress` pada tombol Simpan (bukan `type="submit"`) mempertahankan perilaku lama (tidak ada `<form>`). Prop yang berbeda dari yang diasumsikan disesuaikan dan dicatat sebagai `Ruling`.

- [ ] **Step 2: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
grep -n "window.confirm\\|@/Components/Icons" resources/js/Pages/WorkflowSettings/*.tsx
php artisan test --compact --filter='Workflow'
git add resources/js/Pages/WorkflowSettings/Edit.tsx
git commit -m "feat(ui): migrate the workflow editor page to Untitled UI components"
```
Expected: bersih; `grep` kosong; test hijau.

- [ ] **Step 3: Cek runtime singkat dan GERBANG ALUR — berhenti**

Cek di browser headless (super-admin): daftar, editor (ganti tipe approver, Naik/Turun, Tambah/Hapus langkah) tanpa menyimpan, dan dialog "Kembalikan ke Default" tanpa dikonfirmasi.

Laporkan hasil Task 1–2, `Ruling`, dan hal yang tak bisa diverifikasi tanpa browser pengguna. Minta pengguna memeriksa:
- **Daftar**: setiap alur menampilkan nama, ringkasan, jumlah langkah, pengajuan berjalan, tanggal ubah, dan tombol Atur (hijau).
- **Editor**: ganti tipe approver (Role + Cakupan, User, Atasan Unit), Naik/Turun (nonaktif di ujung), Hapus langkah, Tambah Langkah; peringatan role/user tanpa izin Setujui/Tolak; Simpan dengan nama kosong/role kosong menampilkan galat per field; Simpan berhasil; Riwayat Perubahan bertambah; "Kembalikan ke Default" (dialog, Esc menutup, langkah kembali ke default).
- Keyboard (Tab/Spasi/Esc), layar 375 px, cincin fokus.
**Jangan memulai modul berikutnya** sebelum pengguna menyatakan lolos.
