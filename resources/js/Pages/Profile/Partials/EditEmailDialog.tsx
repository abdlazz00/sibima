import FormDialog from '@/Components/FormDialog';
import { Input } from '@/Components/ui/base/input/input';
import { useForm } from '@inertiajs/react';

export default function EditEmailDialog({ name, email, onClose }: { name: string; email: string; onClose: () => void }) {
    const form = useForm({ name, email, current_password: '' });

    return (
        <FormDialog
            title="Ubah email"
            description="Email dipakai untuk masuk. Masukkan sandi saat ini untuk mengonfirmasi perubahan."
            processing={form.processing}
            onClose={onClose}
            onSubmit={() =>
                form.patch(route('profile.update'), {
                    preserveScroll: true,
                    onSuccess: onClose,
                    onError: () => form.reset('current_password'),
                })
            }
        >
            <Input
                label="Email baru"
                type="email"
                autoFocus
                value={form.data.email}
                onChange={(v) => form.setData('email', v)}
                isInvalid={Boolean(form.errors.email)}
                hint={form.errors.email}
            />
            <Input
                label="Sandi saat ini"
                type="password"
                value={form.data.current_password}
                onChange={(v) => form.setData('current_password', v)}
                isInvalid={Boolean(form.errors.current_password)}
                hint={form.errors.current_password}
            />
        </FormDialog>
    );
}
