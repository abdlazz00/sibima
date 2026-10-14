import { Dialog, Modal, ModalOverlay } from '@/Components/ui/application/modals/modal';
import { PaginationPageDefault } from '@/Components/ui/application/pagination/pagination';
import { Table } from '@/Components/ui/application/table/table';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import { KONDISI_BADGE_COLOR, KONDISI_LABEL } from '@/lib/assetReport';
import { SearchLg } from '@untitledui/icons';
import { useEffect, useMemo, useState } from 'react';
import type { Selection } from 'react-aria-components';

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

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return assets;
        return assets.filter(
            (a) =>
                a.nama_aset?.toLowerCase().includes(q) ||
                a.kode_barang?.toLowerCase().includes(q) ||
                String(a.nomor_register).includes(q) ||
                a.merk_type?.toLowerCase().includes(q) ||
                a.holder?.toLowerCase().includes(q),
        );
    }, [assets, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const paginated = useMemo(() => filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE), [filtered, page]);
    const pageIds = paginated.map((a) => a.id);

    // Pilihan di halaman lain dipertahankan; "pilih semua" hanya mencakup halaman aktif.
    const handleSelectionChange = (keys: Selection) => {
        const picked = keys === 'all' ? pageIds : [...keys].map(Number);

        if (mode === 'single') {
            setTempSelected(picked.slice(-1));
            return;
        }

        const merged = [...tempSelected.filter((id) => !pageIds.includes(id)), ...picked.filter((id) => pageIds.includes(id))];
        setTempSelected(maxSelection ? merged.slice(0, maxSelection) : merged);
    };

    const handleConfirm = () => {
        onConfirm(assets.filter((a) => tempSelected.includes(a.id)));
        onClose();
    };

    const isExceeding = maxSelection !== undefined && tempSelected.length > maxSelection;
    const isConfirmDisabled = tempSelected.length === 0 || (maxSelection !== undefined && tempSelected.length !== maxSelection);

    return (
        <ModalOverlay
            isOpen={isOpen}
            isDismissable
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <Modal className="sm:max-w-4xl">
                <Dialog aria-label={title} className="flex flex-col overflow-hidden">
                    <div className="border-b border-slate-200 px-6 py-4">
                        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
                        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
                    </div>

                    <div className="space-y-2 border-b border-slate-100 bg-slate-50/70 px-6 py-3">
                        <Input
                            aria-label="Cari aset"
                            size="md"
                            icon={SearchLg}
                            autoFocus
                            placeholder="Cari berdasarkan nama aset, kode barang, no. register, merk..."
                            value={search}
                            onChange={(v) => {
                                setSearch(v);
                                setPage(1);
                            }}
                        />
                        <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>Menampilkan {filtered.length} aset yang sesuai</span>
                            {mode === 'multiple' && maxSelection && (
                                <span className="font-semibold text-blue-700">Batas pilihan: tepat {maxSelection} aset</span>
                            )}
                        </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div className="py-12 text-center">
                                <p className="text-sm font-semibold text-slate-700">Tidak ada aset ditemukan</p>
                                <p className="mt-1 text-xs text-slate-400">Coba ubah kata kunci pencarian Anda</p>
                            </div>
                        ) : (
                            <Table
                                aria-label="Daftar aset yang dapat dipilih"
                                size="sm"
                                selectionMode={mode === 'single' ? 'single' : 'multiple'}
                                selectedKeys={new Set<number | string>(tempSelected)}
                                disabledKeys={disabledIds}
                                onSelectionChange={handleSelectionChange}
                            >
                                <Table.Header>
                                    <Table.Head id="kode" label="Kode & Register" isRowHeader />
                                    <Table.Head id="nama" label="Nama Barang & Merk" />
                                    <Table.Head id="kondisi" label="Kondisi" />
                                    <Table.Head id="pemegang" label="Pemegang Saat Ini" />
                                </Table.Header>
                                <Table.Body items={paginated}>
                                    {(asset) => (
                                        <Table.Row id={asset.id}>
                                            <Table.Cell className="whitespace-nowrap">
                                                <span className="font-mono text-xs text-slate-700">{asset.kode_barang}</span>
                                                <span className="block text-[11px] font-semibold text-slate-500">
                                                    Reg. #{String(asset.nomor_register).padStart(4, '0')}
                                                </span>
                                            </Table.Cell>
                                            <Table.Cell>
                                                <span className="font-semibold text-slate-900">{asset.nama_aset}</span>
                                                <span className="block text-xs text-slate-500">{asset.merk_type || '—'}</span>
                                            </Table.Cell>
                                            <Table.Cell>
                                                <Badge type="color" size="sm" color={KONDISI_BADGE_COLOR[asset.kondisi] ?? 'gray'} className="rounded-sm">
                                                    {KONDISI_LABEL[asset.kondisi] ?? asset.kondisi}
                                                </Badge>
                                            </Table.Cell>
                                            <Table.Cell className="whitespace-nowrap text-xs">
                                                {asset.holder ? (
                                                    <span className="font-medium text-slate-900">{asset.holder}</span>
                                                ) : (
                                                    <span className="italic text-slate-400">Inventaris Unit</span>
                                                )}
                                            </Table.Cell>
                                        </Table.Row>
                                    )}
                                </Table.Body>
                            </Table>
                        )}
                    </div>

                    {totalPages > 1 && (
                        <div className="border-t border-slate-200 px-6 py-3">
                            <PaginationPageDefault className="border-t-0 pt-0 md:pt-0" page={page} total={totalPages} onPageChange={setPage} />
                        </div>
                    )}

                    <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                        <p className="text-sm font-medium">
                            {mode === 'single' ? (
                                <span>{tempSelected.length === 1 ? '1 aset dipilih' : 'Pilih 1 aset'}</span>
                            ) : (
                                <span className={isExceeding ? 'font-bold text-red-600' : 'text-slate-700'}>
                                    {tempSelected.length} aset dipilih
                                    {maxSelection && ` (harus tepat ${maxSelection})`}
                                </span>
                            )}
                        </p>
                        <div className="flex items-center gap-3">
                            <Button color="secondary" size="md" onPress={onClose}>
                                Batal
                            </Button>
                            <Button color="primary" size="md" isDisabled={isConfirmDisabled} onPress={handleConfirm}>
                                Gunakan {tempSelected.length > 0 ? `(${tempSelected.length}) ` : ''}Aset Terpilih
                            </Button>
                        </div>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
}
