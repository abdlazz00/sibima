export interface AuthUser {
    id: number;
    name: string;
    email: string;
    roles: string[];
    unit: { id: number; name: string; type: 'kecamatan' | 'kelurahan' } | null;
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
        roles?: { id: number; name: string }[];
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
    action: 'approve' | 'reject' | 'cancel';
    note: string | null;
    created_at: string;
    user?: { id: number; name: string };
}

export interface ApprovalStep {
    step_order: number;
    approver_role: string;
    unit_scope?: string;
}

export interface ApprovalRequestSummary {
    id: number;
    current_step: number;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    definition?: { name: string; steps?: ApprovalStep[] };
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
