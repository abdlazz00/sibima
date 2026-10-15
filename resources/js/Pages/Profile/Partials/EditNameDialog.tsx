import FormDialog from '@/Components/FormDialog';
import { Input } from '@/Components/ui/base/input/input';
import { useForm } from '@inertiajs/react';

export default function EditNameDialog({ name, email, onClose }: { name: string; email: string; onClose: () => void }) {
    const form = useForm({ name, email });

    return (
        <FormDialog
            title="Ubah nama"
            processing={form.processing}
            onClose={onClose}
            onSubmit={() => form.patch(route('profile.update'), { preserveScroll: true, onSuccess: onClose })}
        >
            <Input
                label="Nama"
                autoFocus
                value={form.data.name}
                onChange={(v) => form.setData('name', v)}
                isInvalid={Boolean(form.errors.name)}
                hint={form.errors.name}
            />
        </FormDialog>
    );
}
