import { BeritaAcaraPenerimaan } from '@/types';

export type PenerimaanStatusKey = 'draft' | 'diajukan' | 'diverifikasi' | 'disetujui' | 'ditolak' | 'dibatalkan';

export const PENERIMAAN_STATUS_STYLE: Record<PenerimaanStatusKey, string> = {
    draft: 'bg-slate-100 text-slate-700',
    diajukan: 'bg-blue-50 text-blue-700',
    diverifikasi: 'bg-amber-50 text-amber-700',
    disetujui: 'bg-emerald-50 text-emerald-700',
    ditolak: 'bg-red-50 text-red-700',
    dibatalkan: 'bg-slate-100 text-slate-500',
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
