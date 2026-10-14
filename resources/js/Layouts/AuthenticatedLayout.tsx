import BrandMark from '@/Components/BrandMark';
import NavIcon from '@/Components/NavIcon';
import { Button } from '@/Components/ui/base/buttons/button';
import { Dropdown } from '@/Components/ui/base/dropdown/dropdown';
import { Tooltip } from '@/Components/ui/base/tooltip/tooltip';
import {
    formatRole,
    getInitials,
    navGroupsForPermissions,
    Role,
} from '@/config/navigation';
import { useBreakpoint } from '@/lib/use-breakpoint';
import { PageProps } from '@/types';
import { Link, router, usePage } from '@inertiajs/react';
import {
    Bell01,
    ChevronDown,
    ChevronLeftDouble,
    ChevronRightDouble,
    LogOut01,
    MarkerPin01,
    Menu01,
    User01,
    XClose,
} from '@untitledui/icons';
import { PropsWithChildren, ReactNode, useEffect, useState } from 'react';
import {
    Button as AriaButton,
    Dialog,
    DialogTrigger,
    Focusable,
    Modal,
    ModalOverlay,
    Popover,
} from 'react-aria-components';

const COLLAPSE_KEY = 'sibima:sidebar-collapsed';

export default function AuthenticatedLayout({
    header,
    children,
}: PropsWithChildren<{ header?: ReactNode }>) {
    const { auth, flash, notifications, pending_approvals } =
        usePage<PageProps>().props;
    const { url } = usePage();
    const role = auth.user?.roles?.[0] as Role | undefined;
    const navGroups = navGroupsForPermissions(auth.user?.permissions ?? []);

    const badgeFor = (item: { href: string; badge?: string | number }) =>
        item.href === '/persetujuan' ? pending_approvals || undefined : item.badge;

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const isDesktop = useBreakpoint('md');
    const [collapsed, setCollapsed] = useState(() => {
        try {
            return localStorage.getItem(COLLAPSE_KEY) === '1';
        } catch {
            return false;
        }
    });

    const toggleCollapsed = () => {
        const next = !collapsed;
        setCollapsed(next);
        try {
            localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
        } catch {
            // penyimpanan dinonaktifkan: pilihan hanya berlaku selama sesi halaman
        }
    };

    // Close mobile menu on route change
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [url]);

    // Close mobile menu when the viewport becomes desktop-sized
    useEffect(() => {
        if (isDesktop) setIsMobileMenuOpen(false);
    }, [isDesktop]);

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
    const unread = notifications.unread_count;

    const renderNavContent = (onClose?: () => void, compact = false) => (
        <>
            {/* Brand Header */}
            <div
                className={`flex h-[88px] shrink-0 items-center border-b border-white/10 ${
                    compact ? 'justify-center px-2' : 'justify-between px-5'
                }`}
            >
                <Link
                    href="/dashboard"
                    aria-label={compact ? 'SIBIMA, ke Dashboard' : undefined}
                    className="flex items-center gap-3 rounded-lg outline-hidden focus-visible:ring-2 focus-visible:ring-white/60"
                >
                    <BrandMark compact={compact} />
                </Link>
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-slate-400 outline-hidden hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60"
                        aria-label="Tutup menu"
                    >
                        <XClose className="size-5" aria-hidden="true" />
                    </button>
                )}
            </div>

            {/* Nav Body */}
            <nav
                className={`no-scrollbar flex-1 select-none space-y-5 overflow-y-auto py-5 ${
                    compact ? 'px-3' : 'px-4'
                }`}
            >
                {navGroups.map((group, groupIndex) => (
                    <div key={group.title} className="space-y-1">
                        {compact ? (
                            groupIndex > 0 && (
                                <div
                                    className="mx-2 border-t border-white/10 pb-1"
                                    aria-hidden="true"
                                />
                            )
                        ) : (
                            <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                {group.title}
                            </div>
                        )}
                        <div className="space-y-1">
                            {group.items.map((item) => {
                                const active = isItemActive(item.href);
                                const badge = badgeFor(item);
                                const pill = badge !== undefined && (
                                    <span
                                        className={`flex items-center justify-center rounded-full bg-red-500 font-bold text-white ${
                                            compact
                                                ? 'absolute right-0.5 top-0.5 h-4 min-w-4 px-1 text-[10px]'
                                                : 'h-5 min-w-5 px-1.5 text-[11px]'
                                        }`}
                                    >
                                        {badge}
                                    </span>
                                );
                                const layout = compact
                                    ? 'relative justify-center'
                                    : 'justify-between px-3';

                                if (item.disabled) {
                                    return (
                                        <div
                                            key={item.label}
                                            className={`flex h-10 w-full cursor-not-allowed items-center rounded-lg text-sm font-medium text-slate-500 opacity-60 transition ${layout}`}
                                            title={compact ? `${item.label} (segera hadir)` : 'Segera hadir'}
                                        >
                                            <div className="flex items-center gap-3 truncate">
                                                <NavIcon
                                                    name={item.icon}
                                                    className="h-[18px] w-[18px] shrink-0 text-slate-500"
                                                />
                                                {!compact && (
                                                    <span className="truncate">
                                                        {item.label}
                                                    </span>
                                                )}
                                            </div>
                                            {pill}
                                        </div>
                                    );
                                }

                                const link = (
                                    <Link
                                        key={item.label}
                                        href={item.href}
                                        aria-current={
                                            active ? 'page' : undefined
                                        }
                                        aria-label={compact ? item.label : undefined}
                                        className={`flex h-10 w-full items-center rounded-lg text-sm font-medium outline-hidden transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/60 ${layout} ${
                                            active
                                                ? 'bg-blue-800 text-white shadow-xs'
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
                                            {!compact && (
                                                <span className="truncate">
                                                    {item.label}
                                                </span>
                                            )}
                                        </div>
                                        {pill}
                                    </Link>
                                );

                                return compact ? (
                                    <Tooltip
                                        key={item.label}
                                        title={item.label}
                                        placement="right"
                                    >
                                        <Focusable>{link}</Focusable>
                                    </Tooltip>
                                ) : (
                                    link
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
            <aside
                className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-[#0F2440] transition-[width] duration-200 ease-in-out md:flex ${
                    collapsed ? 'w-[76px]' : 'w-[260px]'
                }`}
            >
                {renderNavContent(undefined, collapsed)}
            </aside>

            {/* Mobile Drawer */}
            <ModalOverlay
                isOpen={isMobileMenuOpen}
                onOpenChange={setIsMobileMenuOpen}
                isDismissable
                className={({ isEntering, isExiting }) =>
                    `backdrop-blur-xs fixed inset-0 z-40 bg-black/60 md:hidden ${
                        isEntering ? 'duration-200 ease-out animate-in fade-in' : ''
                    } ${isExiting ? 'duration-150 ease-in animate-out fade-out' : ''}`
                }
            >
                <Modal
                    className={({ isEntering, isExiting }) =>
                        `fixed inset-y-0 left-0 z-50 flex h-full w-[260px] flex-col bg-[#0F2440] shadow-2xl outline-hidden ${
                            isEntering ? 'duration-200 ease-out animate-in slide-in-from-left' : ''
                        } ${isExiting ? 'duration-150 ease-in animate-out slide-out-to-left' : ''}`
                    }
                >
                    <Dialog
                        aria-label="Menu navigasi"
                        className="flex h-full flex-col outline-hidden"
                    >
                        {renderNavContent(() => setIsMobileMenuOpen(false))}
                    </Dialog>
                </Modal>
            </ModalOverlay>

            {/* Main Column */}
            <div className="flex min-w-0 flex-1 flex-col">
                {/* App Header (Top Bar) */}
                <header className="sticky top-0 z-30 flex h-[88px] items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-8">
                    {/* Left: Hamburger (Mobile) / Collapse toggle (Desktop) */}
                    <div className="flex items-center gap-3">
                        <Button
                            color="tertiary"
                            size="md"
                            iconLeading={collapsed ? ChevronRightDouble : ChevronLeftDouble}
                            aria-label={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
                            className="hidden md:inline-flex"
                            onPress={toggleCollapsed}
                        />
                        <Button
                            color="tertiary"
                            size="md"
                            iconLeading={Menu01}
                            aria-label="Buka menu navigasi"
                            className="md:hidden"
                            onPress={() => setIsMobileMenuOpen(true)}
                        />
                    </div>

                    {/* Right: Location Badge, Bell Notification, Divider, User Info */}
                    <div className="flex items-center gap-3 sm:gap-5">
                        {/* Location Badge */}
                        <div className="hidden select-none items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/70 px-3 py-1.5 text-xs font-medium text-blue-700 sm:inline-flex">
                            <MarkerPin01
                                className="size-3.5 shrink-0 text-blue-600"
                                aria-hidden="true"
                            />
                            <span className="max-w-[180px] truncate">
                                {unitName}
                            </span>
                        </div>

                        {/* Notification Bell */}
                        <DialogTrigger>
                            <AriaButton
                                aria-label={
                                    unread > 0
                                        ? `Notifikasi, ${unread} belum dibaca`
                                        : 'Notifikasi'
                                }
                                className="relative flex size-11 items-center justify-center rounded-full text-gray-500 outline-hidden transition hover:bg-gray-100 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-blue-600"
                            >
                                <Bell01 className="size-5" aria-hidden="true" />
                                {unread > 0 && (
                                    <span className="shadow-2xs absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                                        {unread}
                                    </span>
                                )}
                            </AriaButton>
                            <Popover
                                placement="bottom end"
                                offset={8}
                                className={({ isEntering, isExiting }) =>
                                    `w-72 rounded-lg border border-gray-100 bg-white p-3 shadow-lg ${
                                        isEntering ? 'duration-150 ease-out animate-in fade-in' : ''
                                    } ${isExiting ? 'duration-100 ease-in animate-out fade-out' : ''}`
                                }
                            >
                                <Dialog
                                    aria-label="Notifikasi"
                                    className="outline-hidden"
                                >
                                    {({ close }) => (
                                        <>
                                            <div className="mb-2 flex items-center justify-between border-b border-gray-100 pb-2">
                                                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900">
                                                    Notifikasi
                                                </h3>
                                                {unread > 0 && (
                                                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">
                                                        {unread} Baru
                                                    </span>
                                                )}
                                            </div>
                                            <div className="space-y-2 text-xs text-gray-600">
                                                {notifications.items.length === 0 ? (
                                                    <p className="p-2 text-center text-gray-400">
                                                        Tidak ada notifikasi baru.
                                                    </p>
                                                ) : (
                                                    notifications.items.map((item) => (
                                                        <button
                                                            key={item.id}
                                                            type="button"
                                                            onClick={() => {
                                                                close();
                                                                router.post(route('notifications.read', item.id));
                                                            }}
                                                            className="block w-full rounded-sm p-2 text-left outline-hidden hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600"
                                                        >
                                                            <p className="font-medium text-gray-800">{item.message}</p>
                                                            <p className="mt-0.5 text-[11px] text-gray-500">{item.created_at}</p>
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </>
                                    )}
                                </Dialog>
                            </Popover>
                        </DialogTrigger>

                        {/* Divider */}
                        <div className="hidden h-6 w-px bg-gray-200 sm:block" />

                        {/* User Profile Dropdown */}
                        <Dropdown.Root>
                            <AriaButton
                                aria-label="Menu pengguna"
                                className="flex items-center gap-3 rounded-lg p-1.5 text-left outline-hidden transition hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600"
                            >
                                {auth.user?.foto_profile_url ? (
                                    <img
                                        src={auth.user.foto_profile_url}
                                        alt={auth.user.name}
                                        className="shadow-2xs h-8 w-8 shrink-0 rounded-full border border-gray-200 object-cover"
                                    />
                                ) : (
                                    <div className="shadow-2xs flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-blue-800 text-xs font-bold text-white">
                                        {userInitials}
                                    </div>
                                )}
                                <div className="hidden flex-col text-left sm:flex">
                                    <span className="max-w-[140px] truncate text-sm font-semibold leading-tight text-gray-900">
                                        {auth.user?.name ?? 'Pengguna'}
                                    </span>
                                    <span className="max-w-[140px] truncate text-xs leading-tight text-gray-500">
                                        {userRole}
                                    </span>
                                </div>
                                <ChevronDown
                                    className="size-4 text-gray-400"
                                    aria-hidden="true"
                                />
                            </AriaButton>
                            <Dropdown.Popover className="w-56">
                                <div className="border-b border-gray-100 px-3 py-2">
                                    <p className="truncate text-sm font-semibold text-gray-900">
                                        {auth.user?.name}
                                    </p>
                                    <p className="truncate text-xs text-gray-500">
                                        {auth.user?.email}
                                    </p>
                                </div>
                                <Dropdown.Menu aria-label="Menu pengguna">
                                    <Dropdown.Item
                                        id="profil"
                                        label="Profil Saya"
                                        icon={User01}
                                        href={route('profile.edit')}
                                    />
                                    <Dropdown.Separator />
                                    <Dropdown.Item
                                        id="keluar"
                                        unstyled
                                        textValue="Keluar"
                                        onAction={() => router.post(route('logout'))}
                                        className="mx-1.5 flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm font-semibold text-red-600 outline-hidden data-[focused]:bg-red-50 data-[focus-visible]:outline-2 data-[focus-visible]:-outline-offset-2 data-[focus-visible]:outline-red-500"
                                    >
                                        <LogOut01 className="size-4 shrink-0 text-red-500" aria-hidden="true" />
                                        Keluar
                                    </Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown.Popover>
                        </Dropdown.Root>
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
