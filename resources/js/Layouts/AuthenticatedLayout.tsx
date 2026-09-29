import BrandMark from '@/Components/BrandMark';
import NavIcon from '@/Components/NavIcon';
import {
    formatRole,
    getInitials,
    navGroupsForRole,
    Role,
} from '@/config/navigation';
import { PageProps } from '@/types';
import { Link, router, usePage } from '@inertiajs/react';
import {
    PropsWithChildren,
    ReactNode,
    useEffect,
    useRef,
    useState,
} from 'react';

export default function AuthenticatedLayout({
    header,
    children,
}: PropsWithChildren<{ header?: ReactNode }>) {
    const { auth, flash, notifications, pending_approvals } =
        usePage<PageProps>().props;
    const { url } = usePage();
    const role = auth.user?.roles?.[0] as Role | undefined;
    const navGroups = navGroupsForRole(role);

    const badgeFor = (item: { href: string; badge?: string | number }) =>
        item.href === '/persetujuan' ? pending_approvals || undefined : item.badge;

    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isNotifOpen, setIsNotifOpen] = useState(false);

    const profileRef = useRef<HTMLDivElement>(null);
    const notifRef = useRef<HTMLDivElement>(null);

    // Keep Preline auto-init for any child components using Preline classes
    useEffect(() => {
        window.HSStaticMethods?.autoInit();
    });

    // Close dropdowns when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                profileRef.current &&
                !profileRef.current.contains(event.target as Node)
            ) {
                setIsProfileOpen(false);
            }
            if (
                notifRef.current &&
                !notifRef.current.contains(event.target as Node)
            ) {
                setIsNotifOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Close mobile menu on route change
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [url]);

    const isItemActive = (href: string) => {
        if (href === '#' || !href) return false;
        if (href === '/dashboard') {
            return url === '/dashboard' || url === '/';
        }
        return url.startsWith(href);
    };

    const userInitials = getInitials(auth.user?.name);
    const userRole = formatRole(role);
    const unitName = auth.user?.unit?.name ?? 'Kantor Kec. Sagulung';

    const renderNavContent = () => (
        <>
            {/* Brand Header */}
            <div className="flex h-[88px] shrink-0 items-center justify-between border-b border-white/10 px-5">
                <Link href="/dashboard" className="flex items-center gap-3">
                    <BrandMark />
                </Link>
                {isMobileMenuOpen && (
                    <button
                        type="button"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white md:hidden"
                        aria-label="Tutup menu"
                    >
                        <svg
                            className="h-5 w-5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Nav Body */}
            <nav className="flex-1 select-none space-y-5 overflow-y-auto px-4 py-5">
                {navGroups.map((group) => (
                    <div key={group.title} className="space-y-1">
                        <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            {group.title}
                        </div>
                        <div className="space-y-1">
                            {group.items.map((item) => {
                                const active = isItemActive(item.href);

                                if (item.disabled) {
                                    return (
                                        <div
                                            key={item.label}
                                            className="flex h-10 w-full cursor-not-allowed items-center justify-between rounded-lg px-3 text-sm font-medium text-slate-500 opacity-60 transition"
                                            title="Segera hadir"
                                        >
                                            <div className="flex items-center gap-3 truncate">
                                                <NavIcon
                                                    name={item.icon}
                                                    className="h-[18px] w-[18px] shrink-0 text-slate-500"
                                                />
                                                <span className="truncate">
                                                    {item.label}
                                                </span>
                                            </div>
                                            {badgeFor(item) !== undefined && (
                                                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                                                    {badgeFor(item)}
                                                </span>
                                            )}
                                        </div>
                                    );
                                }

                                return (
                                    <Link
                                        key={item.label}
                                        href={item.href}
                                        aria-current={
                                            active ? 'page' : undefined
                                        }
                                        className={`flex h-10 w-full items-center justify-between rounded-lg px-3 text-sm font-medium transition ${
                                            active
                                                ? 'bg-[#1E40AF] text-white shadow-sm'
                                                : 'text-slate-300 hover:bg-white/5 hover:text-white'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 truncate">
                                            <NavIcon
                                                name={item.icon}
                                                className={`h-[18px] w-[18px] shrink-0 ${
                                                    active
                                                        ? 'text-white'
                                                        : 'text-slate-400'
                                                }`}
                                            />
                                            <span className="truncate">
                                                {item.label}
                                            </span>
                                        </div>
                                        {badgeFor(item) !== undefined && (
                                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                                                {badgeFor(item)}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>
        </>
    );

    return (
        <div className="flex min-h-screen bg-[#F8FAFC]">
            {/* Desktop Sidebar */}
            <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col bg-[#0F2440] md:flex">
                {renderNavContent()}
            </aside>

            {/* Mobile Drawer Backdrop & Sidebar */}
            {isMobileMenuOpen && (
                <div
                    className="backdrop-blur-xs fixed inset-0 z-40 bg-black/60 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}
            <aside
                className={`fixed inset-y-0 left-0 z-50 flex h-full w-[260px] flex-col bg-[#0F2440] shadow-2xl transition-transform duration-200 ease-in-out md:hidden ${
                    isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                {renderNavContent()}
            </aside>

            {/* Main Column */}
            <div className="flex min-w-0 flex-1 flex-col">
                {/* App Header (Top Bar) */}
                <header className="sticky top-0 z-30 flex h-[88px] items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-8">
                    {/* Left: Hamburger (Mobile) */}
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 md:hidden"
                            aria-label="Buka menu navigasi"
                        >
                            <svg
                                className="h-6 w-6"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <line x1="4" x2="20" y1="12" y2="12" />
                                <line x1="4" x2="20" y1="6" y2="6" />
                                <line x1="4" x2="20" y1="18" y2="18" />
                            </svg>
                        </button>
                    </div>

                    {/* Right: Location Badge, Bell Notification, Divider, User Info */}
                    <div className="flex items-center gap-3 sm:gap-5">
                        {/* Location Badge */}
                        <div className="hidden select-none items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/70 px-3 py-1.5 text-xs font-medium text-blue-700 sm:inline-flex">
                            <svg
                                className="h-3.5 w-3.5 shrink-0 text-blue-600"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
                                <circle cx="12" cy="10" r="3" />
                            </svg>
                            <span className="max-w-[180px] truncate">
                                {unitName}
                            </span>
                        </div>

                        {/* Notification Bell */}
                        <div className="relative" ref={notifRef}>
                            <button
                                type="button"
                                onClick={() => setIsNotifOpen(!isNotifOpen)}
                                className="relative rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none"
                                aria-label="Notifikasi"
                            >
                                <svg
                                    className="h-5 w-5"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                                </svg>
                                {notifications.unread_count > 0 && (
                                    <span className="shadow-xs absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                                        {notifications.unread_count}
                                    </span>
                                )}
                            </button>

                            {isNotifOpen && (
                                <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-gray-100 bg-white p-3 shadow-lg">
                                    <div className="mb-2 flex items-center justify-between border-b border-gray-100 pb-2">
                                        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900">
                                            Notifikasi
                                        </h3>
                                        {notifications.unread_count > 0 && (
                                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">
                                                {notifications.unread_count} Baru
                                            </span>
                                        )}
                                    </div>
                                    <div className="space-y-2 text-xs text-gray-600">
                                        {notifications.items.length === 0 ? (
                                            <p className="p-2 text-center text-gray-400">Tidak ada notifikasi baru.</p>
                                        ) : (
                                            notifications.items.map((item) => (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => router.post(route('notifications.read', item.id))}
                                                    className="block w-full rounded p-2 text-left hover:bg-gray-50"
                                                >
                                                    <p className="font-medium text-gray-800">{item.message}</p>
                                                    <p className="mt-0.5 text-[11px] text-gray-500">{item.created_at}</p>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Divider */}
                        <div className="hidden h-6 w-px bg-gray-200 sm:block" />

                        {/* User Profile Dropdown */}
                        <div className="relative" ref={profileRef}>
                            <button
                                type="button"
                                onClick={() => setIsProfileOpen(!isProfileOpen)}
                                className="flex items-center gap-3 rounded-lg p-1.5 text-left transition hover:bg-gray-50 focus:outline-none"
                                aria-expanded={isProfileOpen}
                                aria-haspopup="true"
                            >
                                <div className="shadow-xs flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-[#1E40AF] text-xs font-bold text-white">
                                    {userInitials}
                                </div>
                                <div className="hidden flex-col text-left sm:flex">
                                    <span className="max-w-[140px] truncate text-sm font-semibold leading-tight text-gray-900">
                                        {auth.user?.name ?? 'Pengguna'}
                                    </span>
                                    <span className="max-w-[140px] truncate text-xs leading-tight text-gray-500">
                                        {userRole}
                                    </span>
                                </div>
                                <svg
                                    className={`h-4 w-4 text-gray-400 transition-transform duration-150 ${
                                        isProfileOpen ? 'rotate-180' : ''
                                    }`}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <path d="m6 9 6 6 6-6" />
                                </svg>
                            </button>

                            {isProfileOpen && (
                                <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-gray-100 bg-white p-1.5 shadow-lg">
                                    <div className="border-b border-gray-100 px-3 py-2">
                                        <p className="truncate text-sm font-semibold text-gray-900">
                                            {auth.user?.name}
                                        </p>
                                        <p className="truncate text-xs text-gray-500">
                                            {auth.user?.email}
                                        </p>
                                    </div>
                                    <div className="py-1">
                                        <Link
                                            href={route('profile.edit')}
                                            className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            onClick={() =>
                                                setIsProfileOpen(false)
                                            }
                                        >
                                            <svg
                                                className="h-4 w-4 text-gray-500"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                                                <circle cx="12" cy="7" r="4" />
                                            </svg>
                                            Profil Saya
                                        </Link>
                                    </div>
                                    <div className="border-t border-gray-100 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsProfileOpen(false);
                                                router.post(route('logout'));
                                            }}
                                            className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                        >
                                            <svg
                                                className="h-4 w-4 text-red-500"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                                <polyline points="16 17 21 12 16 7" />
                                                <line
                                                    x1="21"
                                                    y1="12"
                                                    x2="9"
                                                    y2="12"
                                                />
                                            </svg>
                                            Keluar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 p-6 lg:p-8">
                    {flash.success && (
                        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                            {flash.success}
                        </div>
                    )}
                    {flash.error && (
                        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
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
