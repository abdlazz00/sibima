import { MutationStatus, MutationType } from '@/types';

export const MUTATION_TYPE_LABEL: Record<MutationType, string> = {
    kec_ke_kel: 'Kecamatan ke Kelurahan',
    antar_kel: 'Antar Kelurahan',
    retur_kel_ke_kec: 'Retur ke Kecamatan',
    internal: 'Mutasi Internal',
    pengembalian: 'Pengembalian ke Inventaris',
};

export const MUTATION_TYPE_COLOR: Record<MutationType, 'indigo' | 'blue' | 'purple' | 'gray' | 'warning'> = {
    kec_ke_kel: 'indigo',
    antar_kel: 'blue',
    retur_kel_ke_kec: 'purple',
    internal: 'gray',
    pengembalian: 'warning',
};

export const MUTATION_STATUS_LABEL: Record<MutationStatus, string> = {
    pending: 'Menunggu Persetujuan',
    approved: 'Disetujui',
    rejected: 'Ditolak',
    cancelled: 'Dibatalkan',
};

export const MUTATION_STATUS_COLOR: Record<MutationStatus, 'warning' | 'success' | 'error' | 'gray'> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'error',
    cancelled: 'gray',
};
