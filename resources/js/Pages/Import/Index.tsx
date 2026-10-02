import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { FormEvent, useEffect } from 'react';

interface Batch {
    id: number;
    nama_berkas: string;
    status: string;
    total_baris: number;
    jumlah_baru: number;
    jumlah_duplikat: number;
    jumlah_error: number;
    jumlah_masuk: number;
    progres: number;
    pesan: string | null;
}

interface Riwayat {
    id: number;
    nama_berkas: string;
    status: string;
    jumlah_baru: number;
    jumlah_duplikat: number;
    jumlah_error: number;
    jumlah_masuk: number;
    created_at: string;
    pengunggah: string | null;
}

interface ErrorRow {
    baris: number;
    detail: { kolom: string; alasan: string }[];
}

interface Props extends PageProps {
    modul: string;
    label: string;
    batch: Batch | null;
    preview: { errors: ErrorRow[]; peringatan: Record<string, number> };
    riwayat: Riwayat[];
    maxKb: number;
    maxRows: number;
}

const CARD = 'rounded-lg border border-slate-200 bg-white p-5';
const PRIMARY =
    'inline-flex items-center justify-center rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50';
const SECONDARY =
    'inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2';

const STATUS: Record<string, { label: string; cls: string }> = {
    memeriksa: { label: 'Memeriksa', cls: 'bg-amber-50 text-amber-800' },
    siap: { label: 'Siap dikonfirmasi', cls: 'bg-blue-50 text-blue-800' },
    memproses: { label: 'Memproses', cls: 'bg-amber-50 text-amber-800' },
    selesai: { label: 'Selesai', cls: 'bg-green-50 text-green-800' },
    gagal: { label: 'Gagal', cls: 'bg-red-50 text-red-800' },
    kedaluwarsa: { label: 'Kedaluwarsa', cls: 'bg-slate-100 text-slate-600' },
};

function StatusBadge({ status }: { status: string }) {
    const s = STATUS[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600' };
    return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

function Stat({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value.toLocaleString('id-ID')}</p>
        </div>
    );
}

export default function Index({ modul, label, batch, preview, riwayat, maxKb, maxRows }: Props) {
    const form = useForm<{ berkas: File | null }>({ berkas: null });
    const active = batch !== null && (batch.status === 'memeriksa' || batch.status === 'memproses');
    const percent = batch && batch.total_baris > 0 ? Math.min(100, Math.round((batch.progres / batch.total_baris) * 100)) : 0;

    useEffect(() => {
        if (!active) return;
        const timer = setInterval(() => router.reload({ only: ['batch', 'preview', 'riwayat'] }), 2000);
        return () => clearInterval(timer);
    }, [active]);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(route('import.store', modul), { forceFormData: true, onSuccess: () => form.reset() });
    };

    return (
        <AuthenticatedLayout>
            <Head title={`Impor ${label}`} />

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Impor {label}</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Unggah berkas Excel, periksa pratinjau, lalu konfirmasi. Baris yang sudah ada dilewati.
                    </p>
                </div>

                <form onSubmit={submit} className={`${CARD} space-y-3`}>
                    <label htmlFor="berkas" className="block text-sm font-medium text-slate-900">
                        Berkas Excel (.xlsx)
                    </label>
                    <input
                        id="berkas"
                        type="file"
                        accept=".xlsx"
                        onChange={(e) => form.setData('berkas', e.target.files?.[0] ?? null)}
                        className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-semibold"
                    />
                    {form.errors.berkas && <p className="text-sm text-red-700">{form.errors.berkas}</p>}
                    <p className="text-xs text-slate-500">
                        Maksimal {maxKb / 1024} MB dan {maxRows.toLocaleString('id-ID')} baris per berkas.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <button type="submit" disabled={!form.data.berkas || form.processing} className={PRIMARY}>
                            {form.processing ? 'Mengunggah…' : 'Unggah & periksa'}
                        </button>
                        <a href={route('import.template', modul)} className={SECONDARY}>
                            Unduh template
                        </a>
                    </div>
                </form>

                {batch && (
                    <section className={`${CARD} space-y-4`} aria-live="polite">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <p className="text-sm font-semibold text-slate-900">{batch.nama_berkas}</p>
                                <p className="text-xs text-slate-500">{batch.total_baris.toLocaleString('id-ID')} baris</p>
                            </div>
                            <StatusBadge status={batch.status} />
                        </div>

                        {active && (
                            <div>
                                <div className="h-2 overflow-hidden rounded bg-slate-100">
                                    <div className="h-2 bg-blue-700 transition-all" style={{ width: `${percent}%` }} />
                                </div>
                                <p className="mt-1 text-xs tabular-nums text-slate-500">
                                    {batch.progres.toLocaleString('id-ID')} / {batch.total_baris.toLocaleString('id-ID')} baris
                                </p>
                            </div>
                        )}

                        {batch.status === 'gagal' && <p className="text-sm text-red-700">{batch.pesan}</p>}

                        {(batch.status === 'siap' || batch.status === 'selesai') && (
                            <>
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                    <Stat label="Baru" value={batch.jumlah_baru} />
                                    <Stat label="Sudah ada (dilewati)" value={batch.jumlah_duplikat} />
                                    <Stat label="Error" value={batch.jumlah_error} />
                                    {batch.status === 'selesai' && <Stat label="Berhasil masuk" value={batch.jumlah_masuk} />}
                                </div>

                                {Object.entries(preview.peringatan).map(([text, n]) => (
                                    <p key={text} className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
                                        {n.toLocaleString('id-ID')} baris — {text}
                                    </p>
                                ))}

                                {preview.errors.length > 0 && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <caption className="mb-2 text-left text-sm font-semibold text-slate-900">
                                                Baris bermasalah (menampilkan {preview.errors.length} pertama)
                                            </caption>
                                            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                                <tr>
                                                    <th className="px-3 py-2">Baris</th>
                                                    <th className="px-3 py-2">Kolom</th>
                                                    <th className="px-3 py-2">Alasan</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {preview.errors.flatMap((row) =>
                                                    row.detail.map((d, i) => (
                                                        <tr key={`${row.baris}-${i}`} className="border-t border-slate-100">
                                                            <td className="px-3 py-2 tabular-nums">{row.baris}</td>
                                                            <td className="px-3 py-2">{d.kolom}</td>
                                                            <td className="px-3 py-2">{d.alasan}</td>
                                                        </tr>
                                                    )),
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                <div className="flex flex-wrap gap-2">
                                    {batch.status === 'siap' && batch.jumlah_baru > 0 && (
                                        <button
                                            type="button"
                                            className={PRIMARY}
                                            onClick={() => router.post(route('import.confirm', { modul, batch: batch.id }))}
                                        >
                                            Konfirmasi impor {batch.jumlah_baru.toLocaleString('id-ID')} baris
                                        </button>
                                    )}
                                    {batch.jumlah_error > 0 && (
                                        <a href={route('import.errors', { modul, batch: batch.id })} className={SECONDARY}>
                                            Unduh laporan error
                                        </a>
                                    )}
                                </div>
                            </>
                        )}
                    </section>
                )}

                <section className={CARD}>
                    <h2 className="mb-3 text-sm font-semibold text-slate-900">Riwayat impor</h2>
                    {riwayat.length === 0 ? (
                        <p className="text-sm text-slate-500">Belum ada impor.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                    <tr>
                                        <th className="px-3 py-2">Waktu</th>
                                        <th className="px-3 py-2">Berkas</th>
                                        <th className="px-3 py-2">Oleh</th>
                                        <th className="px-3 py-2">Status</th>
                                        <th className="px-3 py-2 text-right">Baru</th>
                                        <th className="px-3 py-2 text-right">Dilewati</th>
                                        <th className="px-3 py-2 text-right">Error</th>
                                        <th className="px-3 py-2 text-right">Masuk</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {riwayat.map((r) => (
                                        <tr key={r.id} className="border-t border-slate-100">
                                            <td className="whitespace-nowrap px-3 py-2">
                                                {new Date(r.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                                            </td>
                                            <td className="px-3 py-2">
                                                <Link href={route('import.show', { modul, batch: r.id })} className="text-blue-700 hover:underline">
                                                    {r.nama_berkas}
                                                </Link>
                                            </td>
                                            <td className="px-3 py-2">{r.pengunggah ?? '—'}</td>
                                            <td className="px-3 py-2">
                                                <StatusBadge status={r.status} />
                                            </td>
                                            <td className="px-3 py-2 text-right tabular-nums">{r.jumlah_baru}</td>
                                            <td className="px-3 py-2 text-right tabular-nums">{r.jumlah_duplikat}</td>
                                            <td className="px-3 py-2 text-right tabular-nums">{r.jumlah_error}</td>
                                            <td className="px-3 py-2 text-right tabular-nums">{r.jumlah_masuk}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>
        </AuthenticatedLayout>
    );
}
