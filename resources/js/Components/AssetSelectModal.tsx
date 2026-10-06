import { SearchIcon as Search, XIcon as X } from '@/Components/Icons';
import { useEffect, useMemo, useState } from 'react';

export interface SelectableAsset {
    id: number;
    kode_barang: string;
    nomor_register: number | string;
    nama_aset: string;
    merk_type?: string | null;
    kondisi: string;
    holder?: string | null;
    unit_id?: number;
    unit_name?: string | null;
}

export interface AssetSelectModalProps {
    isOpen: boolean;
    onClose: () => void;
    assets: SelectableAsset[];
    selectedIds: number[];
    onConfirm: (selected: SelectableAsset[]) => void;
    mode?: 'single' | 'multiple';
    maxSelection?: number;
    title?: string;
    description?: string;
    disabledIds?: number[];
}

const ITEMS_PER_PAGE = 10;

const KONDISI_BADGE: Record<string, { label: string; class: string }> = {
    baik: { label: 'Baik', class: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    rusak_ringan: { label: 'Rusak Ringan', class: 'bg-amber-100 text-amber-800 border-amber-200' },
    rusak_berat: { label: 'Rusak Berat', class: 'bg-red-100 text-red-800 border-red-200' },
    hilang: { label: 'Hilang', class: 'bg-slate-100 text-slate-800 border-slate-200' },
};

export default function AssetSelectModal({
    isOpen,
    onClose,
    assets,
    selectedIds,
    onConfirm,
    mode = 'multiple',
    maxSelection,
    title = 'Pilih Aset',
    description = 'Pilih aset dari tabel di bawah ini, lalu klik tombol Simpan Pilihan.',
    disabledIds = [],
}: AssetSelectModalProps) {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [tempSelected, setTempSelected] = useState<number[]>(selectedIds);

    useEffect(() => {
        if (isOpen) {
            setTempSelected(selectedIds);
            setSearch('');
            setPage(1);
        }
    }, [isOpen, selectedIds]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return assets;
        return assets.filter((a) =>
            a.nama_aset?.toLowerCase().includes(q) ||
            a.kode_barang?.toLowerCase().includes(q) ||
            String(a.nomor_register).includes(q) ||
            a.merk_type?.toLowerCase().includes(q) ||
            a.holder?.toLowerCase().includes(q)
        );
    }, [assets, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const paginated = useMemo(() => {
        const start = (page - 1) * ITEMS_PER_PAGE;
        return filtered.slice(start, start + ITEMS_PER_PAGE);
    }, [filtered, page]);

    const toggleAsset = (id: number) => {
        if (disabledIds.includes(id)) return;

        if (mode === 'single') {
            setTempSelected([id]);
            return;
        }

        if (tempSelected.includes(id)) {
            setTempSelected(tempSelected.filter((i) => i !== id));
        } else {
            if (maxSelection && tempSelected.length >= maxSelection) {
                return;
            }
            setTempSelected([...tempSelected, id]);
        }
    };

    const handleConfirm = () => {
        const selectedObjects = assets.filter((a) => tempSelected.includes(a.id));
        onConfirm(selectedObjects);
        onClose();
    };

    if (!isOpen) return null;

    const isExceeding = maxSelection !== undefined && tempSelected.length > maxSelection;
    const isUnderQuota = maxSelection !== undefined && tempSelected.length !== maxSelection;
    const isConfirmDisabled = tempSelected.length === 0 || (maxSelection !== undefined && isUnderQuota);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={onClose} />

            <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4.5">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
                        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-3">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                            placeholder="Cari berdasarkan nama aset, kode barang, no. register, merk..."
                            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            autoFocus
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600"
                            >
                                Bersihkan
                            </button>
                        )}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                        <span>Menampilkan {filtered.length} aset yang sesuai</span>
                        {mode === 'multiple' && maxSelection && (
                            <span className="font-semibold text-blue-700">Batas pilihan: tepat {maxSelection} aset</span>
                        )}
                    </div>
                </div>

                {/* Table Body */}
                <div className="flex-1 overflow-y-auto px-6 py-2">
                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <p className="text-sm font-semibold text-slate-700">Tidak ada aset ditemukan</p>
                            <p className="mt-1 text-xs text-slate-400">Coba ubah kata kunci pencarian Anda</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                        <th className="py-3 px-3 w-12 text-center">Pilih</th>
                                        <th className="py-3 px-3">Kode & Register</th>
                                        <th className="py-3 px-3">Nama Barang & Merk</th>
                                        <th className="py-3 px-3">Kondisi</th>
                                        <th className="py-3 px-3">Pemegang Saat Ini</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {paginated.map((asset) => {
                                        const isSelected = tempSelected.includes(asset.id);
                                        const isDisabled = disabledIds.includes(asset.id);

                                        return (
                                            <tr
                                                key={asset.id}
                                                onClick={() => !isDisabled && toggleAsset(asset.id)}
                                                className={`cursor-pointer transition select-none ${
                                                    isDisabled
                                                        ? 'opacity-40 cursor-not-allowed bg-slate-50'
                                                        : isSelected
                                                        ? 'bg-blue-50/80 font-medium'
                                                        : 'hover:bg-slate-50/80'
                                                }`}
                                            >
                                                <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type={mode === 'single' ? 'radio' : 'checkbox'}
                                                        checked={isSelected}
                                                        disabled={isDisabled}
                                                        onChange={() => toggleAsset(asset.id)}
                                                        className="h-4.5 w-4.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                </td>
                                                <td className="py-3.5 px-3 whitespace-nowrap">
                                                    <div className="font-mono text-xs text-slate-700">{asset.kode_barang}</div>
                                                    <div className="mt-0.5 inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                                                        Reg. #{String(asset.nomor_register).padStart(4, '0')}
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-3">
                                                    <div className="font-semibold text-slate-900">{asset.nama_aset}</div>
                                                    <div className="text-xs text-slate-500">{asset.merk_type || '—'}</div>
                                                </td>
                                                <td className="py-3.5 px-3 whitespace-nowrap">
                                                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${KONDISI_BADGE[asset.kondisi]?.class || 'bg-slate-100 text-slate-700'}`}>
                                                        {KONDISI_BADGE[asset.kondisi]?.label || asset.kondisi}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-3 text-xs text-slate-600 whitespace-nowrap">
                                                    {asset.holder ? (
                                                        <span className="font-medium text-slate-900">{asset.holder}</span>
                                                    ) : (
                                                        <span className="text-slate-400 italic">Inventaris Unit</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-slate-200 px-6 py-2.5 text-xs text-slate-600">
                        <span>Halaman {page} dari {totalPages}</span>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                disabled={page === 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                className="rounded-lg border border-slate-300 px-3 py-1 font-medium hover:bg-slate-50 disabled:opacity-40"
                            >
                                Sebelumnya
                            </button>
                            <button
                                type="button"
                                disabled={page === totalPages}
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                className="rounded-lg border border-slate-300 px-3 py-1 font-medium hover:bg-slate-50 disabled:opacity-40"
                            >
                                Berikutnya
                            </button>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
                    <div className="text-sm font-medium">
                        {mode === 'single' ? (
                            <span>{tempSelected.length === 1 ? '1 aset dipilih' : 'Pilih 1 aset'}</span>
                        ) : (
                            <span className={isExceeding ? 'text-red-600 font-bold' : 'text-slate-700'}>
                                {tempSelected.length} aset dipilih
                                {maxSelection && ` (harus tepat ${maxSelection})`}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            Batal
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={isConfirmDisabled}
                            className="rounded-xl bg-[#1E40AF] px-5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-800 disabled:opacity-50"
                        >
                            Gunakan {tempSelected.length > 0 ? `(${tempSelected.length}) ` : ''}Aset Terpilih
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
