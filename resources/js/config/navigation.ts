export type Role =
    | 'kasubag'
    | 'camat'
    | 'admin_kecamatan'
    | 'admin_kelurahan'
    | 'lurah'
    | 'pegawai';

export interface NavItem {
    label: string;
    href: string;
    disabled?: boolean;
}

const DASHBOARD: NavItem = { label: 'Dashboard', href: '/dashboard' };

export const NAV_ITEMS_BY_ROLE: Record<Role, NavItem[]> = {
    kasubag: [
        DASHBOARD,
        { label: 'Kelola User', href: '#', disabled: true },
        { label: 'Master Data Aset', href: '#', disabled: true },
    ],
    camat: [
        DASHBOARD,
        { label: 'Approval Penerimaan Aset', href: '#', disabled: true },
        { label: 'Approval Mutasi Aset', href: '#', disabled: true },
    ],
    admin_kecamatan: [
        DASHBOARD,
        { label: 'Data Aset', href: '#', disabled: true },
        { label: 'Penerimaan Aset', href: '#', disabled: true },
        { label: 'Mutasi Aset', href: '#', disabled: true },
    ],
    admin_kelurahan: [
        DASHBOARD,
        { label: 'Data Aset', href: '#', disabled: true },
        { label: 'Mutasi Aset', href: '#', disabled: true },
    ],
    lurah: [
        DASHBOARD,
        { label: 'Approval Mutasi Aset', href: '#', disabled: true },
    ],
    pegawai: [
        DASHBOARD,
        { label: 'Ajukan Aset', href: '#', disabled: true },
        { label: 'Lapor Aset Rusak/Hilang', href: '#', disabled: true },
    ],
};

export function navItemsForRole(role: Role | undefined): NavItem[] {
    if (!role || !(role in NAV_ITEMS_BY_ROLE)) {
        return [DASHBOARD];
    }

    return NAV_ITEMS_BY_ROLE[role];
}
