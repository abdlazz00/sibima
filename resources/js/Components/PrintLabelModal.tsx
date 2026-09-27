import { useState } from 'react';
import { PrinterIcon } from '@/Components/Icons';

type LabelSize = 'kecil' | 'besar';

interface PrintLabelModalProps {
    assetIds: number[];
    onClose: () => void;
}

const SIZE_OPTIONS: { value: LabelSize; label: string; description: string }[] = [
    { value: 'kecil', label: 'Kecil', description: '83 x 25 mm — untuk barang berukuran kecil (2 label/baris)' },
    { value: 'besar', label: 'Besar', description: '100 x 40 mm — untuk barang berukuran besar (1 label/baris)' },
];

export default function PrintLabelModal({ assetIds, onClose }: PrintLabelModalProps) {
    const [size, setSize] = useState<LabelSize>('kecil');

    const print = () => {
        window.open(route('assets.labels', { ids: assetIds, size }), '_blank');
        onClose();
    };

    return (
        <div
            className="backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                        <PrinterIcon className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-gray-900">Cetak Label Aset</h3>
                        <p className="text-xs text-gray-500">
                            {assetIds.length} aset dipilih. Pilih ukuran label.
                        </p>
                    </div>
                </div>

                <div className="mb-6 space-y-2">
                    {SIZE_OPTIONS.map((option) => (
                        <label
                            key={option.value}
                            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                                size === option.value
                                    ? 'border-blue-600 bg-blue-50/60 ring-1 ring-blue-600'
                                    : 'border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            <input
                                type="radio"
                                name="label-size"
                                value={option.value}
                                checked={size === option.value}
                                onChange={() => setSize(option.value)}
                                className="mt-0.5"
                            />
                            <span>
                                <span className="block text-sm font-semibold text-gray-900">{option.label}</span>
                                <span className="block text-xs text-gray-500">{option.description}</span>
                            </span>
                        </label>
                    ))}
                </div>

                <div className="flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={print}
                        className="shadow-xs inline-flex items-center gap-2 rounded-lg bg-[#1E40AF] px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
                    >
                        <PrinterIcon className="h-4 w-4" />
                        Cetak
                    </button>
                </div>
            </div>
        </div>
    );
}
