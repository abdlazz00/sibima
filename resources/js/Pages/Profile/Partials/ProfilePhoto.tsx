import ConfirmDialog from '@/Components/ConfirmDialog';
import { Button } from '@/Components/ui/base/buttons/button';
import { PageProps, ProfileAkun } from '@/types';
import { router, usePage } from '@inertiajs/react';
import { Camera01 } from '@untitledui/icons';
import { useState } from 'react';
import ChangePhotoDialog from './ChangePhotoDialog';

const initials = (name: string) =>
    name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase();

export default function ProfilePhoto({ akun }: { akun: ProfileAkun }) {
    const user = usePage<PageProps>().props.auth.user;
    const name = user?.name ?? 'Pengguna';
    const [changing, setChanging] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [busy, setBusy] = useState(false);

    return (
        <div className="mx-auto w-full max-w-56 md:max-w-none">
            <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                {user?.foto_profile_url ? (
                    <img src={user.foto_profile_url} alt={name} className="size-full object-cover" />
                ) : (
                    <div className="flex size-full select-none items-center justify-center bg-gradient-to-br from-blue-100 to-blue-300 text-6xl font-bold text-blue-800">
                        {initials(name)}
                    </div>
                )}
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Button color="secondary" size="sm" iconLeading={Camera01} onPress={() => setChanging(true)}>
                    Ganti foto
                </Button>
                {akun.punya_foto && (
                    <Button color="secondary-destructive" size="sm" onPress={() => setRemoving(true)}>
                        Hapus foto
                    </Button>
                )}
            </div>

            {changing && <ChangePhotoDialog onClose={() => setChanging(false)} />}
            {removing && (
                <ConfirmDialog
                    title="Hapus foto profil"
                    confirmLabel="Ya, Hapus Foto"
                    isLoading={busy}
                    onConfirm={() => {
                        setBusy(true);
                        router.delete(route('profile.photo.destroy'), {
                            preserveScroll: true,
                            onFinish: () => {
                                setBusy(false);
                                setRemoving(false);
                            },
                        });
                    }}
                    onClose={() => setRemoving(false)}
                >
                    Foto profil akan dihapus. Bila akun terhubung ke data pegawai yang punya foto, foto itulah yang tampil.
                </ConfirmDialog>
            )}
        </div>
    );
}
