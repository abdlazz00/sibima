import PageHeader from '@/Components/PageHeader';
import QrScanner, { ScanError } from '@/Components/QrScanner';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_BADGE_COLOR, KONDISI_LABEL } from '@/lib/assetReport';
import { qrTokenFromScan } from '@/lib/qr';
import { AssetScanSummary, PageProps } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Camera01, RefreshCw01 } from '@untitledui/icons';
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
        const token = qrTokenFromScan(text);

        if (token === null) {
            setInvalid(true);
            return;
        }

        setInvalid(false);
        setScanning(false);
        router.get(route('scan.show', { token }));
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
                <PageHeader crumbs={[{ label: 'Scan QR' }]} title="Scan QR Aset" />

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="space-y-3">
                        {scanning && !error ? (
                            <>
                                <QrScanner key={scanKey} onDetect={handleDetect} onError={setError} />
                                <p className="text-center text-sm text-slate-600">Arahkan kamera ke QR pada label aset.</p>
                                <Button color="secondary" size="lg" className="w-full" onPress={() => setScanning(false)}>
                                    Tutup kamera
                                </Button>
                                {invalid && (
                                    <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                                        QR ini bukan label aset SIBIMA.
                                    </p>
                                )}
                            </>
                        ) : error ? (
                            <div role="alert" className="space-y-4 rounded-xl border border-red-200 bg-red-50 p-5">
                                <p className="text-sm text-red-800">{ERROR_TEXT[error]}</p>
                                <Button color="primary" size="lg" iconLeading={RefreshCw01} className="w-full sm:w-auto" onPress={startScan}>
                                    Coba lagi
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                                {!summary && !notFound && (
                                    <div className="flex items-start gap-3">
                                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                                            <Camera01 className="size-5" aria-hidden="true" />
                                        </div>
                                        <p className="text-sm text-slate-600">
                                            Arahkan kamera ke QR pada label aset untuk melihat ringkasan aset di lapangan.
                                        </p>
                                    </div>
                                )}
                                <Button
                                    color={summary || notFound ? 'secondary' : 'primary'}
                                    size="lg"
                                    iconLeading={Camera01}
                                    className="w-full"
                                    onPress={startScan}
                                >
                                    {summary || notFound ? 'Scan aset lain' : 'Mulai scan'}
                                </Button>
                            </div>
                        )}
                    </div>

                    <div>
                        {notFound && (
                            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                                <p className="text-base font-semibold text-slate-900">Aset tidak ditemukan</p>
                                <p className="mt-1 text-sm text-slate-600">
                                    Aset dengan QR ini sudah tidak ada di SIBIMA. Periksa label atau hubungi admin unit.
                                </p>
                            </div>
                        )}

                        {summary && (
                            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                                {summary.foto && <img src={summary.foto} alt={summary.nama_aset} className="h-48 w-full object-cover" />}
                                <div className="space-y-4 p-5">
                                    <div>
                                        <p className="text-lg font-bold text-slate-900">{summary.nama_aset}</p>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            <Badge type="color" size="sm" color={KONDISI_BADGE_COLOR[summary.kondisi] ?? 'gray'} className="rounded-sm">
                                                {KONDISI_LABEL[summary.kondisi] ?? summary.kondisi}
                                            </Badge>
                                            <Badge type="color" size="sm" color={summary.status === 'aktif' ? 'brand' : 'warning'} className="rounded-sm">
                                                {summary.status === 'aktif' ? 'Aktif' : 'Dalam Proses'}
                                            </Badge>
                                        </div>
                                    </div>

                                    <dl className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 text-sm">
                                        {rows.map(([label, value], i) => (
                                            <div
                                                key={label}
                                                className={`flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:gap-4 ${i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}
                                            >
                                                <dt className="shrink-0 font-medium text-slate-500 sm:w-32">{label}</dt>
                                                <dd className="wrap-break-word text-slate-900">{value}</dd>
                                            </div>
                                        ))}
                                    </dl>

                                    {canViewDetail && (
                                        <Button color="primary" size="lg" href={route('assets.show', summary.id)} className="w-full">
                                            Lihat detail lengkap
                                        </Button>
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
