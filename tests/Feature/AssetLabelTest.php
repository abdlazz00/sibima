<?php

use App\Models\Asset;
use App\Models\User;
use App\Services\QrCodeService;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    $this->kec = makeKecamatan();
    $this->kel = makeKelurahan($this->kec, 'Kelurahan Tembesi');
    $this->own = Asset::factory()->create(['unit_id' => $this->kel->id, 'nomor_register' => 1]);
    $this->own2 = Asset::factory()->create(['unit_id' => $this->kel->id, 'nomor_register' => 2]);
    $this->foreign = Asset::factory()->create(['unit_id' => $this->kec->id, 'nomor_register' => 3]);
    $this->admin = userWithRole('admin_kelurahan', $this->kel);
});

it('renders a PNG data uri QR code', function () {
    $uri = app(QrCodeService::class)->pngDataUri('https://simaset.test/assets/1');

    expect($uri)->toStartWith('data:image/png;base64,')
        ->and(substr(base64_decode(substr($uri, strlen('data:image/png;base64,'))), 0, 8))->toBe("\x89PNG\r\n\x1a\n");
});

it('shows the QR code on the asset page', function () {
    $this->actingAs($this->admin)->get("/assets/{$this->own->id}")
        ->assertInertia(fn (Assert $page) => $page->where('qr', fn (string $qr) => str_starts_with($qr, 'data:image/png;base64,')));
});

it('prints in-scope asset labels as a PDF', function (string $size) {
    $response = $this->actingAs($this->admin)
        ->get('/assets/labels?'.http_build_query(['ids' => [$this->own->id, $this->own2->id], 'size' => $size]));

    $response->assertOk()->assertHeader('Content-Type', 'application/pdf');
    expect(substr($response->getContent(), 0, 5))->toBe('%PDF-');
})->with(['kecil', 'besar']);

it('refuses to print when any selected asset is out of scope', function () {
    $this->actingAs($this->admin)
        ->get('/assets/labels?'.http_build_query(['ids' => [$this->own->id, $this->foreign->id], 'size' => 'kecil']))
        ->assertForbidden();
});

it('validates the id list', function (array $ids) {
    $this->actingAs($this->admin)
        ->from('/assets')
        ->get('/assets/labels?'.http_build_query(['ids' => $ids, 'size' => 'kecil']))
        ->assertRedirect('/assets')
        ->assertSessionHasErrors();
})->with([
    'empty' => [[]],
    'unknown id' => [[999999]],
    'too many' => [range(1, 100)],
]);

it('rejects an invalid label size', function () {
    $this->actingAs($this->admin)
        ->from('/assets')
        ->get('/assets/labels?'.http_build_query(['ids' => [$this->own->id], 'size' => 'raksasa']))
        ->assertRedirect('/assets')
        ->assertSessionHasErrors('size');
});

it('forbids a user with no role from printing labels', function () {
    $user = User::factory()->create(['unit_id' => $this->kel->id]);

    $this->actingAs($user)
        ->get('/assets/labels?'.http_build_query(['ids' => [$this->own->id], 'size' => 'kecil']))
        ->assertForbidden();
});

it('returns a guest scanning the QR straight back to the asset after login', function () {
    $this->get("/assets/{$this->own->id}")->assertRedirect('/login');

    $this->post('/login', [
        'email' => $this->admin->email,
        'password' => 'password',
    ])->assertRedirect("/assets/{$this->own->id}");
});

it('encodes the scan summary url in the label QR from APP_URL, not the request host', function () {
    config(['app.url' => 'https://sibima.example.go.id']);
    $this->get('http://localhost/login');

    expect(app(QrCodeService::class)->urlForAsset($this->own))
        ->toBe("https://sibima.example.go.id/scan/{$this->own->qr_token}")
        ->and(app(QrCodeService::class)->forAsset($this->own))->toStartWith('data:image/png;base64,');
});

it('returns a guest scanning the new QR straight back to the summary after login', function () {
    $this->get("/scan/{$this->own->qr_token}")->assertRedirect('/login');

    $this->post('/login', [
        'email' => $this->admin->email,
        'password' => 'password',
    ])->assertRedirect("/scan/{$this->own->qr_token}");
});

it('forbids a user without aset.print-label permission from printing labels', function () {
    $role = Role::create(['name' => 'pegawai_tanpa_cetak', 'guard_name' => 'web']);
    $role->givePermissionTo('aset.view');
    $user = userWithRole('pegawai_tanpa_cetak', $this->kel);

    $this->actingAs($user)
        ->get('/assets/labels?'.http_build_query(['ids' => [$this->own->id], 'size' => 'kecil']))
        ->assertForbidden();
});

it('prepares a short ticket and prints via the ticket URL', function () {
    $prepareRes = $this->actingAs($this->admin)
        ->postJson('/assets/labels/prepare', [
            'ids' => [$this->own->id, $this->own2->id],
            'size' => 'kecil',
        ]);

    $prepareRes->assertOk()
        ->assertJsonStructure(['ticket', 'url']);

    $ticket = $prepareRes->json('ticket');
    expect($ticket)->toBeString()->toHaveLength(16);

    // Print with the ticket URL
    $printRes = $this->actingAs($this->admin)
        ->get("/assets/labels/print/{$ticket}");

    $printRes->assertOk()->assertHeader('Content-Type', 'application/pdf');
    expect(substr($printRes->getContent(), 0, 5))->toBe('%PDF-');
});

it('rejects an invalid or different user ticket', function () {
    // 404 on nonexistent ticket
    $this->actingAs($this->admin)
        ->get('/assets/labels/print/invalidticket123')
        ->assertNotFound();

    // Prepare ticket with user A
    $prepareRes = $this->actingAs($this->admin)
        ->postJson('/assets/labels/prepare', [
            'ids' => [$this->own->id],
            'size' => 'kecil',
        ]);
    $ticket = $prepareRes->json('ticket');

    // Access with user B
    $otherUser = userWithRole('admin_kelurahan', makeKelurahan($this->kec, 'Kelurahan Lain'));
    $this->actingAs($otherUser)
        ->get("/assets/labels/print/{$ticket}")
        ->assertNotFound();
});

it('supports comma-separated id string in GET /assets/labels', function () {
    $res = $this->actingAs($this->admin)
        ->get("/assets/labels?ids={$this->own->id},{$this->own2->id}&size=kecil");

    $res->assertOk()->assertHeader('Content-Type', 'application/pdf');
    expect(substr($res->getContent(), 0, 5))->toBe('%PDF-');
});
