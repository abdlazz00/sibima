const PERMISSION_LABELS: Record<string, string> = {
    'dashboard.view': 'Lihat Dashboard',
    'aset.view': 'Lihat Data Aset',
    'aset.create': 'Tambah Aset Baru',
    'aset.update': 'Ubah / Edit Aset',
    'aset.print-label': 'Cetak Label & Barcode QR',
    'import-aset': 'Import Data Aset Excel',
    'export-aset': 'Export Data Aset Excel',
    'scan.view': 'Akses Fitur Scan QR',
    'kategori.view': 'Lihat Kategori Aset',
    'kategori.create': 'Tambah Kategori',
    'kategori.update': 'Ubah Kategori',
    'kategori.delete': 'Hapus Kategori',
    'import-kategori': 'Import Kategori Excel',
    'export-kategori': 'Export Kategori Excel',
    'pegawai.view': 'Lihat Data Pegawai',
    'pegawai.create': 'Tambah Pegawai',
    'pegawai.update': 'Ubah Pegawai',
    'pegawai.delete': 'Hapus Pegawai',
    'pegawai.create-user': 'Buat Akun Pengguna',
    'import-pegawai': 'Import Pegawai Excel',
    'export-pegawai': 'Export Pegawai Excel',
    'penerimaan.view': 'Lihat Dokumen Penerimaan',
    'penerimaan.create': 'Buat Dokumen Penerimaan',
    'penerimaan.update': 'Ubah Dokumen Penerimaan',
    'penerimaan.delete': 'Hapus Dokumen Penerimaan',
    'mutasi.view': 'Lihat Riwayat & Daftar Mutasi',
    'mutasi.create': 'Ajukan Mutasi Aset',
    'permohonan.view': 'Lihat Permohonan Aset',
    'permohonan.create': 'Ajukan Permohonan Aset',
    'permohonan.fulfill': 'Penuhi Permohonan Aset',
    'permohonan.close': 'Tutup / Selesaikan Permohonan',
    'laporan-insiden.view': 'Lihat Laporan Kerusakan / Kehilangan',
    'laporan-insiden.create': 'Buat Laporan Kerusakan / Kehilangan',
    'persetujuan.view': 'Lihat Kotak Persetujuan',
    'persetujuan.act': 'Setujui / Tolak Dokumen Persetujuan',
    'persetujuan.reassign': 'Alihkan Approver Persetujuan',
    'laporan.aset': 'Laporan Rekapitulasi Aset',
    'laporan.mutasi': 'Laporan Rekapitulasi Mutasi',
    'laporan.rusak-hilang': 'Laporan Rekap Rusak & Hilang',
    'pengaturan.alur': 'Pengaturan Alur Persetujuan',
    'pengaturan.role': 'Pengaturan Role & Hak Akses',
    'user.view': 'Lihat Daftar Pengguna',
    'user.manage-access': 'Kelola Role & Akses Pengguna',
    'user.reset-password': 'Atur Ulang Kata Sandi Pengguna',
    'user.toggle-status': 'Aktifkan / Nonaktifkan Pengguna',
    'user.delete': 'Hapus Pengguna',
};

export function formatPermissionLabel(perm: string): string {
    return PERMISSION_LABELS[perm] ?? perm.replace(/[-.]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Menyaring grup izin berdasarkan nama grup, kode izin, atau label Indonesia. */
export function filterPermissionGroups(groups: Record<string, string[]>, query: string): Record<string, string[]> {
    const q = query.trim().toLowerCase();
    if (!q) return groups;

    const result: Record<string, string[]> = {};

    Object.entries(groups).forEach(([groupName, perms]) => {
        if (groupName.toLowerCase().includes(q)) {
            result[groupName] = perms;
            return;
        }

        const matching = perms.filter((p) => p.toLowerCase().includes(q) || formatPermissionLabel(p).toLowerCase().includes(q));
        if (matching.length > 0) result[groupName] = matching;
    });

    return result;
}
