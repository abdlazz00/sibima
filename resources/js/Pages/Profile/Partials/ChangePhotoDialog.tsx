import FormDialog from '@/Components/FormDialog';
import { useForm } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { Button } from '@/Components/ui/base/buttons/button';
import { Camera01 } from '@untitledui/icons';
import { FileTrigger } from 'react-aria-components';

export default function ChangePhotoDialog({ onClose }: { onClose: () => void }) {
    const form = useForm<{ foto: File | null }>({ foto: null });
    const [preview, setPreview] = useState<string | null>(null);

    useEffect(() => {
        if (!form.data.foto) {
            setPreview(null);
            return;
        }
        const url = URL.createObjectURL(form.data.foto);
        setPreview(url);

        return () => URL.revokeObjectURL(url);
    }, [form.data.foto]);

    return (
        <FormDialog
            title="Ganti foto profil"
            description="Format JPG, PNG, atau WEBP, maksimal 2 MB."
            processing={form.processing}
            submitDisabled={!form.data.foto}
            onClose={onClose}
            onSubmit={() => {
                if (!form.data.foto) return;
                form.post(route('profile.photo.store'), { forceFormData: true, preserveScroll: true, onSuccess: onClose });
            }}
        >
            <div className="flex flex-col items-center gap-3">
                {preview ? (
                    <img src={preview} alt="Pratinjau foto" className="size-28 rounded-full border border-slate-200 object-cover" />
                ) : (
                    <div className="flex size-28 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <Camera01 className="size-8" aria-hidden="true" />
                    </div>
                )}
                <FileTrigger acceptedFileTypes={['image/jpeg', 'image/png', 'image/webp']} onSelect={(files) => form.setData('foto', files?.[0] ?? null)}>
                    <Button color="primary-teal" size="md">
                        Pilih foto
                    </Button>
                </FileTrigger>
                {form.errors.foto && <p className="text-sm text-red-700">{form.errors.foto}</p>}
            </div>
        </FormDialog>
    );
}
