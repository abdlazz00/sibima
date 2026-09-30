import { AssetRequestStatus, AssetRequestType } from '@/types';

export const REQUEST_STATUS_LABEL: Record<AssetRequestStatus, string> = {
    pending: 'Menunggu Persetujuan',
    approved: 'Menunggu Pemenuhan',
    fulfilled: 'Dipenuhi',
    rejected: 'Ditolak',
    cancelled: 'Dibatalkan',
};

export const REQUEST_STATUS_STYLE: Record<AssetRequestStatus, string> = {
    pending: 'bg-amber-50 text-amber-700',
    approved: 'bg-blue-50 text-blue-700',
    fulfilled: 'bg-emerald-50 text-emerald-700',
    rejected: 'bg-red-50 text-red-700',
    cancelled: 'bg-slate-100 text-slate-500',
};

export const REQUEST_TYPE_LABEL: Record<AssetRequestType, string> = {
    pegawai: 'Pegawai',
    unit: 'Unit',
};
