import { Dialog, Modal, ModalOverlay } from '@/Components/ui/application/modals/modal';
import { Button } from '@/Components/ui/base/buttons/button';
import { TextArea } from '@/Components/ui/base/textarea/textarea';
import { router } from '@inertiajs/react';
import { useState } from 'react';

interface RejectRequestModalProps {
    approvalRequestId: number;
    onClose: () => void;
    description: string;
}

export default function RejectRequestModal({ approvalRequestId, onClose, description }: RejectRequestModalProps) {
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const reject = () => {
        if (submitting || !note.trim()) return;
        setSubmitting(true);
        router.post(
            route('approval-requests.reject', approvalRequestId),
            { note: note.trim() },
            { preserveScroll: true, onSuccess: onClose, onFinish: () => setSubmitting(false) },
        );
    };

    return (
        <ModalOverlay
            isOpen
            isDismissable={!submitting}
            isKeyboardDismissDisabled={submitting}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <Modal className="sm:max-w-md">
                <Dialog aria-labelledby="reject-request-title">
                    <div className="w-full p-6">
                        <h3 id="reject-request-title" className="mb-2 text-base font-bold text-slate-900">
                            Tolak Pengajuan
                        </h3>
                        <p className="mb-4 text-xs leading-relaxed text-slate-600">{description}</p>
                        <TextArea label="Alasan Penolakan" isRequired rows={4} maxLength={1000} value={note} onChange={setNote} />
                        <div className="mt-6 flex items-center justify-end gap-3">
                            <Button color="secondary" size="md" isDisabled={submitting} onPress={onClose}>
                                Batal
                            </Button>
                            <Button color="primary-destructive" size="md" isLoading={submitting} isDisabled={!note.trim()} onPress={reject}>
                                Ya, Tolak
                            </Button>
                        </div>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
}
