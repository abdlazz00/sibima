import { Tone, TONE } from '@/lib/tone';
import { ComponentType, ReactNode } from 'react';

export default function ReportCard({
    title,
    description,
    aside,
    icon: Icon,
    tone = 'slate',
    flush = false,
    className = '',
    children,
}: {
    title: string;
    description?: string;
    aside?: ReactNode;
    icon?: ComponentType<{ className?: string }>;
    tone?: Tone;
    /** Tanpa padding isi (untuk tabel); judul diberi garis bawah. */
    flush?: boolean;
    className?: string;
    children: ReactNode;
}) {
    const t = TONE[tone];

    return (
        <div
            className={`rounded-xl border border-t-[3px] border-slate-200 ${t.accent} bg-white shadow-xs ${flush ? 'overflow-hidden' : 'p-5'} ${className}`}
        >
            <div
                className={
                    flush
                        ? 'flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-5 py-4'
                        : 'mb-4 flex flex-wrap items-start justify-between gap-3'
                }
            >
                <div className="flex items-center gap-3">
                    {Icon && (
                        <span
                            className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${t.soft}`}
                        >
                            <Icon className="size-5" aria-hidden="true" />
                        </span>
                    )}
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900">
                            {title}
                        </h2>
                        {description && (
                            <p className="mt-0.5 text-sm text-slate-600">
                                {description}
                            </p>
                        )}
                    </div>
                </div>
                {aside}
            </div>
            {children}
        </div>
    );
}
