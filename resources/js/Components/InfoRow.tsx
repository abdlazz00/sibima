import { ReactNode } from 'react';

export default function InfoRow({ label, children, action }: { label: string; children: ReactNode; action?: ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4 py-3.5">
            <dt className="w-28 shrink-0 text-sm font-medium text-slate-500 sm:w-36">{label}</dt>
            <dd className="min-w-0 flex-1 truncate text-sm text-slate-900">{children}</dd>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}
