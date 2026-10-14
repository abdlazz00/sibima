import { ApprovalRequestSummary, ApprovalStep } from '@/types';
import { Check, XClose } from '@untitledui/icons';

type StepState = 'done' | 'current' | 'upcoming' | 'rejected' | 'cancelled';

const CIRCLE: Record<StepState, string> = {
    done: 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-500/20',
    current: 'bg-amber-100 text-amber-800 ring-4 ring-amber-400/30',
    upcoming: 'bg-slate-100 text-slate-500',
    rejected: 'bg-red-100 text-red-800 ring-4 ring-red-400/30',
    cancelled: 'bg-slate-200 text-slate-600',
};

function stepState(request: ApprovalRequestSummary, order: number): StepState {
    if (request.status === 'approved') return 'done';
    if (order < request.current_step) return 'done';
    if (order === request.current_step) {
        if (request.status === 'rejected') return 'rejected';
        if (request.status === 'cancelled') return 'cancelled';
        return 'current';
    }
    return 'upcoming';
}

export default function ApprovalStepper({
    request,
    titleFor = (step) => step.label,
}: {
    request: ApprovalRequestSummary;
    titleFor?: (step: ApprovalStep) => string;
}) {
    const steps = request.steps ?? [];

    if (steps.length === 0) {
        return null;
    }

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs print:hidden">
            <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-sm font-bold text-slate-900">Tahapan Alur Persetujuan</h2>
                    <p className="text-xs text-slate-500">Alur verifikasi berjenjang sesuai kewenangan unit kerja</p>
                </div>
                <span className="shrink-0 text-xs font-medium text-slate-500">
                    Langkah {request.current_step} dari {steps.length}
                </span>
            </div>

            <ol className="flex flex-col gap-6 md:flex-row md:items-start">
                {steps.map((step, idx) => {
                    const state = stepState(request, step.step_order);
                    const approver = request.actions?.find((a) => a.action === 'approve' && a.step_order === step.step_order)?.user?.name;

                    return (
                        <li key={step.step_order} className="relative flex flex-1 flex-col gap-2">
                            <div className="flex items-center gap-3">
                                <div className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${CIRCLE[state]}`}>
                                    {state === 'done' ? (
                                        <Check className="size-4" aria-hidden="true" />
                                    ) : state === 'rejected' || state === 'cancelled' ? (
                                        <XClose className="size-4" aria-hidden="true" />
                                    ) : (
                                        step.step_order
                                    )}
                                </div>
                                {idx < steps.length - 1 && (
                                    <div className={`hidden h-0.5 flex-1 md:block ${state === 'done' ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                                )}
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-slate-900">{titleFor(step)}</p>
                                <p className="mt-0.5 text-[11px] text-slate-500">
                                    {state === 'done' && <span className="text-emerald-700">Disetujui{approver ? ` (${approver})` : ''}</span>}
                                    {state === 'rejected' && <span className="text-red-700">Ditolak</span>}
                                    {state === 'cancelled' && <span className="text-slate-600">Dibatalkan</span>}
                                    {state === 'current' && <span className="font-medium text-amber-700">Menunggu Persetujuan</span>}
                                    {state === 'upcoming' && 'Belum dimulai'}
                                </p>
                            </div>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
