<?php

use Illuminate\Support\Facades\Route;

beforeEach(function () {
    Route::get('/_proto', fn () => response()->json(['secure' => request()->isSecure()]));
});

it('menganggap request HTTPS bila proxy mengirim X-Forwarded-Proto', function () {
    $this->get('/_proto', ['X-Forwarded-Proto' => 'https'])->assertJson(['secure' => true]);
});

it('mengabaikan X-Forwarded-Host agar link tidak bisa diracuni', function () {
    Route::get('/_host', fn () => response()->json(['host' => request()->getHost()]));

    $this->get('/_host', ['X-Forwarded-Host' => 'evil.example'])->assertJson(['host' => 'localhost']);
});

it('mengabaikan X-Forwarded-For agar IP tidak bisa dipalsukan (rate limit)', function () {
    Route::get('/_ip', fn () => response()->json(['ip' => request()->ip()]));

    $this->get('/_ip', ['X-Forwarded-For' => '6.6.6.6'])->assertJson(['ip' => '127.0.0.1']);
});

it('menganggap request HTTP bila tidak ada header proxy', function () {
    $this->get('/_proto')->assertJson(['secure' => false]);
});
