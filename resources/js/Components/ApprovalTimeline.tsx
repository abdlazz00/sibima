import { tanggal, tanggalWaktu } from '@/lib/format';
import { ApprovalRequestSummary } from '@/types';

const ACTION_TITLE = {
    approve: 'Persetujuan Diberikan',
    reassign: 'Approver Dialihkan',
    cancel: 'Pengajuan Dibatalkan',
    reject: 'Pengajuan Ditolak',
} as const;

const ACTION_DOT = { approve: 'bg-emerald-600', reassign: 'bg-blue-600', cancel: 'bg-slate-500', reject: 'bg-red-600' } as const;

const NOTE_STYLE = {
    approve: 'border-emerald-100 bg-emerald-50/50 text-emerald-900',
    reassign: 'border-slate-200 bg-slate-50 text-slate-800',
    cancel: 'border-slate-200 bg-slate-50 text-slate-800',
    reject: 'border-red-100 bg-red-50/70 text-red-900',
} as const;

export default function ApprovalTimeline({
    request,
    createdTitle,
    creatorName,
    createdAt,
}: {
    request: ApprovalRequestSummary;
    createdTitle: string;
    creatorName?: string;
    createdAt?: string;
}) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <h2 className="mb-1 text-base font-bold text-slate-900">Riwayat Persetujuan &amp; Log Aktivitas</h2>
            <p className="mb-6 text-xs text-slate-500">Catatan audit trail seluruh tindakan pada pengajuan ini</p>

            <ol className="relative space-y-6 border-l border-slate-200 pl-6">
                <li className="relative">
                    <span className="absolute -left-[31px] top-0.5 size-4 rounded-full bg-blue-600 ring-4 ring-white" />
                    <p className="text-sm font-bold text-slate-900">{createdTitle}</p>
                    <p className="text-xs text-slate-500">
                        Diajukan oleh <span className="font-semibold text-slate-700">{creatorName ?? 'Pengguna'}</span>
                        {createdAt && <> pada {tanggal(createdAt)}</>}
                    </p>
                </li>

                {request.actions?.map((action) => (
                    <li key={action.id} className="relative space-y-1">
                        <span className={`absolute -left-[31px] top-0.5 size-4 rounded-full ring-4 ring-white ${ACTION_DOT[action.action]}`} />
                        <p className="text-sm font-bold text-slate-900">{ACTION_TITLE[action.action]}</p>
                        <p className="text-xs text-slate-500">
                            Diproses oleh <span className="font-semibold text-slate-700">{action.user?.name ?? 'Pejabat Pemeriksa'}</span> pada{' '}
                            {tanggalWaktu(action.created_at)}
                        </p>
                        {action.note && (
                            <div className={`mt-2 rounded-lg border p-3 text-xs ${NOTE_STYLE[action.action]}`}>
                                <span className="font-semibold">Catatan:</span> {action.note}
                            </div>
                        )}
                    </li>
                ))}
            </ol>
        </div>
    );
}
