import { Dialog, Modal, ModalOverlay } from '@/Components/ui/application/modals/modal';
import { Button } from '@/Components/ui/base/buttons/button';
import { Select } from '@/Components/ui/base/select/select';
import { TextArea } from '@/Components/ui/base/textarea/textarea';
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
        <ModalOverlay
            isOpen
            isDismissable={!submitting}
            isKeyboardDismissDisabled={submitting}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <Modal className="sm:max-w-md">
                <Dialog aria-labelledby="reassign-approver-title">
                    <div className="w-full space-y-4 p-6">
                        <div>
                            <h3 id="reassign-approver-title" className="mb-2 text-base font-bold text-slate-900">
                                Alihkan Approver
                            </h3>
                            <p className="text-xs leading-relaxed text-slate-600">
                                Langkah {stepOrder}
                                {stepLabel ? ` (${stepLabel})` : ''} yang sedang menunggu akan dialihkan ke satu user tertentu. Perubahan ini hanya berlaku untuk
                                pengajuan ini dan tercatat di riwayat.
                            </p>
                        </div>
                        <Select
                            label="Alihkan ke"
                            isRequired
                            placeholder="Pilih user..."
                            items={candidates.map((c) => ({ id: String(c.id), label: `${c.name} (${c.role ?? '-'}${c.unit ? `, ${c.unit}` : ''})` }))}
                            selectedKey={userId || null}
                            onSelectionChange={(key) => setUserId(String(key))}
                        >
                            {(item) => <Select.Item id={item.id} label={item.label} />}
                        </Select>
                        <TextArea label="Alasan" isRequired rows={3} maxLength={1000} value={note} onChange={setNote} />
                        <div className="flex items-center justify-end gap-3 pt-2">
                            <Button color="secondary" size="md" isDisabled={submitting} onPress={onClose}>
                                Batal
                            </Button>
                            <Button color="primary" size="md" isLoading={submitting} isDisabled={!userId || !note.trim()} onPress={submit}>
                                Alihkan
                            </Button>
                        </div>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
}
