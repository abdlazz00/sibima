<?php

use App\Models\AssetCategory;
use App\Models\BeritaAcaraPenerimaan;
use App\Models\LoginLog;
use App\Models\User;
use App\Services\ActivityFeed;
use App\Services\ApprovalWorkflowService;
use Database\Seeders\WorkflowDefinitionSeeder;
use Spatie\Permission\Models\Role;

function loginLog(User $user, string $event, $at): LoginLog
{
    $log = LoginLog::create(['user_id' => $user->id, 'identifier' => $user->email, 'event' => $event, 'ip_address' => '10.0.0.5', 'user_agent' => 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36']);
    $log->forceFill(['created_at' => $at])->save();

    return $log;
}

test('login entries are listed newest first and only for the user', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    loginLog($user, 'login', now()->subHours(3));
    loginLog($user, 'gagal', now()->subHour());
    loginLog($other, 'login', now());

    $page = app(ActivityFeed::class)->paginate($user, 'semua', 1);

    expect($page->total())->toBe(2)
        ->and(collect($page->items())->pluck('hasil')->all())->toEqual(['gagal', 'berhasil'])
        ->and(collect($page->items())->first()['judul'])->toBe('Login gagal')
        ->and(collect($page->items())->first()['keterangan'])->toBe('Chrome di Windows · 10.0.0.5');
});

test('filters separate work activity from logins', function () {
    $user = User::factory()->create();
    loginLog($user, 'login', now());

    expect(app(ActivityFeed::class)->paginate($user, 'login', 1)->total())->toBe(1)
        ->and(app(ActivityFeed::class)->paginate($user, 'pekerjaan', 1)->total())->toBe(0);
});

test('a page beyond the range is empty instead of failing', function () {
    $user = User::factory()->create();
    loginLog($user, 'login', now());

    $page = app(ActivityFeed::class)->paginate($user, 'semua', 9);

    expect($page->items())->toBe([])->and($page->total())->toBe(1);
});

test('it paginates fifteen entries per page across sources', function () {
    $user = User::factory()->create();
    foreach (range(1, 20) as $i) {
        loginLog($user, 'login', now()->subMinutes($i));
    }

    $first = app(ActivityFeed::class)->paginate($user, 'semua', 1);
    $second = app(ActivityFeed::class)->paginate($user, 'semua', 2);

    expect($first->items())->toHaveCount(15)->and($second->items())->toHaveCount(5)->and($first->total())->toBe(20);
});

test('the account page loads the activity lazily and keeps working for a minimal account', function () {
    $user = User::factory()->create();
    loginLog($user, 'login', now());

    $this->actingAs($user)->get('/profile')->assertOk()->assertInertia(fn ($page) => $page->missing('aktivitas'));

    $this->actingAs($user)
        ->get('/profile?filter=login&halaman=1')
        ->assertInertia(fn ($page) => $page->reloadOnly('aktivitas', fn ($reload) => $reload->where('aktivitas.total', 1)));
});

function submittedPenerimaan(): array
{
    foreach (['admin_kecamatan', 'kasubag', 'camat'] as $role) {
        Role::findOrCreate($role);
    }
    (new WorkflowDefinitionSeeder)->run();

    $kec = makeKecamatan();
    $pengaju = userWithRole('admin_kecamatan', $kec);
    $approver = userWithRole('kasubag');
    $category = AssetCategory::factory()->subcategory()->create(['code' => '1.3.2.05.02.04']);
    $workflow = app(ApprovalWorkflowService::class);

    $ba = BeritaAcaraPenerimaan::create([
        'no_berita_acara' => 'BA/P/'.uniqid(), 'tanggal_penerimaan' => '2025-09-01',
        'no_kontrak_spk' => 'SPK/P', 'unit_id' => $kec->id,
        'created_by' => $pengaju->id, 'status' => 'submitted',
    ]);
    $ba->items()->create([
        'nama_aset' => 'Printer', 'category_id' => $category->id,
        'jumlah_unit' => 1, 'nilai_per_unit' => 1000000, 'kondisi_awal' => 'baik',
    ]);
    $workflow->submit($ba, 'penerimaan_aset', $pengaju);
    $workflow->approve($ba->fresh()->approvalRequest, $approver);

    return [$ba->fresh(), $pengaju, $approver];
}

test('submitted requests and approval actions of the user appear as work activity', function () {
    [$ba, $pengaju, $approver] = submittedPenerimaan();

    $pengajuEntries = collect(app(ActivityFeed::class)->paginate($pengaju, 'pekerjaan', 1)->items());
    $approverEntries = collect(app(ActivityFeed::class)->paginate($approver, 'pekerjaan', 1)->items());

    expect($pengajuEntries)->toHaveCount(1)
        ->and($pengajuEntries->first()['judul'])->toStartWith('Mengajukan ')
        ->and($pengajuEntries->first()['url'])->toBe($ba->approvalShowUrl())
        ->and($approverEntries)->toHaveCount(1)
        ->and($approverEntries->first()['judul'])->toStartWith('Menyetujui ')
        ->and($approverEntries->first()['tipe'])->toBe('pekerjaan');
});

test('a request whose document was deleted is skipped without failing', function () {
    [$ba, $pengaju] = submittedPenerimaan();

    $ba->items()->delete();
    $ba->delete();

    $page = app(ActivityFeed::class)->paginate($pengaju, 'pekerjaan', 1);

    expect($page->items())->toBe([])->and($page->total())->toBe(0);
});
