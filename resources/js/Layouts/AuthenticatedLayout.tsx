import BrandMark from '@/Components/BrandMark';
import { navItemsForRole, Role } from '@/config/navigation';
import { PageProps } from '@/types';
import { Link, router, usePage } from '@inertiajs/react';
import { PropsWithChildren, ReactNode, useEffect } from 'react';

export default function AuthenticatedLayout({
    header,
    children,
}: PropsWithChildren<{ header?: ReactNode }>) {
    const { auth, flash } = usePage<PageProps>().props;
    const role = auth.user?.roles?.[0] as Role | undefined;
    const navItems = navItemsForRole(role);

    // app.tsx's router.on('navigate') hook races React's commit on SPA
    // transitions (Preline can bind to a DOM node React is about to
    // replace). useEffect fires only after this component's DOM is
    // actually committed, so it's the reliable place to (re-)init.
    useEffect(() => {
        window.HSStaticMethods?.autoInit();
    });

    return (
        <div className="flex min-h-screen bg-gray-50">
            <aside className="w-64 shrink-0 border-r border-gray-200 bg-white p-4">
                <BrandMark className="mb-6" />
                <nav className="space-y-1">
                    {navItems.map((item) =>
                        item.disabled ? (
                            <span
                                key={item.label}
                                className="block cursor-not-allowed rounded px-3 py-2 text-sm text-gray-400"
                                title="Segera hadir"
                            >
                                {item.label}
                            </span>
                        ) : (
                            <Link
                                key={item.label}
                                href={item.href}
                                className="block rounded px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                                {item.label}
                            </Link>
                        ),
                    )}
                </nav>
            </aside>

            <div className="flex flex-1 flex-col">
                <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
                    <div>
                        <p className="text-sm font-medium text-gray-800">
                            {auth.user?.name}
                        </p>
                        <p className="text-xs text-gray-500">
                            {auth.user?.unit?.name ?? 'Kecamatan Sagulung'} ·{' '}
                            {role}
                        </p>
                    </div>

                    <div className="hs-dropdown relative inline-flex">
                        <button
                            type="button"
                            className="hs-dropdown-toggle inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm text-gray-700"
                        >
                            Akun
                        </button>
                        <div className="hs-dropdown-menu hidden w-40 rounded border border-gray-200 bg-white opacity-0 shadow-md hs-dropdown-open:opacity-100">
                            <button
                                type="button"
                                onClick={() => router.post('/logout')}
                                className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                            >
                                Keluar
                            </button>
                        </div>
                    </div>
                </header>

                <main className="flex-1 p-6">
                    {flash.success && (
                        <div className="mb-4 rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                            {flash.success}
                        </div>
                    )}
                    {flash.error && (
                        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                            {flash.error}
                        </div>
                    )}
                    {header && <div className="mb-6">{header}</div>}
                    {children}
                </main>
            </div>
        </div>
    );
}
