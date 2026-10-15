import FormDialog from '@/Components/FormDialog';
import { Input } from '@/Components/ui/base/input/input';
import { useForm } from '@inertiajs/react';

export default function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
    const form = useForm({ current_password: '', password: '', password_confirmation: '' });

    return (
        <FormDialog
            title="Ubah kata sandi"
            description="Gunakan sandi yang panjang dan acak agar akun tetap aman."
            processing={form.processing}
            onClose={onClose}
            onSubmit={() =>
                form.put(route('password.update'), {
                    preserveScroll: true,
                    onSuccess: onClose,
                    onError: () => form.reset('password', 'password_confirmation'),
                })
            }
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
            <Input
                label="Sandi baru"
                type="password"
                value={form.data.password}
                onChange={(v) => form.setData('password', v)}
                isInvalid={Boolean(form.errors.password)}
                hint={form.errors.password}
            />
            <Input
                label="Ulangi sandi baru"
                type="password"
                value={form.data.password_confirmation}
                onChange={(v) => form.setData('password_confirmation', v)}
            />
        </FormDialog>
    );
}
