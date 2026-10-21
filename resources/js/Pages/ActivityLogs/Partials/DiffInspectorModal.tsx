import { Dialog, Modal, ModalOverlay } from '@/Components/ui/application/modals/modal';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { ClockRewind, File05, User01, XClose } from '@untitledui/icons';
import React from 'react';

export interface DiffItem {
    field: string;
    key: string;
    old: string;
    new: string;
}

export interface ActivityLogItem {
    id: number;
    waktu: string;
    waktu_relatif: string;
    pelaku: {
        id: number | null;
        nama: string;
        email?: string;
        role?: string;
    };
    aksi: string;
    modul: string;
    deskripsi: string;
    target: string;
    diff: DiffItem[];
}

interface DiffInspectorModalProps {
    log: ActivityLogItem | null;
    isOpen: boolean;
    onClose: () => void;
}

const EVENT_BADGE: Record<string, { color: 'success' | 'brand' | 'error' | 'gray'; label: string }> = {
    created: { color: 'success', label: 'Dibuat (Created)' },
    updated: { color: 'brand', label: 'Diubah (Updated)' },
    deleted: { color: 'error', label: 'Dihapus (Deleted)' },
    restored: { color: 'brand', label: 'Dipulihkan (Restored)' },
};

export default function DiffInspectorModal({ log, isOpen, onClose }: DiffInspectorModalProps) {
    if (!log) return null;

    const eventInfo = EVENT_BADGE[log.aksi] || { color: 'gray', label: log.aksi };

    return (
        <ModalOverlay isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Modal className="sm:max-w-3xl">
                <Dialog role="dialog" aria-labelledby="diff-modal-title">
                    <div className="w-full p-6 sm:p-7">
                        {/* Header */}
                        <div className="flex items-start justify-between border-b border-slate-200/80 pb-5 dark:border-slate-800">
                            <div className="flex items-start gap-3.5">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                                    <ClockRewind className="size-6" aria-hidden="true" />
                                </div>
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 id="diff-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
                                            Rincian Perubahan Data
                                        </h3>
                                        <Badge color={eventInfo.color} size="sm">
                                            {eventInfo.label}
                                        </Badge>
                                    </div>
                                    <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-400">
                                        {log.deskripsi} &bull; <span className="text-slate-900 font-semibold dark:text-slate-200">{log.target}</span>
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                aria-label="Tutup modal"
                            >
                                <XClose className="size-5" />
                            </button>
                        </div>

                        {/* Metadata Bar */}
                        <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-3 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                            <div className="flex items-center gap-2.5">
                                <User01 className="size-4 shrink-0 text-slate-400" />
                                <div className="min-w-0">
                                    <span className="block text-xs text-slate-500 dark:text-slate-400">Pelaku Aktivitas</span>
                                    <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                                        {log.pelaku.nama}
                                    </span>
                                    {log.pelaku.role && log.pelaku.role !== '-' && (
                                        <span className="inline-block mt-0.5 text-[11px] text-blue-600 font-medium dark:text-blue-400">
                                            {log.pelaku.role}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2.5">
                                <ClockRewind className="size-4 shrink-0 text-slate-400" />
                                <div>
                                    <span className="block text-xs text-slate-500 dark:text-slate-400">Waktu Kejadian</span>
                                    <span className="block text-xs font-semibold text-slate-800 tabular-nums dark:text-slate-200">
                                        {log.waktu}
                                    </span>
                                    <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                                        {log.waktu_relatif}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2.5">
                                <File05 className="size-4 shrink-0 text-slate-400" />
                                <div>
                                    <span className="block text-xs text-slate-500 dark:text-slate-400">Modul Sistem</span>
                                    <span className="inline-block mt-0.5 rounded px-2 py-0.5 text-xs font-medium uppercase tracking-wide bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                                        {log.modul}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Diff Comparison Table */}
                        <div className="mt-5">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    Perbandingan Nilai Bidang
                                </h4>
                                <span className="text-xs text-slate-500">
                                    {log.diff.length} bidang terdampak
                                </span>
                            </div>

                            {log.diff.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Tidak ada perubahan nilai atribut khusus yang tersimpan (perekaman tindakan/event murni).
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                                    <table className="w-full border-collapse text-left text-xs sm:text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-700 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300">
                                                <th className="py-2.5 px-3.5 font-semibold sm:w-1/3">Bidang / Atribut</th>
                                                <th className="py-2.5 px-3.5 font-semibold sm:w-1/3">Nilai Sebelum</th>
                                                <th className="py-2.5 px-3.5 font-semibold sm:w-1/3">Nilai Sesudah</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {log.diff.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                                                    <td className="py-2.5 px-3.5 font-medium text-slate-900 dark:text-slate-200">
                                                        {item.field}
                                                        <span className="block text-[11px] font-mono text-slate-400 dark:text-slate-500">
                                                            {item.key}
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-3.5">
                                                        <span className="inline-block rounded-md border border-rose-200 bg-rose-50/80 px-2.5 py-1 text-xs text-rose-800 line-through decoration-rose-400 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                                                            {item.old}
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-3.5">
                                                        <span className="inline-block rounded-md border border-emerald-200 bg-emerald-50/80 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                                                            {item.new}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="mt-6 flex items-center justify-end border-t border-slate-200/80 pt-4 dark:border-slate-800">
                            <Button color="secondary" size="md" onPress={onClose} autoFocus>
                                Tutup
                            </Button>
                        </div>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
}
