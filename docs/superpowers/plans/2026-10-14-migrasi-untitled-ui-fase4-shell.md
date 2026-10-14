# Migrasi Untitled UI, Fase 4 Kelompok 1: Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengganti mekanik shell (`AuthenticatedLayout`) dengan komponen Untitled UI/React Aria tanpa mengubah tampilan: menu profil, panel notifikasi, drawer mobile, tombol, dan ikon.

**Architecture:** Tampilan identik (sidebar navy `#0F2440`, item aktif `blue-800`, header putih 88px). `NavIcon.tsx` menjadi peta nama → ikon `@untitledui/icons`. Menu profil memakai `Dropdown` hasil CLI, panel notifikasi memakai `DialogTrigger` + `Popover` React Aria, drawer mobile memakai `ModalOverlay` + `Modal` React Aria.

**Tech Stack:** React 19, Inertia 2, Tailwind 4, Untitled UI (React Aria Components), `@untitledui/icons`.

**Spec:** `docs/superpowers/specs/2026-10-14-migrasi-untitled-ui-design.md` §3.5 butir 1. Plan Fase 0–3: `docs/superpowers/plans/2026-10-14-migrasi-untitled-ui.md`.

## Global Constraints

- Tampilan tidak berubah: sidebar `bg-[#0F2440]` lebar 260px, item aktif `bg-blue-800`, header `h-[88px]` putih, badge merah, lencana lokasi biru. Keputusan pengguna 2026-10-14 ("pertahankan tampilan, ganti mekanik").
- Tidak mengubah `config/navigation.ts`, `BrandMark`, flash success/error, hitung badge Persetujuan, atau props Inertia (`auth`, `flash`, `notifications`, `pending_approvals`).
- Impor memakai `@/Components/...` berhuruf besar. Tanpa dependensi baru.
- Aksi tombol memakai `aria-label` Indonesia yang sudah ada ("Buka menu navigasi", "Tutup menu", "Notifikasi").
- Verifikasi: `npx tsc --noEmit` dan `npm run build`. Agen tidak menguji lewat browser kecuali pengguna mengizinkan; cek visual oleh pengguna di gerbang.
- Git: commit per task langsung di `main`, tanpa trailer Co-Authored-By, stage dengan path eksplisit, tanpa push.

## Review Focus

1. **Drawer mobile terbuka lalu layar dilebarkan ke desktop**: overlay `md:hidden` tersembunyi tetapi kunci gulir dan fokus React Aria bisa tertinggal. Pagar: `useBreakpoint('md')` menutup drawer saat desktop (Task 2).
2. **Klik item notifikasi**: panel harus menutup, tidak menggantung menutupi halaman. Pagar: `close()` dari render prop `Dialog` (Task 2).
3. **`href` pada item menu (Profil Saya)** harus memakai navigasi Inertia (tanpa reload). Pagar: `RouterProvider` dari Fase 2; butir gerbang.
4. **Keluar (logout)** tidak boleh berupa tautan GET. Pagar: `onAction` memanggil `router.post(route('logout'))`.
5. **Fokus keyboard terlihat** pada item sidebar (latar navy) dan tombol header. Pagar: `focus-visible:ring` di Task 2; butir gerbang.
6. **Ikon yang tidak ada di peta** (nama baru di `navigation.ts`) tidak boleh membuat halaman crash. Pagar: `NavIcon` mengembalikan `null` untuk nama tak dikenal (Task 1).
7. **Area sentuh kecil di ponsel** (panduan: kontrol minimal 44px). Pagar: lonceng `size-11` (Task 2); hamburger memakai `Button size="md"`.
8. **Foto profil rusak/kosong**: tetap jatuh ke inisial. Pagar: logika `foto_profile_url` dipertahankan (Task 2).

---

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `resources/js/Components/NavIcon.tsx` | Peta nama ikon sidebar → komponen `@untitledui/icons` |
| `resources/js/Layouts/AuthenticatedLayout.tsx` | Shell: sidebar, drawer mobile, header, menu profil, panel notifikasi |

---

### Task 1: `NavIcon` memakai `@untitledui/icons`

**Files:**
- Modify: `resources/js/Components/NavIcon.tsx` (ganti seluruh isi)

**Interfaces:**
- Consumes: `@untitledui/icons`.
- Produces: `NavIcon({ name: string; className?: string })` dengan props yang sama seperti sebelumnya; nama dikenal: `grid`, `package`, `qr-code`, `layers`, `users`, `download`, `shuffle`, `check-square`, `file-text`, `alert-triangle`, `bar-chart`, `settings`, `shield`. Nama lain → `null`.

- [ ] **Step 1: Tulis ulang `NavIcon.tsx`**

```tsx
import {
    AlertTriangle,
    BarChart01,
    CheckSquare,
    Download01,
    File05,
    Grid01,
    LayersThree01,
    Package,
    QrCode01,
    Settings01,
    Shield01,
    Shuffle01,
    Users01,
} from '@untitledui/icons';
import { FC } from 'react';

const ICONS: Record<string, FC<{ className?: string }>> = {
    grid: Grid01,
    package: Package,
    'qr-code': QrCode01,
    layers: LayersThree01,
    users: Users01,
    download: Download01,
    shuffle: Shuffle01,
    'check-square': CheckSquare,
    'file-text': File05,
    'alert-triangle': AlertTriangle,
    'bar-chart': BarChart01,
    settings: Settings01,
    shield: Shield01,
};

interface NavIconProps {
    name: string;
    className?: string;
}

export default function NavIcon({
    name,
    className = 'h-[18px] w-[18px]',
}: NavIconProps) {
    const Icon = ICONS[name];

    return Icon ? <Icon className={className} aria-hidden="true" /> : null;
}
```

- [ ] **Step 2: Verifikasi nama `icon` di config semuanya terpetakan**

```bash
npx tsc --noEmit
grep -oE "icon: '[a-z-]+'" resources/js/config/navigation.ts | sort -u
```
Expected: `tsc` bersih; setiap nama pada daftar ada di `ICONS` (13 nama di atas).

- [ ] **Step 3: Commit**

```bash
git add resources/js/Components/NavIcon.tsx
git commit -m "refactor(ui): map sidebar icons to Untitled UI icons"
```

---

### Task 2: Shell dengan komponen React Aria

**Files:**
- Modify: `resources/js/Layouts/AuthenticatedLayout.tsx` (ganti seluruh isi)

**Interfaces:**
- Consumes: `NavIcon` (Task 1), `Dropdown` dari `@/Components/ui/base/dropdown/dropdown` (`Dropdown.Root`, `.Popover`, `.Menu`, `.Item`, `.Separator`), `Button` dari `@/Components/ui/base/buttons/button`, `useBreakpoint` dari `@/lib/use-breakpoint`, `RouterProvider` (Fase 2).
- Produces: `AuthenticatedLayout({ header?, children })` dengan props sama seperti sebelumnya (semua halaman tak berubah).

- [ ] **Step 1: Tulis ulang `AuthenticatedLayout.tsx`**

Ganti seluruh isi dengan:
```tsx
import BrandMark from '@/Components/BrandMark';
import NavIcon from '@/Components/NavIcon';
import { Button } from '@/Components/ui/base/buttons/button';
import { Dropdown } from '@/Components/ui/base/dropdown/dropdown';
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
    Modal,
    ModalOverlay,
    Popover,
} from 'react-aria-components';

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

    const renderNavContent = (onClose?: () => void) => (
        <>
            {/* Brand Header */}
            <div className="flex h-[88px] shrink-0 items-center justify-between border-b border-white/10 px-5">
                <Link href="/dashboard" className="flex items-center gap-3">
                    <BrandMark />
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
            <nav className="no-scrollbar flex-1 select-none space-y-5 overflow-y-auto px-4 py-5">
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
                                        className={`flex h-10 w-full items-center justify-between rounded-lg px-3 text-sm font-medium outline-hidden transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/60 ${
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
                    {/* Left: Hamburger (Mobile) */}
                    <div className="flex items-center gap-3">
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
```

- [ ] **Step 2: Verifikasi**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
grep -rn "@/components/" resources/js | head
```
Expected: bersih. Perbaiki error tipe seperlunya dan catat sebagai `Ruling` bila prop berbeda dari yang diasumsikan (mis. `className` fungsi pada `Dropdown.Item unstyled`, `Dialog` render prop).

- [ ] **Step 3: Test asap backend**

```bash
php artisan test --compact --filter='DashboardController|DashboardInertiaProps|NotificationSharedProp|PersetujuanController|AssetBrowse'
```
Expected: hijau (kontrak props bersama tidak berubah).

- [ ] **Step 4: Commit**

```bash
git add resources/js/Layouts/AuthenticatedLayout.tsx
git commit -m "refactor(ui): rebuild the shell mechanics with React Aria and Untitled UI components"
```

- [ ] **Step 5: GERBANG SHELL — berhenti**

Laporkan hasil Task 1–2 dan minta pengguna memeriksa di browser (shell tampil di semua halaman; periksa lewat Data Aset):
- Sidebar tampil sama seperti sebelumnya: warna, lebar, item aktif, badge Persetujuan, ikon per menu, untuk beberapa peran (super-admin, admin kelurahan, kasubag).
- Menu profil: terbuka/menutup, Esc, panah atas/bawah, Enter; Profil Saya membuka halaman tanpa reload penuh; Keluar logout.
- Panel notifikasi: terbuka, daftar atau "Tidak ada notifikasi baru", klik item menandai dibaca dan panel menutup, Esc menutup.
- 375 px: tombol hamburger membuka drawer dari kiri, Esc/klik di luar/tombol tutup menutup, pindah halaman menutup, fokus terkunci di dalam drawer; ubah lebar ke desktop saat drawer terbuka menutupnya.
- Tab melalui sidebar dan header: cincin fokus terlihat.
**Jangan memulai kelompok berikutnya** (Master data) sebelum pengguna menyatakan lolos.
