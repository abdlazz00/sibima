import { ReactNode } from 'react';

export default function ReportCard({
    title,
    description,
    aside,
    flush = false,
    className = '',
    children,
}: {
    title: string;
    description?: string;
    aside?: ReactNode;
    /** Tanpa padding isi (untuk tabel); judul diberi garis bawah. */
    flush?: boolean;
    className?: string;
    children: ReactNode;
}) {
    return (
        <div className={`rounded-xl border border-slate-200 bg-white shadow-xs ${flush ? 'overflow-hidden' : 'p-5'} ${className}`}>
            <div className={flush ? 'flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-5 py-4' : 'mb-4'}>
                <div>
                    <p className="text-lg font-semibold text-slate-900">{title}</p>
                    {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
                </div>
                {aside}
            </div>
            {children}
        </div>
    );
}
