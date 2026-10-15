# Migrasi Untitled UI, Fase 4: Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memigrasikan halaman Dashboard (`Pages/Dashboard.tsx`) ke komponen Untitled UI tanpa mengubah logika, props Inertia, atau backend, memakai komponen bersama yang sudah ada (`StatCard`, `ReportCard`, `ChartLegend`) dan satu komponen CLI baru (`Tabs`) untuk umpan aktivitas.

**Architecture:** Hanya frontend, satu halaman. Grafik Chart.js (`Components/Charts/*`) tidak diubah: warna heksanya sudah sama dengan palet Sapphire/slate yang dipakai di seluruh aplikasi. Warna irisan kondisi diambil dari `KONDISI_COLOR` (`lib/chartColors.ts`) alih-alih ditulis ulang di halaman. Tab "Aktivitas Transaksi Terbaru" memakai `Tabs` (React Aria) bergaya garis bawah; daftar transaksi memakai `Table` di layar ≥ md dan daftar kartu di layar kecil (seperti sebelumnya).

**Tech Stack:** React 19, Inertia 2, Tailwind 4, Untitled UI (React Aria Components), Chart.js (tidak diubah), `@untitledui/icons`.

**Spec:** `docs/superpowers/specs/2026-10-14-migrasi-untitled-ui-design.md` §3.5 butir 5 (Dashboard). Pola acuan: plan Laporan dan Mutasi.

## Global Constraints

- Hanya komponen Untitled UI gratis. Logika tidak berubah: `activeTab`, `tabCounts`, `filteredTransaksi`, `filterUnit` (`router.get` dengan `unit_id`, `preserveState`, `preserveScroll`, `replace`), `candidateActions` (urutan, filter izin `permissions.length === 0 || includes`, `slice(0, 4)`), `queueCandidates`, `percent`, `scopeLabel`, kondisi `isApprover`, props Inertia, nama berkas. `Components/Charts/*` dan `lib/chartColors.ts` tidak diubah.
- `Tabs` diambil dari CLI (`npx untitledui add tabs`, sudah dijalankan dan dirapikan: berkas dipindah ke `resources/js/Components/ui/application/tabs/tabs.tsx`, impor diperbaiki ke `@/Components/ui/...` dan `@/lib/...`, folder `components/` dan `utils/` di akar dihapus). Tanpa perubahan `package.json`.
- `Badge` pada `Tab` disembunyikan di layar < md oleh komponen; jumlah tetap tampil di tab pada layar ≥ md. Nilai `badge` dikirim sebagai string agar `0` tetap tampil.
- Warna: Tinjau/aksi utama `primary` (hanya tombol "Buka Kotak Persetujuan"); pintasan cepat `secondary`; "Detail" di baris `secondary-brand`; badge `type="color" size="sm" className="rounded-sm"`; status transaksi: Berjalan `warning`, Selesai `success`, Ditolak `error`, Dibatalkan `gray`; kartu "Aset Kondisi Baik" badge `success`, "Aset Rusak / Hilang" badge `error`. Amber hanya untuk kotak peringatan persetujuan.
- Kunci kosong tidak valid pada `Select`: filter unit memakai kunci `__all` yang dipetakan ke string kosong.
- Impor `@/Components/...` berhuruf besar; tanpa `@/Components/Icons`; tanpa dependensi baru.
- Verifikasi: `npx tsc --noEmit`, `npm run build`, test backend `--filter='Dashboard'`. Cek runtime singkat diperbolehkan; penilaian visual oleh pengguna di gerbang.
- Git: commit per task di `main`, tanpa trailer Co-Authored-By, stage dengan path eksplisit, tanpa push.

## Review Focus

1. **Tabs**: berpindah tab dengan klik dan keyboard (panah, Enter/Spasi) harus mengganti isi dan hitungan; `Tabs.Panel` memakai `id={activeTab}` agar `aria-controls` valid. Pagar: Task 2; butir gerbang.
2. **Tabel vs daftar kartu**: `Table` hanya di layar ≥ md (`hidden md:block`), daftar kartu di layar kecil (`md:hidden`); keduanya memakai data dan tautan yang sama. Pagar: Task 2; butir gerbang 375 px.
3. **Filter unit** menjaga perilaku lama (kunjungan Inertia, `preserveState`) dan tidak memicu kunjungan ganda saat memilih "Semua unit". Pagar: Task 2.
4. **Izin pintasan dan antrean**: kombinasi tombol/kartu berbeda per peran; tidak boleh ada pintasan yang tampil tanpa izin. Pagar: logika `actions`/`queue` disalin apa adanya (Task 2).
5. **Kartu KPI**: `StatCard` mendapat `badge` opsional (tanpa mengubah tampilan Laporan yang tak memakainya). Pagar: Task 1; butir gerbang memeriksa Laporan tidak berubah.
6. **Grafik** tetap menampilkan tooltip dan label yang sama; legenda donat berubah dari kotak 2 kolom menjadi daftar baris (sama dengan donat di Laporan). Pagar: butir gerbang.

---

## File Structure

| Berkas | Tanggung jawab |
|---|---|
| `resources/js/Components/ui/application/tabs/tabs.tsx` | Komponen CLI `Tabs` (sudah ditambahkan) |
| `resources/js/Components/StatCard.tsx` | Tambah `badge` opsional |
| `resources/js/Pages/Dashboard.tsx` | Halaman Dashboard |

---

### Task 1: `Tabs` dan `StatCard.badge`

**Files:**
- Create: `resources/js/Components/ui/application/tabs/tabs.tsx` (sudah ada di working tree, belum di-commit)
- Modify: `resources/js/Components/StatCard.tsx`, `resources/js/Components/ReportCard.tsx`

- [ ] **Step 1: Tambah `badge` ke `StatCard`**

Ganti isi `StatCard.tsx`:
```tsx
import { ReactNode } from 'react';

export default function StatCard({ label, value, note, badge }: { label: string; value: string; note?: string; badge?: ReactNode }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-2 break-words text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
            {badge && <div className="mt-2">{badge}</div>}
            {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
        </div>
    );
}
```

- [ ] **Step 2: Judul `ReportCard` menjadi heading**

Di `ReportCard.tsx` ganti `<p className="text-lg font-semibold text-slate-900">{title}</p>` dengan `<h2 className="text-lg font-semibold text-slate-900">{title}</h2>` (kelas sama; judul kartu kini heading sehingga struktur halaman terbaca pembaca layar di Dashboard dan Laporan).

- [ ] **Step 3: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
git add resources/js/Components/ui/application/tabs/tabs.tsx resources/js/Components/StatCard.tsx resources/js/Components/ReportCard.tsx
git commit -m "feat(ui): add the Untitled UI tabs component and an optional badge on stat cards"
```
Expected: bersih.

---

### Task 2: `Dashboard` dan gerbang

**Files:**
- Modify: `resources/js/Pages/Dashboard.tsx` (ganti seluruh isi)

- [ ] **Step 1: Tulis ulang `Dashboard.tsx`**

```tsx
import ChartLegend from '@/Components/ChartLegend';
import DonutChart, { DonutSlice } from '@/Components/Charts/DonutChart';
import KategoriAsetChart from '@/Components/Charts/KategoriAsetChart';
import SebaranUnitChart from '@/Components/Charts/SebaranUnitChart';
import TrenAktivitasChart from '@/Components/Charts/TrenAktivitasChart';
import ReportCard from '@/Components/ReportCard';
import StatCard from '@/Components/StatCard';
import { Table } from '@/Components/ui/application/table/table';
import { Tabs } from '@/Components/ui/application/tabs/tabs';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import { Select } from '@/Components/ui/base/select/select';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { KONDISI_COLOR } from '@/lib/chartColors';
import { rupiah, tanggalSingkat } from '@/lib/format';
import { DashboardData, PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowRight, Bell01 } from '@untitledui/icons';
import { useState } from 'react';

interface DashboardProps extends PageProps {
    dashboard: DashboardData;
}

type Transaksi = DashboardData['transaksi'][number];
type TabKey = 'semua' | 'penerimaan' | 'mutasi' | 'rusak_hilang' | 'permohonan';

const ALL = '__all';

const STATUS_BADGE: Record<Transaksi['status'], { label: string; color: 'warning' | 'success' | 'error' | 'gray' }> = {
    berjalan: { label: 'Berjalan', color: 'warning' },
    selesai: { label: 'Selesai', color: 'success' },
    ditolak: { label: 'Ditolak', color: 'error' },
    dibatalkan: { label: 'Dibatalkan', color: 'gray' },
};

const JENIS_LABEL: Record<Transaksi['jenis'], string> = {
    mutasi: 'Mutasi',
    penerimaan: 'Penerimaan',
    rusak_hilang: 'Rusak / Hilang',
    permohonan: 'Permohonan',
};

const percent = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

function StatusBadge({ status }: { status: Transaksi['status'] }) {
    return (
        <Badge type="color" size="sm" color={STATUS_BADGE[status].color} className="rounded-sm">
            {STATUS_BADGE[status].label}
        </Badge>
    );
}

export default function Dashboard({ dashboard: d, auth }: DashboardProps) {
    const [activeTab, setActiveTab] = useState<TabKey>('semua');

    const role = auth.user?.roles?.[0] ?? '';
    const permissions = auth.user?.permissions ?? [];
    const isApprover = permissions.includes('persetujuan.act');
    const total = d.totals.jumlah_aset;
    const baik = d.per_kondisi.baik;
    const bermasalah = d.per_kondisi.rusak_ringan + d.per_kondisi.rusak_berat + d.per_kondisi.hilang;
    const selectedUnit = d.units.find((u) => u.id === d.selected_unit_id);
    const scopeLabel = selectedUnit?.name ?? (d.units.length > 0 ? 'Seluruh cakupan' : (auth.user?.unit?.name ?? 'Seluruh unit'));

    const kondisiSlices: DonutSlice[] = [
        { label: 'Baik', jumlah: d.per_kondisi.baik, persen: percent(d.per_kondisi.baik, total), color: KONDISI_COLOR.baik },
        { label: 'Rusak Ringan', jumlah: d.per_kondisi.rusak_ringan, persen: percent(d.per_kondisi.rusak_ringan, total), color: KONDISI_COLOR.rusak_ringan },
        { label: 'Rusak Berat', jumlah: d.per_kondisi.rusak_berat, persen: percent(d.per_kondisi.rusak_berat, total), color: KONDISI_COLOR.rusak_berat },
        { label: 'Hilang', jumlah: d.per_kondisi.hilang, persen: percent(d.per_kondisi.hilang, total), color: KONDISI_COLOR.hilang },
    ];

    const tabCounts: Record<TabKey, number> = {
        semua: d.transaksi.length,
        penerimaan: d.transaksi.filter((t) => t.jenis === 'penerimaan').length,
        mutasi: d.transaksi.filter((t) => t.jenis === 'mutasi').length,
        rusak_hilang: d.transaksi.filter((t) => t.jenis === 'rusak_hilang').length,
        permohonan: d.transaksi.filter((t) => t.jenis === 'permohonan').length,
    };

    const tabs: { key: TabKey; label: string }[] = [
        { key: 'semua', label: 'Semua' },
        { key: 'penerimaan', label: 'Penerimaan' },
        { key: 'mutasi', label: 'Mutasi' },
        { key: 'rusak_hilang', label: 'Rusak & Hilang' },
        { key: 'permohonan', label: 'Permohonan' },
    ];

    const filteredTransaksi = activeTab === 'semua' ? d.transaksi : d.transaksi.filter((t) => t.jenis === activeTab);
    const transaksiRows = filteredTransaksi.map((t) => ({ ...t, id: `${t.jenis}-${t.nomor}` }));

    const filterUnit = (unitId: string) =>
        router.get(route('dashboard'), unitId ? { unit_id: unitId } : {}, { preserveState: true, preserveScroll: true, replace: true });

    const candidateActions: { label: string; href: string; permission: string }[] = isApprover
        ? [
              { label: 'Kotak Persetujuan', href: route('persetujuan.index'), permission: 'persetujuan.view' },
              { label: 'Scan QR', href: route('scan.index'), permission: 'scan.view' },
              { label: 'Data Aset', href: route('assets.index'), permission: 'aset.view' },
              { label: 'Laporan', href: route('laporan-aset.index'), permission: 'laporan.aset' },
              { label: 'Catat Aset', href: route('assets.create'), permission: 'aset.create' },
          ]
        : [
              { label: 'Catat Aset', href: route('assets.create'), permission: 'aset.create' },
              { label: 'Scan QR', href: route('scan.index'), permission: 'scan.view' },
              { label: 'Buat Permohonan', href: route('asset-requests.create'), permission: 'permohonan.create' },
              { label: 'Lapor Rusak/Hilang', href: route('asset-reports.create'), permission: 'laporan-insiden.create' },
              { label: 'Data Aset', href: route('assets.index'), permission: 'aset.view' },
              { label: 'Laporan', href: route('laporan-aset.index'), permission: 'laporan.aset' },
          ];

    const actions = candidateActions.filter((a) => permissions.length === 0 || permissions.includes(a.permission)).slice(0, 4);

    const queueCandidates: { label: string; value: number; href: string; permission: string }[] = [
        { label: 'Persetujuan menunggu saya', value: d.antrean.persetujuan_menunggu, href: route('persetujuan.index'), permission: 'persetujuan.view' },
        { label: 'Permohonan menunggu pemenuhan', value: d.antrean.permohonan_menunggu_pemenuhan, href: '/asset-requests?menunggu_pemenuhan=1', permission: 'permohonan.view' },
        { label: 'Laporan rusak/hilang pending', value: d.antrean.laporan_pending, href: '/asset-reports?status=pending', permission: 'laporan-insiden.view' },
        { label: 'Mutasi pending', value: d.antrean.mutasi_pending, href: '/asset-mutations', permission: 'mutasi.view' },
    ];

    const queue = queueCandidates.filter((q) => permissions.length === 0 || permissions.includes(q.permission));

    return (
        <AuthenticatedLayout>
            <Head title="Dashboard" />

            <div className="space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="text-[32px] font-bold leading-10 tracking-tight text-slate-900">Dashboard</h1>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                            <span>
                                Selamat datang, {auth.user?.name}. Anda login sebagai <strong>{role}</strong> di
                            </span>
                            <Badge type="color" size="sm" color="blue" className="rounded-sm">
                                {auth.user?.unit?.name ?? 'Kecamatan Sagulung'}
                            </Badge>
                        </p>
                    </div>
                    {d.units.length > 0 && (
                        <div className="w-full sm:w-64">
                            <Select
                                aria-label="Filter unit"
                                size="md"
                                items={[{ id: ALL, label: 'Semua unit' }, ...d.units.map((u) => ({ id: String(u.id), label: u.name }))]}
                                selectedKey={d.selected_unit_id ? String(d.selected_unit_id) : ALL}
                                onSelectionChange={(key) => filterUnit(key === ALL ? '' : String(key))}
                            >
                                {(item) => <Select.Item id={item.id} label={item.label} />}
                            </Select>
                        </div>
                    )}
                </div>

                {isApprover && d.antrean.persetujuan_menunggu > 0 && (
                    <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <div className="flex items-center gap-3">
                            <Bell01 className="size-5 shrink-0 text-amber-700" aria-hidden="true" />
                            <p className="text-sm font-medium text-amber-900">
                                <span className="tabular-nums">{d.antrean.persetujuan_menunggu}</span> persetujuan menunggu Anda.
                            </p>
                        </div>
                        <Button color="primary" size="md" href={route('persetujuan.index')}>
                            Buka Kotak Persetujuan
                        </Button>
                    </div>
                )}

                {actions.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        {actions.map((a) => (
                            <Button key={a.label} className="w-full" color="secondary" size="lg" href={a.href}>
                                {a.label}
                            </Button>
                        ))}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard label="Total Aset" value={total.toLocaleString('id-ID')} note={scopeLabel} />
                    <StatCard label="Total Nilai Aset" value={rupiah(d.totals.nilai_perolehan)} note={`Nilai buku ${rupiah(d.totals.nilai_buku)}`} />
                    <StatCard
                        label="Aset Kondisi Baik"
                        value={baik.toLocaleString('id-ID')}
                        badge={
                            <Badge type="color" size="sm" color="success" className="rounded-sm">
                                {percent(baik, total)}% dari total
                            </Badge>
                        }
                    />
                    <StatCard
                        label="Aset Rusak / Hilang"
                        value={bermasalah.toLocaleString('id-ID')}
                        badge={
                            <Badge type="color" size="sm" color="error" className="rounded-sm">
                                {percent(bermasalah, total)}% dari total
                            </Badge>
                        }
                    />
                </div>

                {queue.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {queue.map((q) => (
                            <Link
                                key={q.label}
                                href={q.href}
                                className="block rounded-xl border border-slate-200 bg-white p-5 shadow-xs outline-hidden transition hover:border-blue-300 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
                            >
                                <p className="text-3xl font-bold tabular-nums text-slate-900">{q.value}</p>
                                <p className="mt-1 text-sm text-slate-600">{q.label}</p>
                            </Link>
                        ))}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <ReportCard title="Proporsi Kondisi Aset" aside={<span className="text-xs tabular-nums text-slate-500">{total} total aset</span>}>
                        <DonutChart data={kondisiSlices} ariaLabel="Grafik proporsi kondisi fisik aset" unit="aset" />
                        <ChartLegend unit="aset" items={kondisiSlices} />
                    </ReportCard>

                    <ReportCard
                        title="Aset per Kategori"
                        aside={
                            <Button color="link-color" size="sm" iconTrailing={ArrowRight} href={route('assets.index')}>
                                Lihat Semua
                            </Button>
                        }
                    >
                        <KategoriAsetChart data={d.per_kategori} />
                    </ReportCard>

                    <ReportCard title="Sebaran Aset per Unit" aside={<span className="text-xs text-slate-500">Kondisi fisik</span>}>
                        <SebaranUnitChart data={d.per_unit} />
                    </ReportCard>

                    <ReportCard title="Tren Aktivitas (6 Bulan Terakhir)" aside={<span className="text-xs text-slate-500">Volume transaksi</span>}>
                        <TrenAktivitasChart data={d.tren_aktivitas} />
                    </ReportCard>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    <h2 className="px-5 pt-4 text-lg font-semibold text-slate-900">Aktivitas Transaksi Terbaru</h2>

                    <Tabs selectedKey={activeTab} onSelectionChange={(key) => setActiveTab(key as TabKey)} keyboardActivation="automatic">
                        <Tabs.List type="underline" size="sm" className="mt-3 px-5" aria-label="Jenis transaksi">
                            {tabs.map((tab) => (
                                <Tabs.Item key={tab.key} id={tab.key} label={tab.label} badge={String(tabCounts[tab.key])} />
                            ))}
                        </Tabs.List>

                        <Tabs.Panel id={activeTab}>
                            {transaksiRows.length === 0 ? (
                                <p className="px-5 py-10 text-center text-sm text-slate-400">
                                    {activeTab === 'semua'
                                        ? 'Belum ada transaksi.'
                                        : `Belum ada transaksi ${tabs.find((t) => t.key === activeTab)?.label ?? ''} terbaru.`}
                                </p>
                            ) : (
                                <>
                                    <div className="hidden md:block">
                                        <Table aria-label="Aktivitas transaksi terbaru" size="sm">
                                            <Table.Header>
                                                <Table.Head id="jenis" label="Jenis" />
                                                <Table.Head id="nomor" label="Nomor" isRowHeader />
                                                <Table.Head id="ringkasan" label="Ringkasan" />
                                                <Table.Head id="tanggal" label="Tanggal" />
                                                <Table.Head id="status" label="Status" />
                                                <Table.Head id="aksi" label="Aksi" />
                                            </Table.Header>
                                            <Table.Body items={transaksiRows}>
                                                {(t) => (
                                                    <Table.Row id={t.id}>
                                                        <Table.Cell>
                                                            <Badge type="color" size="sm" color="gray" className="rounded-sm">
                                                                {JENIS_LABEL[t.jenis]}
                                                            </Badge>
                                                        </Table.Cell>
                                                        <Table.Cell className="whitespace-nowrap font-medium tabular-nums">
                                                            <Link href={t.url} className="text-blue-700 hover:underline">
                                                                {t.nomor}
                                                            </Link>
                                                        </Table.Cell>
                                                        <Table.Cell className="text-slate-700">{t.ringkasan ?? '—'}</Table.Cell>
                                                        <Table.Cell className="whitespace-nowrap tabular-nums text-slate-500">{tanggalSingkat(t.tanggal)}</Table.Cell>
                                                        <Table.Cell>
                                                            <StatusBadge status={t.status} />
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            <Button color="secondary-brand" size="sm" href={t.url}>
                                                                Detail
                                                            </Button>
                                                        </Table.Cell>
                                                    </Table.Row>
                                                )}
                                            </Table.Body>
                                        </Table>
                                    </div>

                                    <ul className="divide-y divide-slate-100 md:hidden">
                                        {transaksiRows.map((t) => (
                                            <li key={t.id} className="space-y-1.5 px-5 py-3 text-sm">
                                                <div className="flex items-center justify-between gap-2">
                                                    <Badge type="color" size="sm" color="gray" className="rounded-sm">
                                                        {JENIS_LABEL[t.jenis]}
                                                    </Badge>
                                                    <StatusBadge status={t.status} />
                                                </div>
                                                <Link href={t.url} className="block font-semibold tabular-nums text-blue-700">
                                                    {t.nomor}
                                                </Link>
                                                <p className="text-slate-600">{t.ringkasan ?? '—'}</p>
                                                <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
                                                    <span className="tabular-nums">{tanggalSingkat(t.tanggal)}</span>
                                                    <Link href={t.url} className="font-semibold text-blue-700 hover:underline">
                                                        Lihat Detail &rarr;
                                                    </Link>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </Tabs.Panel>
                    </Tabs>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
```
Penyesuaian tipe kecil (mis. `DonutSlice` memenuhi tipe `items` `ChartLegend`, prop `Tabs.List`) dicatat sebagai `Ruling`.

- [ ] **Step 2: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -5
grep -n "@/Components/Icons" resources/js/Pages/Dashboard.tsx
php artisan test --compact --filter='Dashboard'
git add resources/js/Pages/Dashboard.tsx
git commit -m "feat(ui): migrate the dashboard page to Untitled UI components"
```
Expected: bersih; `grep` kosong; test hijau.

- [ ] **Step 3: Cek runtime singkat dan GERBANG DASHBOARD — berhenti**

Cek di browser headless dengan beberapa akun (super-admin, camat atau kasubag, admin kelurahan): dashboard memuat tanpa error; empat kartu KPI, kartu antrean sesuai izin, empat grafik (canvas), tab (klik "Mutasi" mengganti isi dan menandai tab terpilih), filter unit (bila ada) tanpa error.

Laporkan hasil dan hal yang tak bisa diverifikasi. Minta pengguna memeriksa:
- **Header**: judul, sapaan + badge unit, filter unit (hanya untuk yang berhak) dan berfungsi.
- **Kotak peringatan persetujuan** (hanya approver dengan antrean) dan tombol "Buka Kotak Persetujuan".
- **Pintasan cepat** sesuai peran dan izin (maksimal 4).
- **Kartu KPI** (badge hijau/merah), **kartu antrean** (angka, tautan menuju daftar terfilter), **empat grafik** (donat + legenda baris, bar kategori, sebaran unit, tren aktivitas) dan tooltipnya.
- **Tab Aktivitas Transaksi Terbaru**: klik dan keyboard (panah kiri/kanan), hitungan per tab, tabel di layar lebar, daftar kartu di layar 375 px, tautan nomor dan tombol Detail.
- Halaman **Laporan** tidak berubah dengan perubahan `StatCard`.
- Cincin fokus.
**Jangan memulai modul berikutnya** sebelum pengguna menyatakan lolos.

---

## Catatan Review (ponytail + impeccable, sudah diterapkan)

- Ponytail: satu halaman, memakai komponen bersama yang sudah ada; tidak ada abstraksi baru. Daftar kartu untuk layar kecil dipertahankan walau tabel ada (perilaku asli; tabel yang menggulir ke samping lebih buruk dipakai di ponsel).
- Impeccable (Operate): judul kartu grafik dijadikan `h2` (sebelumnya `p` di komponen bersama; di Dashboard aslinya memang `h2`), sehingga struktur heading tidak mundur; hitungan tab disembunyikan di layar kecil oleh komponen (tab tetap terbaca); legenda donat diseragamkan dengan Laporan. Font tick Chart.js tidak diubah (masih bawaan Chart.js, bukan Figtree) — dicatat sebagai tindak lanjut opsional di luar migrasi.
