import { ReassignCandidate } from '@/types';
import { router } from '@inertiajs/react';
import { useState } from 'react';

interface ReassignApproverModalProps {
    approvalRequestId: number;
    candidates: ReassignCandidate[];
    stepOrder: number;
    stepLabel?: string;
    onClose: () => void;
}

export default function ReassignApproverModal({ approvalRequestId, candidates, stepOrder, stepLabel, onClose }: ReassignApproverModalProps) {
    const [userId, setUserId] = useState('');
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const submit = () => {
        if (submitting || !userId || !note.trim()) return;
        setSubmitting(true);
        router.post(
            route('approval-requests.reassign', approvalRequestId),
            { user_id: Number(userId), note: note.trim(), step_order: stepOrder },
            { preserveScroll: true, onSuccess: onClose, onFinish: () => setSubmitting(false) },
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => !submitting && onClose()}>
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="mb-2 text-base font-bold text-slate-900">Alihkan Approver</h3>
                <p className="mb-4 text-xs leading-relaxed text-slate-600">
                    Langkah {stepOrder}{stepLabel ? ` (${stepLabel})` : ''} yang sedang menunggu akan dialihkan ke satu user tertentu. Perubahan ini hanya berlaku untuk pengajuan ini dan tercatat di riwayat.
                </p>
                <label htmlFor="reassign-user" className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Alihkan ke <span className="text-red-600">*</span>
                </label>
                <select
                    id="reassign-user"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className="mb-4 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm focus:border-blue-600 focus:outline-none"
                >
                    <option value="">Pilih user...</option>
                    {candidates.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name} ({c.role ?? '-'}{c.unit ? `, ${c.unit}` : ''})
                        </option>
                    ))}
                </select>
                <label htmlFor="reassign-note" className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Alasan <span className="text-red-600">*</span>
                </label>
                <textarea
                    id="reassign-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
                <div className="mt-6 flex items-center justify-end gap-3">
                    <button type="button" onClick={onClose} disabled={submitting} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                        Batal
                    </button>
                    <button type="button" onClick={submit} disabled={!userId || !note.trim() || submitting} className="rounded-lg bg-[#1E40AF] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                        {submitting ? 'Memproses...' : 'Alihkan'}
                    </button>
                </div>
            </div>
        </div>
    );
}
