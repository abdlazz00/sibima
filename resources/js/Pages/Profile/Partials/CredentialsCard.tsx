import InfoRow from '@/Components/InfoRow';
import { Button } from '@/Components/ui/base/buttons/button';
import { tanggal } from '@/lib/format';
import { PageProps, ProfileAkun } from '@/types';
import { usePage } from '@inertiajs/react';
import { useState } from 'react';
import ChangePasswordDialog from './ChangePasswordDialog';
import EditEmailDialog from './EditEmailDialog';
import EditNameDialog from './EditNameDialog';

type DialogKey = 'nama' | 'email' | 'sandi' | null;

export default function CredentialsCard({ akun }: { akun: ProfileAkun }) {
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
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <h2 className="text-base font-semibold text-slate-900">Data masuk</h2>
            <p className="text-xs text-slate-500">Nama, email, dan kata sandi yang Anda pakai untuk masuk.</p>
            <dl className="mt-3 divide-y divide-slate-100">
                <InfoRow label="Nama" action={change('nama', 'nama')}>
                    {name}
                </InfoRow>
                <InfoRow label="Email" action={change('email', 'email')}>
                    {email}
                </InfoRow>
                <InfoRow label="Kata sandi" action={change('sandi', 'kata sandi')}>
                    {akun.sandi_diubah ? `Terakhir diubah ${tanggal(akun.sandi_diubah)}` : '••••••••'}
                </InfoRow>
            </dl>

            {dialog === 'nama' && <EditNameDialog name={name} email={email} onClose={close} />}
            {dialog === 'email' && <EditEmailDialog name={name} email={email} onClose={close} />}
            {dialog === 'sandi' && <ChangePasswordDialog onClose={close} />}
        </div>
    );
}
