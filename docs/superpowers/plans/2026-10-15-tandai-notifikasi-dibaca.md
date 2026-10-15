# Tandai Notifikasi Telah Dibaca Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (eksekusi native, satu sesi). Steps use checkbox (`- [ ]`) syntax. Satu Task = satu tahap; **berhenti di akhir Task dan tunggu pengguna menyatakan lolos**.

**Goal:** Pengguna bisa menandai notifikasi dibaca/belum dibaca (satu per satu atau semua) dari dropdown lonceng dan dari halaman riwayat `/notifikasi`.

**Architecture:** Tiga method baru di `NotificationController` (index, markAll, mark) memakai relasi `notifications()` milik pengguna; halaman Inertia baru `Notifikasi/Index`; dropdown di `AuthenticatedLayout` mendapat tombol tandai.

**Tech Stack:** Laravel 13 (notifikasi database), Pest, Inertia 2, React 19, Untitled UI.

**Spec:** `docs/superpowers/specs/2026-10-15-tandai-notifikasi-dibaca-design.md`

## Global Constraints

- Semua query lewat `$request->user()->notifications()` / `unreadNotifications()` (pemilik data); ID asing → 404.
- Rute `notifications.read` (tandai + buka dokumen) dibiarkan.
- Warna tombol: "Tandai dibaca" / "Tandai semua dibaca" `primary-green`, "Buka" `primary-sky`, "Tandai belum dibaca" `secondary`.
- Pagination: `PaginationCardMinimal` + `PerPage::resolve`.
- Pint hanya pada berkas PHP yang diubah (path eksplisit; jangan `routes/web.php`). Jangan jalankan Prettier pada berkas halaman lama.
- Commit tanpa Co-Authored-By/atribusi Claude, path eksplisit, di `main`, tanpa push.

## Review Focus

- Notifikasi pengguna lain tak bisa dilihat/ditandai; "tandai semua" tidak menyentuh milik orang lain.
- Notifikasi tanpa `url` tidak galat dan tanpa tombol Buka.
- Menandai di dropdown tidak berpindah halaman dan hitungan lonceng berkurang.
- Item terakhir di halaman filter "Belum dibaca" ditandai → halaman tidak membingungkan (tampilan kosong jelas atau kembali ke halaman 1).
- 375 px tanpa meluber.

---

### Task 1 (Backend, dropdown, dan halaman Notifikasi)

**Files:**
- Create: `tests/Feature/NotificationInboxTest.php`, `resources/js/Pages/Notifikasi/Index.tsx`
- Modify: `app/Http/Controllers/NotificationController.php`, `routes/web.php`, `resources/js/Layouts/AuthenticatedLayout.tsx`, `resources/js/types/index.d.ts`

**Interfaces:**
- Consumes: `PerPage::resolve`, `PaginationCardMinimal`/`PAGE_SIZES`, `PageHeader`, `Tabs`, `tanggalWaktu` (`lib/format`).
- Produces: rute `notifications.index` (`GET /notifikasi`), `notifications.read-all` (`POST /notifications/read-all`), `notifications.mark` (`POST /notifications/{notification}/mark`, isian `dibaca`); tipe `NotificationRow`.

- [ ] **Step 1: Tulis tes yang gagal**

`tests/Feature/NotificationInboxTest.php`:
```php
<?php

use App\Models\User;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

function makeNotification(User $user, string $message, bool $read = false, ?string $url = '/persetujuan'): DatabaseNotification
{
    return DatabaseNotification::create([
        'id' => (string) Str::uuid(),
        'type' => 'App\\Notifications\\ApprovalStepNotification',
        'notifiable_type' => User::class,
        'notifiable_id' => $user->id,
        'data' => ['message' => $message, 'url' => $url],
        'read_at' => $read ? now() : null,
    ]);
}

test('the inbox lists only the own notifications and can filter unread ones', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    makeNotification($user, 'Belum dibaca A');
    makeNotification($user, 'Sudah dibaca B', true);
    makeNotification($other, 'Milik orang lain');

    $this->actingAs($user)->get('/notifikasi')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('Notifikasi/Index')
        ->has('items.data', 2)
        ->where('filters.filter', 'semua')
        ->where('filters.per_page', 15));

    $this->actingAs($user)->get('/notifikasi?filter=belum')->assertInertia(fn (Assert $page) => $page
        ->has('items.data', 1)
        ->where('items.data.0.message', 'Belum dibaca A')
        ->where('items.data.0.dibaca', false));
});

test('the inbox paginates with a whitelisted page size', function () {
    $user = User::factory()->create();
    foreach (range(1, 12) as $i) {
        makeNotification($user, "Pesan {$i}");
    }

    $this->actingAs($user)->get('/notifikasi?per_page=10')->assertInertia(fn (Assert $page) => $page
        ->has('items.data', 10)
        ->where('items.total', 12)
        ->where('filters.per_page', 10));
});

test('a notification can be marked read and unread without being redirected to the document', function () {
    $user = User::factory()->create();
    $n = makeNotification($user, 'Pesan');

    $this->actingAs($user)->from('/notifikasi')->post("/notifications/{$n->id}/mark", ['dibaca' => true])->assertRedirect('/notifikasi');
    expect($n->fresh()->read_at)->not->toBeNull();

    $this->actingAs($user)->post("/notifications/{$n->id}/mark", ['dibaca' => false])->assertSessionHasNoErrors();
    expect($n->fresh()->read_at)->toBeNull();
});

test('marking requires the read flag and cannot touch notifications of another user', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $mine = makeNotification($user, 'Milik saya');
    $theirs = makeNotification($other, 'Milik orang lain');

    $this->actingAs($user)->post("/notifications/{$mine->id}/mark", [])->assertSessionHasErrors('dibaca');
    $this->actingAs($user)->post("/notifications/{$theirs->id}/mark", ['dibaca' => true])->assertNotFound();

    expect($theirs->fresh()->read_at)->toBeNull();
});

test('mark all read affects only the own unread notifications', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $a = makeNotification($user, 'A');
    $b = makeNotification($user, 'B');
    $theirs = makeNotification($other, 'Milik orang lain');

    $this->actingAs($user)->post('/notifications/read-all')->assertSessionHas('success');

    expect($a->fresh()->read_at)->not->toBeNull()
        ->and($b->fresh()->read_at)->not->toBeNull()
        ->and($theirs->fresh()->read_at)->toBeNull();
});

test('a notification without a document link is listed with a null url', function () {
    $user = User::factory()->create();
    makeNotification($user, 'Tanpa tautan', false, null);

    $this->actingAs($user)->get('/notifikasi')->assertInertia(fn (Assert $page) => $page->where('items.data.0.url', null));
});
```

- [ ] **Step 2: Jalankan, pastikan gagal** — `php artisan test --compact tests/Feature/NotificationInboxTest.php` → FAIL (rute belum ada).

- [ ] **Step 3: Controller dan rute**

Ganti isi `NotificationController` (pertahankan `markRead` apa adanya) menjadi:
```php
<?php

namespace App\Http\Controllers;

use App\Support\PerPage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;
use Inertia\Inertia;
use Inertia\Response;

class NotificationController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $filter = $request->query('filter') === 'belum' ? 'belum' : 'semua';
        $perPage = PerPage::resolve($request);

        $query = $filter === 'belum' ? $user->unreadNotifications() : $user->notifications();

        return Inertia::render('Notifikasi/Index', [
            'items' => $query->latest()->paginate($perPage)->withQueryString()->through(fn (DatabaseNotification $n) => [
                'id' => $n->id,
                'message' => $n->data['message'] ?? '',
                'url' => $n->data['url'] ?? null,
                'dibaca' => $n->read_at !== null,
                'waktu' => $n->created_at->toIso8601String(),
                'relatif' => $n->created_at->diffForHumans(),
            ]),
            'filters' => ['filter' => $filter, 'per_page' => $perPage],
        ]);
    }

    public function markRead(Request $request, string $notification): RedirectResponse
    {
        $found = $request->user()->unreadNotifications()->where('id', $notification)->first();
        $found?->markAsRead();

        $url = $found?->data['url'] ?? null;

        return $url ? redirect($url) : back();
    }

    public function mark(Request $request, string $notification): RedirectResponse
    {
        $data = $request->validate(['dibaca' => ['required', 'boolean']]);

        $found = $request->user()->notifications()->where('id', $notification)->firstOrFail();
        $data['dibaca'] ? $found->markAsRead() : $found->markAsUnread();

        return back();
    }

    public function markAll(Request $request): RedirectResponse
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return back()->with('success', 'Semua notifikasi ditandai sudah dibaca.');
    }
}
```
Di `routes/web.php`, tepat di bawah baris `notifications.read`, tambahkan (tanpa menjalankan Pint pada berkas ini):
```php
    Route::get('/notifikasi', [NotificationController::class, 'index'])->name('notifications.index');
    Route::post('/notifications/read-all', [NotificationController::class, 'markAll'])->name('notifications.read-all');
    Route::post('/notifications/{notification}/mark', [NotificationController::class, 'mark'])->name('notifications.mark');
```

- [ ] **Step 4: Jalankan tes sampai hijau**

```bash
vendor/bin/pint --format agent app/Http/Controllers/NotificationController.php tests/Feature/NotificationInboxTest.php
php artisan test --compact tests/Feature/NotificationInboxTest.php tests/Feature/NotificationSharedPropTest.php
```
Expected: PASS. Commit:
```bash
git add app/Http/Controllers/NotificationController.php routes/web.php tests/Feature/NotificationInboxTest.php
git commit -m "feat(notifications): add an inbox page, mark all read, and mark read or unread endpoints"
```

- [ ] **Step 5: Tipe dan halaman Notifikasi**

Tambahkan di `types/index.d.ts` (dekat `NotificationItem`):
```ts
export interface NotificationRow {
    id: string;
    message: string;
    url: string | null;
    dibaca: boolean;
    waktu: string;
    relatif: string;
}
```
`resources/js/Pages/Notifikasi/Index.tsx`:
```tsx
import PageHeader from '@/Components/PageHeader';
import { Tabs } from '@/Components/ui/application/tabs/tabs';
import { PAGE_SIZES, PaginationCardMinimal } from '@/Components/ui/application/pagination/pagination';
import { Badge } from '@/Components/ui/base/badges/badges';
import { Button } from '@/Components/ui/base/buttons/button';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { tanggalWaktu } from '@/lib/format';
import { NotificationRow, PageProps, Paginated } from '@/types';
import { Head, router } from '@inertiajs/react';
import { CheckCircle } from '@untitledui/icons';

interface IndexProps extends PageProps {
    items: Paginated<NotificationRow>;
    filters: { filter: 'semua' | 'belum'; per_page: number };
}

const FILTERS = [
    { key: 'semua', label: 'Semua' },
    { key: 'belum', label: 'Belum dibaca' },
] as const;

export default function Index({ items, filters, notifications }: IndexProps) {
    const visit = (changes: Record<string, string | number | undefined>) =>
        router.get(route('notifications.index'), { ...filters, ...changes }, { preserveState: true, preserveScroll: true, replace: true });

    const mark = (id: string, dibaca: boolean) =>
        router.post(route('notifications.mark', id), { dibaca }, { preserveScroll: true, preserveState: true });

    return (
        <AuthenticatedLayout>
            <Head title="Notifikasi" />

            <div className="space-y-6">
                <PageHeader
                    crumbs={[{ label: 'Notifikasi' }]}
                    title="Notifikasi"
                    actions={
                        notifications.unread_count > 0 && (
                            <Button
                                color="primary-green"
                                size="md"
                                iconLeading={CheckCircle}
                                onPress={() => router.post(route('notifications.read-all'), {}, { preserveScroll: true })}
                            >
                                Tandai semua dibaca
                            </Button>
                        )
                    }
                />

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                    <div className="border-b border-slate-200 px-5 pt-4">
                        <Tabs selectedKey={filters.filter} onSelectionChange={(key) => visit({ filter: String(key), page: undefined })} keyboardActivation="automatic">
                            <Tabs.List type="underline" size="md" aria-label="Saring notifikasi">
                                {FILTERS.map((f) => (
                                    <Tabs.Item key={f.key} id={f.key} label={f.label} />
                                ))}
                            </Tabs.List>
                        </Tabs>
                    </div>

                    {items.data.length === 0 ? (
                        <p className="py-14 text-center text-sm text-slate-400">
                            {filters.filter === 'belum' ? 'Tidak ada notifikasi yang belum dibaca.' : 'Belum ada notifikasi.'}
                        </p>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {items.data.map((n) => (
                                <li key={n.id} className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${n.dibaca ? 'bg-white' : 'bg-blue-50/40'}`}>
                                    <div className="flex min-w-0 items-start gap-3">
                                        <span
                                            className={`mt-1.5 size-2.5 shrink-0 rounded-full ${n.dibaca ? 'bg-transparent' : 'bg-blue-600'}`}
                                            aria-label={n.dibaca ? undefined : 'Belum dibaca'}
                                        />
                                        <div className="min-w-0">
                                            <p className={`text-base ${n.dibaca ? 'text-slate-600' : 'font-semibold text-slate-900'}`}>
                                                {!n.dibaca && (
                                                    <Badge type="color" size="sm" color="blue" className="mr-2 rounded-sm align-middle">
                                                        Baru
                                                    </Badge>
                                                )}
                                                {n.message}
                                            </p>
                                            <p className="mt-0.5 text-sm text-slate-500">
                                                {n.relatif} · {tanggalWaktu(n.waktu)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 flex-wrap gap-2">
                                        {n.url && (
                                            <Button
                                                color="primary-sky"
                                                size="sm"
                                                aria-label={`Buka: ${n.message}`}
                                                onPress={() => router.post(route('notifications.read', n.id))}
                                            >
                                                Buka
                                            </Button>
                                        )}
                                        {n.dibaca ? (
                                            <Button color="secondary" size="sm" aria-label={`Tandai belum dibaca: ${n.message}`} onPress={() => mark(n.id, false)}>
                                                Tandai belum dibaca
                                            </Button>
                                        ) : (
                                            <Button color="primary-green" size="sm" aria-label={`Tandai dibaca: ${n.message}`} onPress={() => mark(n.id, true)}>
                                                Tandai dibaca
                                            </Button>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}

                    {items.total > 0 && (
                        <PaginationCardMinimal
                            page={items.current_page}
                            total={items.last_page}
                            pageSize={items.per_page}
                            pageSizes={PAGE_SIZES}
                            totalItems={items.total}
                            itemLabel="notifikasi"
                            onPageChange={(page) => visit({ page })}
                            onPageSizeChange={(per_page) => visit({ per_page, page: undefined })}
                        />
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
```
Catatan: tombol "Buka" memakai rute lama `notifications.read` (menandai dibaca lalu mengalihkan ke dokumen). Jika setelah menandai item terakhir pada filter "Belum dibaca" halaman menjadi kosong (`current_page > last_page`), tampilan kosong jelas ("Tidak ada notifikasi yang belum dibaca.") sudah memadai; paginator Laravel mengembalikan halaman kosong tanpa galat.

- [ ] **Step 6: Dropdown lonceng** (`Layouts/AuthenticatedLayout.tsx`)

Tambahkan `CheckCircle` ke impor `@untitledui/icons`, dan `Link` ke impor `@inertiajs/react` bila belum ada. Di dalam `<Dialog aria-label="Notifikasi" ...>` ganti seluruh isi fungsi `{({ close }) => ( <> ... </> )}` dengan:
```tsx
                                    {({ close }) => (
                                        <>
                                            <div className="mb-2 flex items-center justify-between gap-2 border-b border-gray-100 pb-2">
                                                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900">Notifikasi</h3>
                                                {unread > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => router.post(route('notifications.read-all'), {}, { preserveScroll: true })}
                                                        className="inline-flex min-h-9 items-center gap-1 rounded-sm px-1.5 text-sm font-semibold text-emerald-700 outline-hidden hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-blue-600"
                                                    >
                                                        <CheckCircle className="size-4" aria-hidden="true" />
                                                        Tandai semua dibaca
                                                    </button>
                                                )}
                                            </div>
                                            <div className="space-y-1 text-sm text-gray-600">
                                                {notifications.items.length === 0 ? (
                                                    <p className="p-2 text-center text-gray-400">Tidak ada notifikasi baru.</p>
                                                ) : (
                                                    notifications.items.map((item) => (
                                                        <div key={item.id} className="rounded-sm p-1 hover:bg-gray-50">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    close();
                                                                    router.post(route('notifications.read', item.id));
                                                                }}
                                                                className="block w-full rounded-sm p-2 text-left outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600"
                                                            >
                                                                <p className="font-medium text-gray-800">{item.message}</p>
                                                                <p className="mt-0.5 text-xs text-gray-500">{item.created_at}</p>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                aria-label={`Tandai dibaca: ${item.message}`}
                                                                onClick={() => router.post(route('notifications.mark', item.id), { dibaca: true }, { preserveScroll: true, preserveState: true })}
                                                                className="ml-2 inline-flex min-h-9 items-center gap-1.5 rounded-sm px-2 text-sm font-semibold text-emerald-700 outline-hidden hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-blue-600"
                                                            >
                                                                <CheckCircle className="size-4" aria-hidden="true" />
                                                                Tandai dibaca
                                                            </button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                            <div className="mt-2 border-t border-gray-100 pt-2 text-center">
                                                <Link
                                                    href={route('notifications.index')}
                                                    onClick={() => close()}
                                                    className="text-sm font-semibold text-blue-700 hover:underline focus-visible:ring-2 focus-visible:ring-blue-600"
                                                >
                                                    Lihat semua notifikasi
                                                </Link>
                                            </div>
                                        </>
                                    )}
```
Ubah lebar popover dari `w-72` menjadi `w-80 max-w-[calc(100vw-2rem)]`.

- [ ] **Step 7: Verifikasi dan commit**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -3
git add resources/js/Pages/Notifikasi resources/js/Layouts/AuthenticatedLayout.tsx resources/js/types/index.d.ts
git commit -m "feat(notifications): mark-as-read controls in the bell dropdown and a notifications page"
```
Cek runtime headless (Playwright; pindahkan `public/hot` ke `public/hot.bak` agar memakai build, lalu kembalikan; login lewat tombol Enter): pastikan ada notifikasi demo belum dibaca (bila tidak ada, buat dengan menyerahkan suatu pengajuan lewat alur biasa di data demo atau memakai `php artisan tinker` hanya untuk menambah baris notifikasi uji milik akun demo, lalu hapus barisnya sesudahnya); dropdown menampilkan tombol centang dan "Tandai semua dibaca"; menandai satu item mengurangi hitungan lonceng tanpa pindah halaman; `/notifikasi` menampilkan daftar, filter, tombol, dan pagination; tanpa galat konsol dan tanpa scroll horizontal di 375 px.

- [ ] **Step 8: Suite terkait dan GERBANG — berhenti**

```bash
php artisan test --compact --filter='Notification|Inertia|Approval'
```
Lalu laporkan dan minta pengguna menilai: tombol di dropdown (tandai satu, tandai semua, lihat semua), halaman Notifikasi (susunan, titik biru/tebal untuk belum dibaca, tombol Buka/Tandai, filter, pagination), 375 px, keyboard/fokus. Setelah lolos: jalankan suite penuh di latar belakang, perbarui memori proyek, dan tanyakan persetujuan sebelum push.

---

## Catatan Self-Review

- Cakupan spec: tiga endpoint + rute, tes pemilik data/404/validasi/filter/pagination/tanpa url (Step 1–4), dropdown (Step 6), halaman (Step 5), Review Focus punya tes atau cek runtime.
- Konsistensi: nama rute `notifications.index|read-all|mark|read` dan tipe `NotificationRow` sama di backend, frontend, dan tes.
- Risiko: `unreadNotifications()->update(...)` pada relasi memakai query builder Eloquent (cukup untuk `read_at`); bila Laravel menolak mass update pada relasi, ganti dengan `->get()->each->markAsRead()` (jumlah notifikasi per pengguna kecil).

## Catatan Review (ponytail + impeccable, sudah diterapkan)

- Ponytail: tidak ada yang dipangkas (satu endpoint `mark` dengan isian `dibaca`, relasi notifikasi bawaan Laravel, tanpa migrasi).
- Impeccable (Operate, pengguna lansia): tombol centang tanpa teks di dropdown diganti tombol berteks "Tandai dibaca" (target ketuk memadai, tidak ambigu dengan "setujui"); belum dibaca juga diberi lencana teks "Baru"; tombol "Tandai semua dibaca" naik ke 14px.
