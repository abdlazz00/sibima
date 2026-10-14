import { Link } from '@inertiajs/react';
import { ChevronRight } from '@untitledui/icons';
import { Fragment, ReactNode } from 'react';

export interface Crumb {
    label: string;
    href?: string;
}

export default function PageHeader({
    crumbs,
    title,
    badges,
    actions,
}: {
    crumbs: Crumb[];
    title: string;
    badges?: ReactNode;
    actions?: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <nav
                    aria-label="Breadcrumb"
                    className="mb-1 flex items-center gap-1.5 text-xs text-slate-500"
                >
                    <Link href={route('dashboard')} className="hover:text-blue-700">
                        Home
                    </Link>
                    {crumbs.map((crumb) => (
                        <Fragment key={crumb.label}>
                            <ChevronRight className="size-3 text-slate-400" aria-hidden="true" />
                            {crumb.href ? (
                                <Link href={crumb.href} className="hover:text-blue-700">
                                    {crumb.label}
                                </Link>
                            ) : (
                                <span className="font-medium text-slate-800" aria-current="page">
                                    {crumb.label}
                                </span>
                            )}
                        </Fragment>
                    ))}
                </nav>
                <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
                    {badges}
                </div>
            </div>
            {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
        </div>
    );
}
