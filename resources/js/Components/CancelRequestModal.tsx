import { router } from '@inertiajs/react';
import { useState } from 'react';

interface CancelRequestModalProps {
    approvalRequestId: number;
    onClose: () => void;
    description: string;
}

export default function CancelRequestModal({ approvalRequestId, onClose, description }: CancelRequestModalProps) {
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const cancel = () => {
        if (submitting || !note.trim()) return;
        setSubmitting(true);
        router.post(
            route('approval-requests.cancel', approvalRequestId),
            { note: note.trim() },
            { preserveScroll: true, onSuccess: onClose, onFinish: () => setSubmitting(false) },
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => !submitting && onClose()}>
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="mb-2 text-base font-bold text-slate-900">Batalkan Pengajuan</h3>
                <p className="mb-3 text-xs leading-relaxed text-slate-600">{description}</p>
                <label htmlFor="cancel-note" className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Alasan Pembatalan <span className="text-red-600">*</span>
                </label>
                <textarea
                    id="cancel-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={4}
                    maxLength={1000}
                    className="w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
                <div className="mt-6 flex items-center justify-end gap-3">
                    <button type="button" onClick={onClose} disabled={submitting} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                        Kembali
                    </button>
                    <button type="button" onClick={cancel} disabled={!note.trim() || submitting} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                        {submitting ? 'Memproses...' : 'Ya, Batalkan'}
                    </button>
                </div>
            </div>
        </div>
    );
}
