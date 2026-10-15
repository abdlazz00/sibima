import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { tanggal } from '@/lib/format';
import { UNIT_SCOPE_LABEL } from '@/lib/unitScope';
import { PageProps, ProfileAkun } from '@/types';
import { usePage } from '@inertiajs/react';
import { ReactNode, useState } from 'react';
import ChangePasswordDialog from './ChangePasswordDialog';
import EditEmailDialog from './EditEmailDialog';
import EditNameDialog from './EditNameDialog';

type DialogKey = 'nama' | 'email' | 'sandi' | null;

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section>
            <h3 className="border-b border-slate-200 pb-2 text-base font-semibold text-slate-900">{title}</h3>
            <dl className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">{children}</dl>
        </section>
    );
}

function Field({ label, children, action }: { label: string; children: ReactNode; action?: ReactNode }) {
    return (
        <div className="min-w-0">
            <dt className="text-sm font-medium text-slate-500">{label}</dt>
            <dd className="mt-1 flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-sm text-slate-900">{children}</span>
                {action && <span className="shrink-0">{action}</span>}
            </dd>
        </div>
    );
}

export default function ProfileDetails({ akun }: { akun: ProfileAkun }) {
    const user = usePage<PageProps>().props.auth.user;
    const [dialog, setDialog] = useState<DialogKey>(null);
    const close = () => setDialog(null);
    const name = user?.name ?? '';
    const email = user?.email ?? '';

    const change = (key: DialogKey, label: string) => (
        <Button color="secondary" size="sm" aria-label={`Ubah ${label}`} onPress={() => setDialog(key)}>
            Ubah
        </Button>
    );

    return (
        <div className="min-w-0 space-y-8">
            <div>
                <h2 className="truncate text-xl font-bold text-slate-900">{name}</h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    {akun.role && (
                        <Badge type="color" size="sm" color="blue" className="rounded-sm">
                            {akun.role}
                        </Badge>
                    )}
                    <Badge type="color" size="sm" color={akun.aktif ? 'success' : 'gray'} className="rounded-sm">
                        {akun.aktif ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                </div>
            </div>

            <Section title="Data Pribadi">
                <Field label="Nama" action={change('nama', 'nama')}>
                    {name}
                </Field>
                <Field label="Email" action={change('email', 'email')}>
                    {email}
                </Field>
                <Field label="NIP">{akun.nip ?? '—'}</Field>
                <Field label="Role">{akun.role ?? '—'}</Field>
                <Field label="Unit">{akun.unit ?? '—'}</Field>
                <Field label="Cakupan data">{UNIT_SCOPE_LABEL[akun.cakupan] ?? akun.cakupan}</Field>
            </Section>

            <Section title="Kredensial">
                <Field label="Kata sandi" action={change('sandi', 'kata sandi')}>
                    {akun.sandi_diubah ? `Terakhir diubah ${tanggal(akun.sandi_diubah)}` : '••••••••'}
                </Field>
            </Section>

            {dialog === 'nama' && <EditNameDialog name={name} email={email} onClose={close} />}
            {dialog === 'email' && <EditEmailDialog name={name} email={email} onClose={close} />}
            {dialog === 'sandi' && <ChangePasswordDialog onClose={close} />}
        </div>
    );
}
