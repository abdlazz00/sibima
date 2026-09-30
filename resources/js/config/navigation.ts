export type Role =
    'kasubag' | 'camat' | 'admin_kecamatan' | 'admin_kelurahan' | 'lurah';

export interface NavItem {
    label: string;
    href: string;
    icon: string;
    badge?: string | number;
    disabled?: boolean;
    roles?: Role[];
}

export interface NavGroup {
    title: string;
    items: NavItem[];
}

export const SIDEBAR_NAV_GROUPS: NavGroup[] = [
    {
        title: 'UTAMA',
        items: [{ label: 'Dashboard', href: '/dashboard', icon: 'grid' }],
    },
    {
        title: 'DATA MASTER',
        items: [
            { label: 'Data Aset', href: '/assets', icon: 'package' },
            {
                label: 'Kategori Aset',
                href: '/asset-categories',
                icon: 'layers',
                roles: ['kasubag'],
            },
            { label: 'Data Pegawai', href: '/pegawais', icon: 'users' },
        ],
    },
    {
        title: 'TRANSAKSI',
        items: [
            {
                label: 'Penerimaan Aset',
                href: '/penerimaan-aset',
                icon: 'download',
                roles: ['kasubag', 'camat', 'admin_kecamatan'],
            },
            {
                label: 'Mutasi Aset',
                href: '/asset-mutations',
                icon: 'shuffle',
            },
            {
                label: 'Kotak Persetujuan',
                href: '/persetujuan',
                icon: 'check-square',
            },
            {
                label: 'Permohonan Aset',
                href: '/asset-requests',
                icon: 'file-text',
            },
            {
                label: 'Lapor Rusak/Hilang',
                href: '/asset-reports',
                icon: 'alert-triangle',
            },
        ],
    },
    {
        title: 'PENGATURAN',
        items: [
            {
                label: 'Pengaturan Alur',
                href: '/pengaturan/alur',
                icon: 'settings',
                roles: ['kasubag'],
            },
        ],
    },
    {
        title: 'ALAT BANTU',
        items: [
            {
                label: 'Pindai QR Code',
                href: '#',
                icon: 'aperture',
                disabled: true,
            },
            {
                label: 'Laporan & Ekspor',
                href: '#',
                icon: 'printer',
                disabled: true,
            },
        ],
    },
];

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
