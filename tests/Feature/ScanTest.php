<?php

use App\Models\Asset;
use App\Models\Pegawai;
use App\Services\AssetScanSummary;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;

const SCAN_KEYS = ['id', 'nama_aset', 'kode_barang', 'nomor_register', 'merk_type', 'kategori', 'unit', 'kondisi', 'status', 'pemegang', 'foto'];

beforeEach(function () {
    foreach (['kasubag', 'camat', 'admin_kecamatan', 'admin_kelurahan', 'lurah'] as $role) {
        Role::findOrCreate($role);
    }

    $this->kec = makeKecamatan();
    $this->kelA = makeKelurahan($this->kec, 'Kelurahan A');
    $this->kelB = makeKelurahan($this->kec, 'Kelurahan B');
    $this->adminA = userWithRole('admin_kelurahan', $this->kelA);
    $this->asset = Asset::factory()->create([
        'unit_id' => $this->kelA->id,
        'nomor_register' => 7,
        'nilai_perolehan' => 987654321,
        'nilai_buku' => 123456789,
        'no_dokumen' => 'DOK-RAHASIA-001',
        'keterangan' => 'CATATAN-RAHASIA',
    ]);
});

it('returns exactly the allowed summary keys', function () {
    $summary = app(AssetScanSummary::class)->for($this->asset->load(['category', 'unit', 'currentHolder', 'photos']));

    expect(array_keys($summary))->toBe(SCAN_KEYS)
        ->and($summary['nomor_register'])->toBe('0007')
        ->and($summary['unit'])->toBe('Kelurahan A')
        ->and($summary['pemegang'])->toBeNull()
        ->and($summary['foto'])->toBeNull();
});

it('includes the holder name and the first photo url', function () {
    $pegawai = Pegawai::factory()->create(['unit_id' => $this->kelA->id, 'nama' => 'Budi Santoso']);
    $this->asset->update(['current_holder_id' => $pegawai->id]);
    $this->asset->photos()->create(['path' => 'assets/foto-1.jpg']);

    $summary = app(AssetScanSummary::class)->for($this->asset->fresh()->load(['category', 'unit', 'currentHolder', 'photos']));

    expect($summary['pemegang'])->toBe('Budi Santoso')
        ->and($summary['foto'])->toContain('assets/foto-1.jpg');
});

it('shows the summary with a detail link to a user entitled to the unit', function () {
    $this->actingAs($this->adminA)->get(route('scan.show', ['token' => $this->asset->qr_token]))
        ->assertOk()
        ->assertInertia(fn (Assert $p) => $p
            ->component('Scan/Index')
            ->where('canViewDetail', true)
            ->where('notFound', false)
            ->where('summary.id', $this->asset->id)
            ->where('summary', fn ($s) => array_keys(collect($s)->all()) === SCAN_KEYS));
});

it('shows the summary without a detail link for an asset of another unit and leaks no sensitive value', function () {
    $adminB = userWithRole('admin_kelurahan', $this->kelB);

    $response = $this->actingAs($adminB)->get(route('scan.show', ['token' => $this->asset->qr_token]));

    $response->assertOk()->assertInertia(fn (Assert $p) => $p
        ->where('canViewDetail', false)
        ->where('summary.id', $this->asset->id));

    $json = json_encode($response->viewData('page')['props']);
    foreach (['987654321', '123456789', 'DOK-RAHASIA-001', 'CATATAN-RAHASIA', 'nilai_buku', 'no_dokumen', 'tanggal_perolehan', 'histories'] as $secret) {
        expect($json)->not->toContain($secret);
    }
});

it('lets every logged-in role open the scan page and a summary', function (string $role) {
    $unit = match ($role) {
        'kasubag' => null,
        'admin_kelurahan', 'lurah' => $this->kelB,
        default => $this->kec,
    };
    $user = userWithRole($role, $unit);

    $this->actingAs($user)->get(route('scan.index'))->assertOk()
        ->assertInertia(fn (Assert $p) => $p->component('Scan/Index')->where('summary', null)->where('notFound', false));
    $this->actingAs($user)->get(route('scan.show', ['token' => $this->asset->qr_token]))->assertOk();
})->with(['kasubag', 'camat', 'admin_kecamatan', 'admin_kelurahan', 'lurah']);

it('sends a guest to login', function () {
    $this->get('/scan')->assertRedirect('/login');
    $this->get("/scan/{$this->asset->qr_token}")->assertRedirect('/login');
});

it('renders a not-found scan page with status 404 for an unknown 16-character token', function () {
    $response = $this->actingAs($this->adminA)->get('/scan/1234567890abcdef');

    $response->assertStatus(404);
    $props = $response->viewData('page')['props'];
    expect($props['notFound'])->toBeTrue()
        ->and($props['summary'])->toBeNull()
        ->and($props['canViewDetail'])->toBeFalse();
});

it('answers 404 for non-16-character or invalid tokens', function () {
    $this->actingAs($this->adminA)->get('/scan/123')->assertNotFound();
    $this->actingAs($this->adminA)->get('/scan/99999999999999999999')->assertNotFound();
});
