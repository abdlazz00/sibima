export type Role =
    'kasubag' | 'camat' | 'admin_kecamatan' | 'admin_kelurahan' | 'lurah';

export interface NavItem {
    label: string;
    href: string;
    icon: string;
    badge?: string | number;
    disabled?: boolean;
    roles?: Role[];
    permission?: string;
}

export interface NavGroup {
    title: string;
    items: NavItem[];
}

export const SIDEBAR_NAV_GROUPS: NavGroup[] = [
    {
        title: 'UTAMA',
        items: [
            { label: 'Dashboard', href: '/dashboard', icon: 'grid', permission: 'dashboard.view' },
        ],
    },
    {
        title: 'DATA MASTER',
        items: [
            { label: 'Data Aset', href: '/assets', icon: 'package', permission: 'aset.view' },
            { label: 'Scan QR', href: '/scan', icon: 'qr-code', permission: 'scan.view' },
            { label: 'Kategori Aset', href: '/asset-categories', icon: 'layers', permission: 'kategori.view' },
            { label: 'Data Pegawai', href: '/pegawais', icon: 'users', permission: 'pegawai.view' },
        ],
    },
    {
        title: 'TRANSAKSI',
        items: [
            { label: 'Penerimaan Aset', href: '/penerimaan-aset', icon: 'download', permission: 'penerimaan.view' },
            { label: 'Mutasi Aset', href: '/asset-mutations', icon: 'shuffle', permission: 'mutasi.view' },
            { label: 'Kotak Persetujuan', href: '/persetujuan', icon: 'check-square', permission: 'persetujuan.view' },
            { label: 'Permohonan Aset', href: '/asset-requests', icon: 'file-text', permission: 'permohonan.view' },
            { label: 'Lapor Rusak/Hilang', href: '/asset-reports', icon: 'alert-triangle', permission: 'laporan-insiden.view' },
        ],
    },
    {
        title: 'LAPORAN',
        items: [
            { label: 'Laporan Aset', href: '/laporan-aset', icon: 'bar-chart', permission: 'laporan.aset' },
            { label: 'Laporan Mutasi', href: '/laporan-mutasi', icon: 'shuffle', permission: 'laporan.mutasi' },
            { label: 'Laporan Rusak & Hilang', href: '/laporan-rusak-hilang', icon: 'alert-triangle', permission: 'laporan.rusak-hilang' },
        ],
    },
    {
        title: 'PENGATURAN',
        items: [
            { label: 'Pengaturan Pengguna', href: '/pengaturan/users', icon: 'users', permission: 'user.view' },
            { label: 'Pengaturan Alur', href: '/pengaturan/alur', icon: 'settings', permission: 'pengaturan.alur' },
            { label: 'Pengaturan Role', href: '/pengaturan/roles', icon: 'shield', permission: 'pengaturan.role' },
        ],
    },
];

export function navGroupsForPermissions(permissions: string[] = []): NavGroup[] {
    return SIDEBAR_NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter(
            (item) => !item.permission || permissions.includes(item.permission),
        ),
    })).filter((group) => group.items.length > 0);
}

export function navGroupsForRole(role?: Role): NavGroup[] {
    return SIDEBAR_NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter(
            (item) => !item.roles || (role !== undefined && item.roles.includes(role)),
        ),
    })).filter((group) => group.items.length > 0);
}

export function navItemsForRole(role: Role | undefined): NavItem[] {
    return navGroupsForRole(role).flatMap((group) => group.items);
}

export const NAV_ITEMS_BY_ROLE: Record<Role, NavItem[]> = {
    kasubag: navItemsForRole('kasubag'),
    camat: navItemsForRole('camat'),
    admin_kecamatan: navItemsForRole('admin_kecamatan'),
    admin_kelurahan: navItemsForRole('admin_kelurahan'),
    lurah: navItemsForRole('lurah'),
};

export function formatRole(role?: string): string {
    switch (role) {
        case 'kasubag':
            return 'Kasubag';
        case 'camat':
            return 'Camat Sagulung';
        case 'admin_kecamatan':
            return 'Admin Kecamatan';
        case 'admin_kelurahan':
            return 'Admin Kelurahan';
        case 'lurah':
            return 'Lurah';
        default:
            return role
                ? role
                      .replace(/_/g, ' ')
                      .replace(/\b\w/g, (c) => c.toUpperCase())
                : 'Pengguna';
    }
}

export function getInitials(name?: string): string {
    if (!name) return 'SB';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
}
