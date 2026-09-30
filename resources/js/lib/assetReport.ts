import { AssetReportStatus, AssetReportType } from '@/types';

export const REPORT_STATUS_LABEL: Record<AssetReportStatus, string> = {
    pending: 'Menunggu Persetujuan',
    approved: 'Disetujui',
    rejected: 'Ditolak',
    cancelled: 'Dibatalkan',
};

export const REPORT_STATUS_STYLE: Record<AssetReportStatus, string> = {
    pending: 'bg-amber-50 text-amber-700',
    approved: 'bg-emerald-50 text-emerald-700',
    rejected: 'bg-red-50 text-red-700',
    cancelled: 'bg-slate-100 text-slate-500',
};

export const REPORT_TYPE_LABEL: Record<AssetReportType, string> = { rusak: 'Rusak', hilang: 'Hilang' };

export const KONDISI_LABEL: Record<string, string> = {
    baik: 'Baik',
    rusak_ringan: 'Rusak Ringan',
    rusak_berat: 'Rusak Berat',
    hilang: 'Hilang',
};
