<?php

use App\Models\Asset;
use App\Models\User;
use App\Services\QrCodeService;
use Inertia\Testing\AssertableInertia as Assert;

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

it('prints in-scope asset labels as a PDF', function () {
    $response = $this->actingAs($this->admin)
        ->get('/assets/labels?'.http_build_query(['ids' => [$this->own->id, $this->own2->id]]));

    $response->assertOk()->assertHeader('Content-Type', 'application/pdf');
    expect(substr($response->getContent(), 0, 5))->toBe('%PDF-');
});

it('refuses to print when any selected asset is out of scope', function () {
    $this->actingAs($this->admin)
        ->get('/assets/labels?'.http_build_query(['ids' => [$this->own->id, $this->foreign->id]]))
        ->assertForbidden();
});

it('validates the id list', function (array $ids) {
    $this->actingAs($this->admin)
        ->from('/assets')
        ->get('/assets/labels?'.http_build_query(['ids' => $ids]))
        ->assertRedirect('/assets')
        ->assertSessionHasErrors();
})->with([
    'empty' => [[]],
    'unknown id' => [[999999]],
    'too many' => [range(1, 100)],
]);

it('forbids a user with no role from printing labels', function () {
    $user = User::factory()->create(['unit_id' => $this->kel->id]);

    $this->actingAs($user)
        ->get('/assets/labels?'.http_build_query(['ids' => [$this->own->id]]))
        ->assertForbidden();
});

it('returns a guest scanning the QR straight back to the asset after login', function () {
    $this->get("/assets/{$this->own->id}")->assertRedirect('/login');

    $this->post('/login', [
        'email' => $this->admin->email,
        'password' => 'password',
    ])->assertRedirect("/assets/{$this->own->id}");
});
