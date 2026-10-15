import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { tanggalWaktu } from '@/lib/format';
import { ProfileSession } from '@/types';
import { Monitor01 } from '@untitledui/icons';
import { useState } from 'react';
import PasswordConfirmDialog from './PasswordConfirmDialog';

export default function SessionsCard({ sessions }: { sessions: ProfileSession[] }) {
    const [target, setTarget] = useState<ProfileSession | 'semua' | null>(null);
    const others = sessions.filter((s) => !s.ini);

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-base font-semibold text-slate-900">Sesi aktif</h2>
                    <p className="text-xs text-slate-500">Perangkat yang sedang masuk ke akun Anda.</p>
                </div>
                {others.length > 0 && (
                    <Button color="primary-destructive" size="md" onPress={() => setTarget('semua')}>
                        Keluar dari semua perangkat lain
                    </Button>
                )}
            </div>

            <ul className="mt-3 divide-y divide-slate-100">
                {sessions.length === 0 && <li className="py-6 text-center text-sm text-slate-400">Tidak ada sesi tercatat.</li>}
                {sessions.map((s) => (
                    <li key={s.ref} className="flex items-center gap-4 py-3.5">
                        <Monitor01 className="size-6 shrink-0 text-slate-400" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                                {s.perangkat}
                                {s.ini && (
                                    <Badge type="color" size="sm" color="success" className="rounded-sm">
                                        Perangkat ini
                                    </Badge>
                                )}
                            </p>
                            <p className="text-xs text-slate-500">
                                {s.ip ?? 'IP tidak diketahui'} · Aktif terakhir {tanggalWaktu(s.terakhir_aktif)}
                            </p>
                        </div>
                        {!s.ini && (
                            <Button color="primary-destructive" size="sm" aria-label={`Keluarkan ${s.perangkat}`} onPress={() => setTarget(s)}>
                                Keluarkan
                            </Button>
                        )}
                    </li>
                ))}
            </ul>

            {target === 'semua' && (
                <PasswordConfirmDialog
                    title="Keluar dari semua perangkat lain"
                    description="Semua sesi selain perangkat ini akan diakhiri. Masukkan sandi saat ini untuk melanjutkan."
                    submitLabel="Ya, Keluarkan Semua"
                    url={route('profile.sessions.destroy-others')}
                    onClose={() => setTarget(null)}
                />
            )}
            {target && target !== 'semua' && (
                <PasswordConfirmDialog
                    title="Keluarkan sesi"
                    description={`Sesi ${target.perangkat} akan diakhiri. Masukkan sandi saat ini untuk melanjutkan.`}
                    submitLabel="Ya, Keluarkan"
                    url={route('profile.sessions.destroy', target.ref)}
                    onClose={() => setTarget(null)}
                />
            )}
        </div>
    );
}
