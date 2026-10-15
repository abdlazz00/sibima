import { Dialog, Modal, ModalOverlay } from '@/Components/ui/application/modals/modal';
import { Button } from '@/Components/ui/base/buttons/button';
import { FormEvent, ReactNode } from 'react';

export default function FormDialog({
    title,
    description,
    submitLabel = 'Simpan',
    destructive = false,
    processing,
    onSubmit,
    onClose,
    children,
}: {
    title: string;
    description?: string;
    submitLabel?: string;
    destructive?: boolean;
    processing: boolean;
    onSubmit: () => void;
    onClose: () => void;
    children: ReactNode;
}) {
    const submit = (e: FormEvent) => {
        e.preventDefault();
        onSubmit();
    };

    return (
        <ModalOverlay
            isOpen
            isDismissable={!processing}
            isKeyboardDismissDisabled={processing}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <Modal className="sm:max-w-md">
                <Dialog aria-labelledby="form-dialog-title">
                    <form onSubmit={submit} className="w-full p-6">
                        <h3 id="form-dialog-title" className="text-base font-bold text-slate-900">
                            {title}
                        </h3>
                        {description && <p className="mt-1 text-xs leading-relaxed text-slate-600">{description}</p>}
                        <div className="mt-4 space-y-4">{children}</div>
                        <div className="mt-6 flex items-center justify-end gap-3">
                            <Button color="secondary" size="md" isDisabled={processing} onPress={onClose}>
                                Batal
                            </Button>
                            <Button type="submit" color={destructive ? 'primary-destructive' : 'primary'} size="md" isLoading={processing}>
                                {submitLabel}
                            </Button>
                        </div>
                    </form>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
}
