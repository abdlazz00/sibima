import { Dialog, Modal, ModalOverlay } from '@/Components/ui/application/modals/modal';
import { Button } from '@/Components/ui/base/buttons/button';
import { TextArea } from '@/Components/ui/base/textarea/textarea';
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
        <ModalOverlay
            isOpen
            isDismissable={!submitting}
            isKeyboardDismissDisabled={submitting}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <Modal className="sm:max-w-md">
                <Dialog aria-labelledby="cancel-request-title">
                    <div className="w-full p-6">
                        <h3 id="cancel-request-title" className="mb-2 text-base font-bold text-slate-900">
                            Batalkan Pengajuan
                        </h3>
                        <p className="mb-4 text-xs leading-relaxed text-slate-600">{description}</p>
                        <TextArea label="Alasan Pembatalan" isRequired rows={4} maxLength={1000} value={note} onChange={setNote} />
                        <div className="mt-6 flex items-center justify-end gap-3">
                            <Button color="secondary" size="md" isDisabled={submitting} onPress={onClose}>
                                Kembali
                            </Button>
                            <Button color="primary-destructive" size="md" isLoading={submitting} isDisabled={!note.trim()} onPress={cancel}>
                                Ya, Batalkan
                            </Button>
                        </div>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
}
