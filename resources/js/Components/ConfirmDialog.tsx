import { Dialog, Modal, ModalOverlay } from '@/Components/ui/application/modals/modal';
import { Button } from '@/Components/ui/base/buttons/button';
import { Trash01 } from '@untitledui/icons';
import { ReactNode } from 'react';

export default function ConfirmDialog({
    title,
    children,
    confirmLabel,
    isLoading = false,
    onConfirm,
    onClose,
}: {
    title: string;
    children: ReactNode;
    confirmLabel: string;
    isLoading?: boolean;
    onConfirm: () => void;
    onClose: () => void;
}) {
    return (
        <ModalOverlay
            isOpen
            isDismissable={!isLoading}
            isKeyboardDismissDisabled={isLoading}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <Modal className="sm:max-w-md">
                <Dialog role="alertdialog" aria-labelledby="confirm-dialog-title">
                    <div className="w-full p-6">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                                <Trash01 className="size-5" aria-hidden="true" />
                            </div>
                            <div>
                                <h3 id="confirm-dialog-title" className="text-base font-bold text-slate-900">
                                    {title}
                                </h3>
                                <p className="text-xs text-slate-500">Tindakan ini tidak dapat dibatalkan.</p>
                            </div>
                        </div>
                        <div className="mb-6 text-sm text-slate-600">{children}</div>
                        <div className="flex items-center justify-end gap-3">
                            <Button color="secondary" size="md" isDisabled={isLoading} onPress={onClose}>
                                Batal
                            </Button>
                            <Button color="primary-destructive" size="md" isLoading={isLoading} onPress={onConfirm}>
                                {confirmLabel}
                            </Button>
                        </div>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
}
