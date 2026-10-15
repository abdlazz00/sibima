import { ReactNode } from 'react';

export default function StatCard({ label, value, note, badge }: { label: string; value: string; note?: string; badge?: ReactNode }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-2 break-words text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
            {badge && <div className="mt-2">{badge}</div>}
            {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
        </div>
    );
}
