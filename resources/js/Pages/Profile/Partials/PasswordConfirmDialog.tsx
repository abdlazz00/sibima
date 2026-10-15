import FormDialog from '@/Components/FormDialog';
import { Input } from '@/Components/ui/base/input/input';
import { useForm } from '@inertiajs/react';

export default function PasswordConfirmDialog({
    title,
    description,
    submitLabel,
    url,
    onClose,
}: {
    title: string;
    description: string;
    submitLabel: string;
    url: string;
    onClose: () => void;
}) {
    const form = useForm({ current_password: '' });

    return (
        <FormDialog
            title={title}
            description={description}
            submitLabel={submitLabel}
            destructive
            processing={form.processing}
            onClose={onClose}
            onSubmit={() => form.delete(url, { preserveScroll: true, onSuccess: onClose, onError: () => form.reset('current_password') })}
        >
            <Input
                label="Sandi saat ini"
                type="password"
                autoFocus
                value={form.data.current_password}
                onChange={(v) => form.setData('current_password', v)}
                isInvalid={Boolean(form.errors.current_password)}
                hint={form.errors.current_password}
            />
        </FormDialog>
    );
}
