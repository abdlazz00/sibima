import ConfirmDialog from '@/Components/ConfirmDialog';
import { Badge } from '@/Components/ui/base/badges/badges';
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

export default function ProfileHeader({ akun }: { akun: ProfileAkun }) {
    const user = usePage<PageProps>().props.auth.user;
    const name = user?.name ?? 'Pengguna';
    const [changing, setChanging] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [busy, setBusy] = useState(false);

    return (
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xs sm:flex-row sm:items-center">
            {user?.foto_profile_url ? (
                <img src={user.foto_profile_url} alt={name} className="size-16 shrink-0 rounded-full border border-slate-200 object-cover" />
            ) : (
                <div className="flex size-16 shrink-0 select-none items-center justify-center rounded-full bg-blue-800 text-xl font-bold text-white">
                    {initials(name)}
                </div>
            )}
            <div className="min-w-0 flex-1">
                <h2 className="truncate text-xl font-bold text-slate-900">{name}</h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    {akun.role && (
                        <Badge type="color" size="sm" color="blue" className="rounded-sm">
                            {akun.role}
                        </Badge>
                    )}
                    {akun.unit && <span>{akun.unit}</span>}
                    <Badge type="color" size="sm" color={akun.aktif ? 'success' : 'gray'} className="rounded-sm">
                        {akun.aktif ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                </div>
            </div>
            <div className="flex flex-wrap gap-2">
                <Button color="secondary" size="md" iconLeading={Camera01} onPress={() => setChanging(true)}>
                    Ganti foto
                </Button>
                {akun.punya_foto && (
                    <Button color="secondary-destructive" size="md" onPress={() => setRemoving(true)}>
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
