import { BeritaAcaraPenerimaan } from '@/types';

export type PenerimaanStatusKey = 'draft' | 'diajukan' | 'diverifikasi' | 'disetujui' | 'ditolak' | 'dibatalkan';

export const PENERIMAAN_STATUS_COLOR: Record<PenerimaanStatusKey, 'gray' | 'blue' | 'warning' | 'success' | 'error'> = {
    draft: 'gray',
    diajukan: 'blue',
    diverifikasi: 'warning',
    disetujui: 'success',
    ditolak: 'error',
    dibatalkan: 'gray',
};

export const PENERIMAAN_STATUS_LABEL: Record<PenerimaanStatusKey, string> = {
    draft: 'Draft',
    diajukan: 'Diajukan',
    diverifikasi: 'Diverifikasi',
    disetujui: 'Disetujui',
    ditolak: 'Ditolak',
    dibatalkan: 'Dibatalkan',
};

export function penerimaanStatus(ba: BeritaAcaraPenerimaan): PenerimaanStatusKey {
    const req = ba.approval_request;
    if (!req) return 'draft';
    if (req.status === 'approved') return 'disetujui';
    if (req.status === 'rejected') return 'ditolak';
    if (req.status === 'cancelled') return 'dibatalkan';
    return req.current_step >= 2 ? 'diverifikasi' : 'diajukan';
}
