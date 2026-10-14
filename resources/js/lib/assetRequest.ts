import { AssetRequestStatus, AssetRequestType } from '@/types';

export const REQUEST_STATUS_LABEL: Record<AssetRequestStatus, string> = {
    pending: 'Menunggu Persetujuan',
    approved: 'Menunggu Pemenuhan',
    fulfilled: 'Dipenuhi',
    rejected: 'Ditolak',
    cancelled: 'Dibatalkan',
};

export const REQUEST_STATUS_COLOR: Record<AssetRequestStatus, 'warning' | 'blue' | 'success' | 'error' | 'gray'> = {
    pending: 'warning',
    approved: 'blue',
    fulfilled: 'success',
    rejected: 'error',
    cancelled: 'gray',
};

export const REQUEST_TYPE_LABEL: Record<AssetRequestType, string> = {
    pegawai: 'Pegawai',
    unit: 'Unit',
};
