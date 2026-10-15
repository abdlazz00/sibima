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

    return (
        <div className={`rounded-xl border p-5 shadow-xs ${t.card}`}>
            <div className="flex items-start gap-4">
                {Icon && (
                    <span
                        className={`flex size-12 shrink-0 items-center justify-center rounded-full ${t.chip}`}
                    >
                        <Icon className="size-6" aria-hidden="true" />
                    </span>
                )}
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-700">
                        {label}
                    </p>
                    <p
                        className={`mt-1 text-[28px] leading-9 font-bold tracking-tight break-words tabular-nums sm:text-[32px] sm:leading-10 ${t.value}`}
                    >
                        {value}
                    </p>
                    {badge && <div className="mt-2">{badge}</div>}
                    {note && (
                        <p className="mt-1 text-sm text-slate-600">{note}</p>
                    )}
                </div>
            </div>
        </div>
    );
}
