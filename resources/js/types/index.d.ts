export interface AuthUser {
    id: number;
    name: string;
    email: string;
    is_active?: boolean;
    foto_profile_url?: string | null;
    roles: string[];
    permissions: string[];
    unit: { id: number; name: string; type: 'kecamatan' | 'kelurahan' } | null;
}

export interface RoleItem {
    id: number;
    name: string;
    display_name: string;
    unit_scope: 'all' | 'binaan' | 'own';
    is_system: boolean;
    description: string | null;
    users_count: number;
    permissions_count: number;
    permissions: string[];
}

export interface AssetCategory {
    id: number;
    name: string;
    parent_id: number | null;
    code?: string | null;
    description?: string | null;
    formatted_code?: string;
    assets_count?: number;
    children?: AssetCategory[];
    parent?: AssetCategory | null;
}

export interface PegawaiAsset {
    id: number;
    nama_aset: string;
    kode_barang: string;
    kondisi: 'baik' | 'rusak_ringan' | 'rusak_berat';
    nilai_perolehan: number | string;
    category?: { id: number; name: string };
}

export interface Pegawai {
    id: number;
    nama: string;
    nip: string | null;
    pangkat_golongan: string | null;
    jabatan: string;
    status_kepegawaian: 'pns' | 'pppk';
    unit_id: number;
    foto_profile: string | null;
    no_hp?: string | null;
    email_dinas?: string | null;
    user_id: number | null;
    unit?: { id: number; name: string; type: 'kecamatan' | 'kelurahan' };
    user?: {
        id: number;
        email: string;
        roles?: { id: number; name: string; display_name?: string }[];
        permissions?: { id: number; name: string }[];
        unit_scope_override?: 'all' | 'binaan' | 'own' | null;
    } | null;
    assets?: PegawaiAsset[];
    assets_count?: number;
}

export interface AssetPhoto {
    id: number;
    path: string;
    url: string;
}

export interface AssetHistory {
    id: number;
    event: string;
    kondisi: 'baik' | 'rusak_ringan' | 'rusak_berat' | 'hilang';
    keterangan: string | null;
    created_at: string;
    unit?: { id: number; name: string; type: 'kecamatan' | 'kelurahan' };
    user?: { id: number; name: string } | null;
}

export interface Asset {
    id: number;
    kode_barang: string;
    nomor_register: number;
    nama_aset: string;
    category_id: number;
    unit_id: number;
    current_holder_id: number | null;
    merk_type: string | null;
    kondisi: 'baik' | 'rusak_ringan' | 'rusak_berat' | 'hilang';
    status: 'aktif' | 'dalam_proses';
    tanggal_perolehan: string;
    sumber_perolehan: string | null;
    nilai_perolehan: string;
    nilai_buku: string;
    no_dokumen: string | null;
    keterangan: string | null;
    category?: AssetCategory;
    unit?: { id: number; name: string; type: 'kecamatan' | 'kelurahan' };
    current_holder?: { id: number; nama: string; jabatan: string } | null;
    photos?: AssetPhoto[];
    histories?: AssetHistory[];
}

export interface Paginated<T> {
    data: T[];
    current_page: number;
    last_page: number;
    from: number | null;
    to: number | null;
    total: number;
    per_page: number;
}

export interface BeritaAcaraItem {
    id: number;
    nama_aset: string;
    merk_type: string | null;
    category_id: number;
    jumlah_unit: number;
    nilai_per_unit: string;
    kondisi_awal: 'baik' | 'rusak_ringan' | 'rusak_berat' | 'hilang';
    category?: { id: number; name: string };
}

export interface ApprovalActionEntry {
    id: number;
    step_order: number;
    action: 'approve' | 'reject' | 'cancel' | 'reassign';
    note: string | null;
    created_at: string;
    user?: { id: number; name: string };
}

export interface ApprovalStep {
    step_order: number;
    label: string;
    approver_type: 'role' | 'user' | 'atasan_unit';
    approver_role: string | null;
    approver_user_id?: number | null;
    unit_scope?: string;
}

export interface ReassignCandidate {
    id: number;
    name: string;
    role: string | null;
    unit: string | null;
}

export interface ApprovalRequestSummary {
    id: number;
    current_step: number;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    definition?: { name: string };
    steps?: ApprovalStep[];
    actions?: ApprovalActionEntry[];
}

export interface BeritaAcaraPenerimaan {
    id: number;
    no_berita_acara: string;
    tanggal_penerimaan: string;
    sumber_perolehan: string | null;
    no_kontrak_spk: string;
    vendor: string | null;
    catatan: string | null;
    status: 'draft' | 'submitted';
    unit?: { id: number; name: string };
    creator?: { id: number; name: string };
    items?: BeritaAcaraItem[];
    photos?: { id: number; path: string }[];
    approval_request?: ApprovalRequestSummary | null;
}

export type MutationType = 'kec_ke_kel' | 'antar_kel' | 'retur_kel_ke_kec' | 'internal';
export type MutationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface AssetMutationItem {
    id: number;
    asset_mutation_id: number;
    asset_id: number;
    target_holder_id: number | null;
    catatan: string | null;
    asset?: Asset;
    target_holder?: Pegawai | null;
}

export interface AssetMutation {
    id: number;
    nomor_mutasi: string;
    jenis_mutasi: MutationType;
    origin_unit_id: number;
    destination_unit_id: number;
    tanggal_mutasi: string;
    keterangan: string | null;
    status: MutationStatus;
    created_by: number;
    origin_unit?: { id: number; name: string; type: 'kecamatan' | 'kelurahan' };
    destination_unit?: { id: number; name: string; type: 'kecamatan' | 'kelurahan' };
    creator?: { id: number; name: string };
    items?: AssetMutationItem[];
    approval_request?: ApprovalRequestSummary | null;
    photos?: AssetPhoto[];
}

export interface NotificationItem {
    id: string;
    message: string;
    created_at: string;
}

export interface Flash {
    success: string | null;
    error: string | null;
}

export type PageProps<
    T extends Record<string, unknown> = Record<string, unknown>,
> = T & {
    auth: {
        user: AuthUser | null;
    };
    flash: Flash;
    pending_approvals: number;
    notifications: {
        unread_count: number;
        items: NotificationItem[];
    };
};

export type AssetReportStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type AssetReportType = 'rusak' | 'hilang';

export interface AssetReport {
    id: number;
    nomor_laporan: string;
    asset_id: number;
    unit_id: number;
    pegawai_id: number | null;
    jenis: AssetReportType;
    kondisi_baru: 'baik' | 'rusak_ringan' | 'rusak_berat' | 'hilang';
    tanggal_kejadian: string;
    kronologi: string;
    status: AssetReportStatus;
    asset?: Asset;
    unit?: { id: number; name: string; type: 'kecamatan' | 'kelurahan' };
    pegawai?: Pegawai | null;
    creator?: { id: number; name: string };
    photos?: AssetPhoto[];
    approval_request?: ApprovalRequestSummary | null;
}

export type AssetRequestStatus = 'pending' | 'approved' | 'fulfilled' | 'rejected' | 'cancelled';
export type AssetRequestType = 'pegawai' | 'unit';

export interface AssetRequest {
    id: number;
    nomor_permohonan: string;
    jenis: AssetRequestType;
    pegawai_id: number | null;
    unit_id: number;
    category_id: number;
    jumlah: number;
    keterangan: string;
    status: AssetRequestStatus;
    mutation_id: number | null;
    fulfilled_at: string | null;
    catatan_penutupan: string | null;
    created_at: string;
    pegawai?: Pegawai | null;
    unit?: { id: number; name: string; type: 'kecamatan' | 'kelurahan' };
    category?: { id: number; name: string };
    creator?: { id: number; name: string };
    fulfiller?: { id: number; name: string } | null;
    mutation?: { id: number; nomor_mutasi: string; status: string } | null;
    assets?: Asset[];
    approval_request?: ApprovalRequestSummary | null;
}

export interface AssetScanSummary {
    id: number;
    nama_aset: string;
    kode_barang: string;
    nomor_register: string;
    merk_type: string | null;
    kategori: string | null;
    unit: string | null;
    kondisi: 'baik' | 'rusak_ringan' | 'rusak_berat' | 'hilang';
    status: 'aktif' | 'dalam_proses';
    pemegang: string | null;
    foto: string | null;
}

export interface TrenAktivitasItem {
    bulan: string;
    penerimaan: number;
    mutasi: number;
    rusak_hilang: number;
    permohonan: number;
}

export interface DashboardTransaksiItem {
    jenis: 'mutasi' | 'penerimaan' | 'rusak_hilang' | 'permohonan';
    nomor: string;
    ringkasan: string | null;
    tanggal: string | null;
    status: 'berjalan' | 'selesai' | 'ditolak' | 'dibatalkan';
    url: string;
}

export interface DashboardData {
    totals: { jumlah_aset: number; nilai_perolehan: number; nilai_buku: number };
    per_kondisi: Record<'baik' | 'rusak_ringan' | 'rusak_berat' | 'hilang', number>;
    per_kategori: { id: number; nama: string; jumlah: number; nilai_buku: number }[];
    per_unit: { id: number; name: string; jumlah: number; kondisi: Record<string, number>; nilai_buku: number }[] | null;
    tren_aktivitas: TrenAktivitasItem[];
    antrean: {
        persetujuan_menunggu: number;
        permohonan_menunggu_pemenuhan: number;
        laporan_pending: number;
        mutasi_pending: number;
    };
    transaksi: DashboardTransaksiItem[];
    units: { id: number; name: string }[];
    selected_unit_id: number | null;
}

export interface RekapTotals {
    jumlah: number;
    nilai_perolehan: number;
    nilai_buku: number;
}

export interface LaporanAsetRow {
    id: number;
    kode_barang: string;
    nomor_register: string;
    nama_aset: string;
    merk_type: string | null;
    kategori: string | null;
    subkategori: string | null;
    unit: string | null;
    tahun_perolehan: string | null;
    kondisi: 'baik' | 'rusak_ringan' | 'rusak_berat' | 'hilang';
    nilai_perolehan: number;
    nilai_buku: number;
    detail: {
        pemegang: string | null;
        status: 'aktif' | 'dalam_proses';
        sumber_perolehan: string | null;
        no_dokumen: string | null;
        keterangan: string | null;
    };
}

export interface LaporanAsetData {
    filters: Record<string, string | number>;
    sort: { urut: string; arah: 'asc' | 'desc' };
    ringkasan: RekapTotals;
    kondisi: { kondisi: 'baik' | 'rusak_ringan' | 'rusak_berat' | 'hilang'; label: string; jumlah: number; persen: number }[];
    tren: { tahun: number; jumlah: number; nilai_perolehan: number; nilai_buku: number }[];
    rekap_kategori: {
        grup: (RekapTotals & { id: number; nama: string; anak: (RekapTotals & { id: number; nama: string })[] })[];
        total: RekapTotals;
    };
    rekap_unit: { baris: (RekapTotals & { id: number; nama: string })[]; total: RekapTotals } | null;
    asets: Paginated<LaporanAsetRow>;
    units: { id: number; name: string; type: string }[];
    categories: { id: number; name: string }[];
    kondisiOptions: { value: string; label: string }[];
}

export interface LaporanMutasiRow {
    id: number;
    nomor_mutasi: string;
    tanggal_mutasi: string;
    jenis: MutationType;
    jenis_label: string;
    asal: string | null;
    tujuan: string | null;
    jumlah_aset: number;
    nilai: number;
    status: MutationStatus;
    pengaju: string | null;
    detail: {
        keterangan: string | null;
        aset: {
            kode_barang: string | null;
            nama_aset: string | null;
            kategori: string | null;
            kondisi: 'baik' | 'rusak_ringan' | 'rusak_berat' | 'hilang' | null;
            nilai_perolehan: number;
            pemegang_tujuan: string | null;
            catatan: string | null;
        }[];
        persetujuan: {
            langkah: string | null;
            aksi: 'approve' | 'reject' | 'cancel' | 'reassign';
            oleh: string | null;
            waktu: string | null;
            catatan: string | null;
        }[];
    };
}

export interface LaporanMutasiData {
    filters: Record<string, string | number>;
    sort: { urut: string; arah: 'asc' | 'desc' };
    ringkasan: {
        jumlah_mutasi: number;
        disetujui: number;
        aset_berpindah: number;
        nilai_perolehan: number;
        rata_lama_proses: number | null;
        terlama_proses: number | null;
    };
    status: { status: MutationStatus; label: string; jumlah: number; persen: number }[];
    jenis: { jenis: MutationType; label: string; jumlah: number; persen: number }[];
    tren: { bulan: string; jumlah_mutasi: number; aset_berpindah: number }[];
    arus: {
        baris: { asal_id: number; asal: string; tujuan_id: number; tujuan: string; jumlah_mutasi: number; aset: number; nilai: number }[];
        total: { jumlah_mutasi: number; aset: number; nilai: number };
    };
    masih_berjalan: {
        id: number;
        nomor: string;
        jenis: string;
        asal: string | null;
        tujuan: string | null;
        langkah: string | null;
        menunggu: string | null;
        umur_hari: number;
        url: string;
    }[];
    jumlah_masih_berjalan: number;
    mutasis: Paginated<LaporanMutasiRow>;
    unitOptions: { id: number; name: string; type: string }[];
    jenisOptions: { value: string; label: string }[];
    statusOptions: { value: string; label: string }[];
}

export interface LaporanRusakHilangRow {
    id: number;
    nomor_laporan: string;
    tanggal_kejadian: string | null;
    nama_aset: string | null;
    kode_barang: string | null;
    merk_type: string | null;
    kategori: string | null;
    unit: string | null;
    pemegang: string | null;
    jenis: AssetReportType | null;
    jenis_label: string | null;
    kondisi_baru: 'rusak_ringan' | 'rusak_berat' | 'hilang' | null;
    kondisi_label: string | null;
    nilai_perolehan: number;
    nilai_buku: number;
    status: AssetReportStatus | null;
    status_label: string | null;
    pengaju: string | null;
    detail: {
        kronologi: string | null;
        photos: { id: number; url: string }[];
        alur_persetujuan: {
            step_order: number;
            label: string;
            role: string | null;
            tipe: string | null;
        }[];
        riwayat_persetujuan: {
            id: number;
            langkah?: string | null;
            step_order: number;
            user: string | null;
            action: string;
            action_label: string;
            note: string | null;
            created_at: string | null;
        }[];
    };
}

export interface LaporanRusakHilangData {
    filters: Record<string, string | number>;
    sort: { urut: string; arah: 'asc' | 'desc' };
    ringkasan: {
        jumlah_laporan: number;
        disetujui: number;
        nilai_perolehan: number;
        nilai_buku: number;
        rata_lama_proses: number | null;
        terlama_proses: number | null;
    };
    status: { status: AssetReportStatus; label: string; jumlah: number; persen: number }[];
    kondisi: { kondisi: 'rusak_ringan' | 'rusak_berat' | 'hilang'; label: string; jumlah: number; persen: number }[];
    tren: { bulan: string; jumlah: number; nilai_perolehan: number }[];
    sebaran_unit: {
        baris: {
            id: number;
            name: string;
            jumlah_rusak: number;
            jumlah_hilang: number;
            total: number;
            nilai_buku: number;
        }[];
        total: {
            jumlah_rusak: number;
            jumlah_hilang: number;
            total: number;
            nilai_buku: number;
        };
    } | null;
    masih_berjalan: {
        id: number;
        nomor: string;
        kondisi_label: string;
        nama_aset: string | null;
        unit: string | null;
        pemegang: string | null;
        langkah: string | null;
        menunggu: string | null;
        umur_hari: number;
        url: string;
    }[];
    jumlah_masih_berjalan: number;
    reports: Paginated<LaporanRusakHilangRow>;
    unitOptions: { id: number; name: string; type: string }[];
    categoryOptions: { id: number; name: string }[];
    kondisiOptions: { value: string; label: string }[];
    statusOptions: { value: string; label: string }[];
}

