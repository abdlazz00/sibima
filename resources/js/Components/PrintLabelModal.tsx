import { PrinterIcon } from '@/Components/Icons';
import { useEffect, useState } from 'react';

type LabelSize = 'kecil' | 'besar';

interface PrintLabelModalProps {
    assetIds: number[];
    onClose: () => void;
}

const SIZE_OPTIONS: { value: LabelSize; label: string; description: string }[] = [
    { value: 'kecil', label: 'Kecil', description: '83 x 25 mm — cocok untuk aset ukuran kecil/sedang (2 label/baris)' },
    { value: 'besar', label: 'Besar', description: '94 x 38 mm — area teks lebih leluasa untuk inventaris besar (2 label/baris)' },
];

export default function PrintLabelModal({ assetIds, onClose }: PrintLabelModalProps) {
    const [size, setSize] = useState<LabelSize>('kecil');
    const [popupBlocked, setPopupBlocked] = useState(false);
    const [printUrl, setPrintUrl] = useState<string | null>(null);

    const isExceeded = assetIds.length > 99;
    const isZero = assetIds.length === 0;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const print = () => {
        if (isExceeded || isZero) return;
        const targetUrl = route('assets.labels', { ids: assetIds, size });
        const win = window.open(targetUrl, '_blank');
        if (!win || win.closed || typeof win.closed === 'undefined') {
            setPopupBlocked(true);
            setPrintUrl(targetUrl);
        } else {
            onClose();
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="print-modal-title"
                className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                        <PrinterIcon className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 id="print-modal-title" className="text-base font-bold text-slate-900">
                            Cetak Label Aset BMD
                        </h3>
                        <p className="text-xs text-slate-600">
                            {assetIds.length} aset dipilih. Pilih format ukuran label.
                        </p>
                    </div>
                </div>

                {isExceeded && (
                    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                        <p className="font-semibold">Batas Cetak Terlampaui</p>
                        <p className="mt-0.5">
                            Maksimal 99 label per cetak untuk menjaga performa. Saat ini Anda memilih {assetIds.length} aset. Harap kurangi jumlah pilihan.
                        </p>
                    </div>
                )}

                <fieldset className="mb-6 space-y-2">
                    <legend className="sr-only">Pilihan Ukuran Label</legend>
                    {SIZE_OPTIONS.map((option) => (
                        <label
                            key={option.value}
                            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-1 ${
                                size === option.value
                                    ? 'border-blue-600 bg-blue-50/60 ring-1 ring-blue-600'
                                    : 'border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            <input
                                type="radio"
                                name="label-size"
                                value={option.value}
                                checked={size === option.value}
                                onChange={() => setSize(option.value)}
                                className="mt-0.5 text-blue-600 focus:ring-blue-500"
                            />
                            <span>
                                <span className="block text-sm font-semibold text-slate-900">{option.label}</span>
                                <span className="block text-xs text-slate-600">{option.description}</span>
                            </span>
                        </label>
                    ))}
                </fieldset>

                {popupBlocked && printUrl && (
                    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                        <p className="font-semibold">Popup Diblokir Browser</p>
                        <p className="mt-0.5">Browser Anda memblokir jendela baru. Klik tombol di bawah untuk membuka:</p>
                        <a
                            href={printUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1.5 inline-block font-bold text-blue-700 underline hover:text-blue-900"
                            onClick={onClose}
                        >
                            Buka Label PDF &rarr;
                        </a>
                    </div>
                )}

                <div className="flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={print}
                        disabled={isExceeded || isZero}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <PrinterIcon className="h-4 w-4" />
                        Cetak Label
                    </button>
                </div>
            </div>
        </div>
    );
}
