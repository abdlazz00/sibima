import { AssetReportStatus, AssetReportType } from '@/types';

export const REPORT_STATUS_LABEL: Record<AssetReportStatus, string> = {
    pending: 'Menunggu Persetujuan',
    approved: 'Disetujui',
    rejected: 'Ditolak',
    cancelled: 'Dibatalkan',
};

export const REPORT_STATUS_COLOR: Record<AssetReportStatus, 'warning' | 'success' | 'error' | 'gray'> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'error',
    cancelled: 'gray',
};

export const REPORT_TYPE_LABEL: Record<AssetReportType, string> = { rusak: 'Rusak', hilang: 'Hilang' };

export const KONDISI_LABEL: Record<string, string> = {
    baik: 'Baik',
    rusak_ringan: 'Rusak Ringan',
    rusak_berat: 'Rusak Berat',
    hilang: 'Hilang',
};

export const KONDISI_BADGE_COLOR: Record<string, 'success' | 'warning' | 'error' | 'gray'> = {
    baik: 'success',
    rusak_ringan: 'warning',
    rusak_berat: 'error',
    hilang: 'gray',
};
