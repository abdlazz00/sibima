import PageHeader from '@/Components/PageHeader';
import { Table } from '@/Components/ui/application/table/table';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { Label } from '@/Components/ui/base/input/label';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { Download01, UploadCloud02 } from '@untitledui/icons';
import { FileTrigger } from 'react-aria-components';
import { FormEvent, useEffect, useState } from 'react';

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

type StatusColor = 'warning' | 'blue' | 'success' | 'error' | 'gray';

const STATUS: Record<string, { label: string; color: StatusColor }> = {
    memeriksa: { label: 'Memeriksa', color: 'warning' },
    siap: { label: 'Siap dikonfirmasi', color: 'blue' },
    memproses: { label: 'Memproses', color: 'warning' },
    selesai: { label: 'Selesai', color: 'success' },
    gagal: { label: 'Gagal', color: 'error' },
    kedaluwarsa: { label: 'Kedaluwarsa', color: 'gray' },
};

function StatusBadge({ status }: { status: string }) {
    const s = STATUS[status] ?? { label: status, color: 'gray' as const };

    return (
        <Badge type="color" size="sm" color={s.color} className="rounded-sm">
            {s.label}
        </Badge>
    );
}

const download = (url: string) => {
    window.location.href = url;
};

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
    const [confirming, setConfirming] = useState(false);
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

    const errorRows = preview.errors.flatMap((row) => row.detail.map((d, i) => ({ id: `${row.baris}-${i}`, baris: row.baris, kolom: d.kolom, alasan: d.alasan })));

    return (
        <AuthenticatedLayout>
            <Head title={`Impor ${label}`} />

            <div className="space-y-6">
                <div className="space-y-1">
                    <PageHeader crumbs={[{ label: `Impor ${label}` }]} title={`Impor ${label}`} />
                    <p className="text-sm text-slate-500">Unggah berkas Excel, periksa pratinjau, lalu konfirmasi. Baris yang sudah ada dilewati.</p>
                </div>

                <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                    <Label>Berkas Excel (.xlsx)</Label>
                    <div className="flex flex-wrap items-center gap-3">
                        <FileTrigger acceptedFileTypes={['.xlsx']} onSelect={(files) => form.setData('berkas', files?.[0] ?? null)}>
                            <Button color="secondary" size="md" iconLeading={UploadCloud02}>
                                Pilih berkas
                            </Button>
                        </FileTrigger>
                        <span className="text-sm text-slate-600">{form.data.berkas ? form.data.berkas.name : 'Belum ada berkas dipilih'}</span>
                    </div>
                    {form.errors.berkas && <p className="text-sm text-red-700">{form.errors.berkas}</p>}
                    <p className="text-xs text-slate-500">
                        Maksimal {maxKb / 1024} MB dan {maxRows.toLocaleString('id-ID')} baris per berkas.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <Button type="submit" color="primary" size="md" isDisabled={!form.data.berkas} isLoading={form.processing}>
                            Unggah &amp; periksa
                        </Button>
                        <Button color="secondary-brand" size="md" iconLeading={Download01} onPress={() => download(route('import.template', modul))}>
                            Unduh template
                        </Button>
                    </div>
                </form>

                {batch && (
                    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs" aria-live="polite">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <p className="text-sm font-semibold text-slate-900">{batch.nama_berkas}</p>
                                <p className="text-xs text-slate-500">{batch.total_baris.toLocaleString('id-ID')} baris</p>
                            </div>
                            <StatusBadge status={batch.status} />
                        </div>

                        {active && (
                            <div>
                                <div
                                    role="progressbar"
                                    aria-label="Progres impor"
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={percent}
                                    className="h-2 overflow-hidden rounded-sm bg-slate-100"
                                >
                                    <div className="h-2 bg-blue-800 transition-all" style={{ width: `${percent}%` }} />
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
                                    <p key={text} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                                        {n.toLocaleString('id-ID')} baris — {text}
                                    </p>
                                ))}

                                {errorRows.length > 0 && (
                                    <div className="overflow-hidden rounded-xl border border-slate-200">
                                        <p className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
                                            Baris bermasalah (menampilkan {preview.errors.length} pertama)
                                        </p>
                                        <Table aria-label="Baris bermasalah pada berkas" size="sm">
                                            <Table.Header>
                                                <Table.Head id="baris" label="Baris" isRowHeader />
                                                <Table.Head id="kolom" label="Kolom" />
                                                <Table.Head id="alasan" label="Alasan" />
                                            </Table.Header>
                                            <Table.Body items={errorRows}>
                                                {(r) => (
                                                    <Table.Row id={r.id}>
                                                        <Table.Cell className="tabular-nums text-slate-800">{r.baris}</Table.Cell>
                                                        <Table.Cell className="text-slate-800">{r.kolom}</Table.Cell>
                                                        <Table.Cell className="whitespace-normal text-slate-800">{r.alasan}</Table.Cell>
                                                    </Table.Row>
                                                )}
                                            </Table.Body>
                                        </Table>
                                    </div>
                                )}

                                <div className="flex flex-wrap gap-2">
                                    {batch.status === 'siap' && batch.jumlah_baru > 0 && (
                                        <Button
                                            color="primary"
                                            size="md"
                                            isLoading={confirming}
                                            onPress={() => {
                                                setConfirming(true);
                                                router.post(route('import.confirm', { modul, batch: batch.id }), {}, { onFinish: () => setConfirming(false) });
                                            }}
                                        >
                                            Konfirmasi impor {batch.jumlah_baru.toLocaleString('id-ID')} baris
                                        </Button>
                                    )}
                                    {batch.jumlah_error > 0 && (
                                        <Button
                                            color="secondary-brand"
                                            size="md"
                                            iconLeading={Download01}
                                            onPress={() => download(route('import.errors', { modul, batch: batch.id }))}
                                        >
                                            Unduh laporan error
                                        </Button>
                                    )}
                                </div>
                            </>
                        )}
                    </section>
                )}

                <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    <h2 className="border-b border-slate-200 px-5 py-4 text-base font-semibold text-slate-900">Riwayat impor</h2>
                    <Table aria-label="Riwayat impor" size="sm">
                        <Table.Header>
                            <Table.Head id="waktu" label="Waktu" isRowHeader />
                            <Table.Head id="berkas" label="Berkas" />
                            <Table.Head id="oleh" label="Oleh" />
                            <Table.Head id="status" label="Status" />
                            <Table.Head id="baru" label="Baru" className="[&>div]:justify-end" />
                            <Table.Head id="dilewati" label="Dilewati" className="[&>div]:justify-end" />
                            <Table.Head id="error" label="Error" className="[&>div]:justify-end" />
                            <Table.Head id="masuk" label="Masuk" className="[&>div]:justify-end" />
                        </Table.Header>
                        <Table.Body items={riwayat} renderEmptyState={() => <p className="py-8 text-center text-sm text-slate-500">Belum ada impor.</p>}>
                            {(r) => (
                                <Table.Row id={r.id}>
                                    <Table.Cell className="whitespace-nowrap text-slate-800">
                                        {new Date(r.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Link href={route('import.show', { modul, batch: r.id })} className="text-blue-700 hover:underline">
                                            {r.nama_berkas}
                                        </Link>
                                    </Table.Cell>
                                    <Table.Cell className="text-slate-800">{r.pengunggah ?? '—'}</Table.Cell>
                                    <Table.Cell>
                                        <StatusBadge status={r.status} />
                                    </Table.Cell>
                                    <Table.Cell className="text-right tabular-nums text-slate-800">{r.jumlah_baru}</Table.Cell>
                                    <Table.Cell className="text-right tabular-nums text-slate-800">{r.jumlah_duplikat}</Table.Cell>
                                    <Table.Cell className="text-right tabular-nums text-slate-800">{r.jumlah_error}</Table.Cell>
                                    <Table.Cell className="text-right tabular-nums text-slate-800">{r.jumlah_masuk}</Table.Cell>
                                </Table.Row>
                            )}
                        </Table.Body>
                    </Table>
                </section>
            </div>
        </AuthenticatedLayout>
    );
}
