import { Badge } from '@/Components/ui/base/badges/badges';
import { PageProps, ProfileAkun } from '@/types';
import { usePage } from '@inertiajs/react';

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
        </div>
    );
}
