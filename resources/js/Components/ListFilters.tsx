import { ChevronDownIcon as ChevronDown, SearchIcon as Search, XIcon as X } from '@/Components/Icons';
import { FormEvent, PropsWithChildren, ReactNode } from 'react';

/** Kartu filter: grid dropdown rata (1/2/4 kolom). `action` tampil di bawah grid (mis. "Reset filter"). */
export function FilterCard({ children, action }: PropsWithChildren<{ action?: ReactNode }>) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
            {action && <div className="mt-3">{action}</div>}
        </div>
    );
}

export function FilterSelect({
    value,
    onChange,
    ariaLabel,
    children,
}: PropsWithChildren<{ value: string; onChange: (value: string) => void; ariaLabel: string }>) {
    return (
        <div className="relative">
            <select
                aria-label={ariaLabel}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pl-3.5 pr-8 text-sm font-medium text-slate-700 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
                {children}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
    );
}

/** Baris pencarian di bagian atas kartu tabel. */
export function TableSearch({
    value,
    onChange,
    onSubmit,
    onClear,
    placeholder,
}: {
    value: string;
    onChange: (value: string) => void;
    onSubmit: (e: FormEvent) => void;
    onClear: () => void;
    placeholder: string;
}) {
    return (
        <div className="border-b border-slate-200 p-4">
            <form onSubmit={onSubmit} className="relative max-w-sm">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    aria-label="Cari"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                {value && (
                    <button
                        type="button"
                        aria-label="Hapus pencarian"
                        onClick={onClear}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </form>
        </div>
    );
}
