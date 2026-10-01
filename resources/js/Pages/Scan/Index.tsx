import { ChevronRightIcon as ChevronRight } from '@/Components/Icons';
import QrScanner, { ScanError } from '@/Components/QrScanner';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_LABEL } from '@/lib/assetReport';
import { assetIdFromQr } from '@/lib/qr';
import { AssetScanSummary, PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

interface ScanProps extends PageProps {
    summary: AssetScanSummary | null;
    canViewDetail: boolean;
    notFound: boolean;
}

const ERROR_TEXT: Record<ScanError, string> = {
    insecure: 'Kamera hanya bisa dipakai lewat koneksi aman (HTTPS). Buka SIBIMA dengan alamat https:// lalu coba lagi.',
    denied: 'Izin kamera ditolak. Izinkan akses kamera untuk situs ini di pengaturan browser, lalu tekan Coba lagi.',
    'no-camera': 'Kamera tidak ditemukan di perangkat ini.',
    busy: 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut lalu tekan Coba lagi.',
    unknown: 'Kamera tidak dapat dibuka. Tekan Coba lagi atau muat ulang halaman.',
};

const KONDISI_STYLE: Record<string, string> = {
    baik: 'bg-emerald-50 text-emerald-700',
    rusak_ringan: 'bg-amber-50 text-amber-700',
    rusak_berat: 'bg-red-50 text-red-700',
    hilang: 'bg-slate-200 text-slate-700',
};

const BUTTON = 'rounded-lg bg-[#1E40AF] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-800';

export default function Index({ summary, canViewDetail, notFound }: ScanProps) {
    const [scanning, setScanning] = useState(summary === null && !notFound);
    const [scanKey, setScanKey] = useState(0);
    const [error, setError] = useState<ScanError | null>(null);
    const [invalid, setInvalid] = useState(false);

    const startScan = () => {
        setError(null);
        setInvalid(false);
        setScanKey((k) => k + 1);
        setScanning(true);
    };

    const handleDetect = (text: string) => {
        const id = assetIdFromQr(text);

        if (id === null) {
            setInvalid(true);
            return;
        }

        setInvalid(false);
        setScanning(false);
        router.get(route('scan.show', { id }));
    };

    const rows: [string, string][] = summary
        ? [
              ['Kode Barang', summary.kode_barang],
              ['No. Register', summary.nomor_register],
              ['Merk / Tipe', summary.merk_type ?? '—'],
              ['Kategori', summary.kategori ?? '—'],
              ['Unit', summary.unit ?? '—'],
              ['Pemegang', summary.pemegang ?? '—'],
          ]
        : [];

    return (
        <AuthenticatedLayout>
            <Head title="Scan QR" />

            <div className="space-y-6">
                <div>
                    <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Link href={route('dashboard')} className="hover:text-blue-700">Home</Link>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span className="font-medium text-slate-800">Scan QR</span>
                    </nav>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Scan QR Aset</h1>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="space-y-3">
                        {scanning && !error ? (
                            <>
                                <QrScanner key={scanKey} onDetect={handleDetect} onError={setError} />
                                <p className="text-center text-sm text-slate-600">Arahkan kamera ke QR pada label aset.</p>
                                {invalid && (
                                    <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                                        QR ini bukan label aset SIBIMA.
                                    </p>
                                )}
                            </>
                        ) : error ? (
                            <div role="alert" className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-5">
                                <p className="text-sm text-red-800">{ERROR_TEXT[error]}</p>
                                <button type="button" onClick={startScan} className={`${BUTTON} w-full sm:w-auto`}>Coba lagi</button>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                <button type="button" onClick={startScan} className={`${BUTTON} w-full`}>
                                    {summary || notFound ? 'Scan aset lain' : 'Mulai scan'}
                                </button>
                            </div>
                        )}
                    </div>

                    <div>
                        {notFound && (
                            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                <p className="text-base font-semibold text-slate-900">Aset tidak ditemukan</p>
                                <p className="mt-1 text-sm text-slate-600">Aset dengan QR ini sudah tidak ada di SIBIMA. Periksa label atau hubungi admin unit.</p>
                            </div>
                        )}

                        {summary && (
                            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                                {summary.foto && <img src={summary.foto} alt={summary.nama_aset} className="h-48 w-full object-cover" />}
                                <div className="space-y-4 p-5">
                                    <div>
                                        <p className="text-lg font-bold text-slate-900">{summary.nama_aset}</p>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            <span className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${KONDISI_STYLE[summary.kondisi] ?? KONDISI_STYLE.baik}`}>
                                                {KONDISI_LABEL[summary.kondisi] ?? summary.kondisi}
                                            </span>
                                            <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                                                {summary.status === 'aktif' ? 'Aktif' : 'Dalam Proses'}
                                            </span>
                                        </div>
                                    </div>

                                    <dl className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 text-sm">
                                        {rows.map(([label, value], i) => (
                                            <div key={label} className={`flex gap-4 px-3 py-2.5 ${i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                                                <dt className="w-32 shrink-0 font-medium text-slate-500">{label}</dt>
                                                <dd className="break-words text-slate-900">{value}</dd>
                                            </div>
                                        ))}
                                    </dl>

                                    {canViewDetail && (
                                        <Link href={route('assets.show', summary.id)} className={`${BUTTON} block text-center`}>
                                            Lihat detail lengkap
                                        </Link>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
