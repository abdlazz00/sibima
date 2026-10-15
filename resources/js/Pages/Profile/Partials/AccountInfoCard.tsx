import InfoRow from '@/Components/InfoRow';
import { UNIT_SCOPE_LABEL } from '@/lib/unitScope';
import { ProfileAkun } from '@/types';

export default function AccountInfoCard({ akun }: { akun: ProfileAkun }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <h2 className="text-base font-semibold text-slate-900">Info akun</h2>
            <p className="text-xs text-slate-500">Data ini diatur oleh administrator.</p>
            <dl className="mt-3 divide-y divide-slate-100">
                <InfoRow label="NIP">{akun.nip ?? '—'}</InfoRow>
                <InfoRow label="Role">{akun.role ?? '—'}</InfoRow>
                <InfoRow label="Unit">{akun.unit ?? '—'}</InfoRow>
                <InfoRow label="Cakupan data">{UNIT_SCOPE_LABEL[akun.cakupan] ?? akun.cakupan}</InfoRow>
            </dl>
        </div>
    );
}
