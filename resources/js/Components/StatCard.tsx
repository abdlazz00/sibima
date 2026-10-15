import { Tone, TONE } from '@/lib/tone';
import { ComponentType, ReactNode } from 'react';

export default function StatCard({
    label,
    value,
    note,
    badge,
    icon: Icon,
    tone = 'blue',
}: {
    label: string;
    value: string;
    note?: string;
    badge?: ReactNode;
    icon?: ComponentType<{ className?: string }>;
    tone?: Tone;
}) {
    const t = TONE[tone];

    // Angka panjang (mis. rupiah) diperkecil agar tidak terputus di tengah angka.
    const size = value.length > 11 ? 'text-2xl leading-8' : 'text-[28px] leading-9 sm:text-[32px] sm:leading-10';

    return (
        <div className={`rounded-xl border p-5 shadow-xs ${t.card}`}>
            <div className="flex items-center gap-3">
                {Icon && (
                    <span className={`flex size-12 shrink-0 items-center justify-center rounded-full ${t.chip}`}>
                        <Icon className="size-6" aria-hidden="true" />
                    </span>
                )}
                <p className="min-w-0 text-sm font-semibold text-slate-700">{label}</p>
            </div>
            <p className={`mt-3 font-bold tracking-tight break-words tabular-nums ${size} ${t.value}`}>{value}</p>
            {badge && <div className="mt-2">{badge}</div>}
            {note && <p className="mt-1 text-sm text-slate-600">{note}</p>}
        </div>
    );
}
