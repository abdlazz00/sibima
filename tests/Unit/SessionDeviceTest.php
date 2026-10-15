<?php

use App\Support\SessionDevice;

it('describes the browser and operating system', function (string $ua, string $expected) {
    expect(SessionDevice::label($ua))->toBe($expected);
})->with([
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36', 'Chrome di Windows'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0', 'Edge di Windows'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7; rv:109.0) Gecko/20100101 Firefox/121.0', 'Firefox di macOS'],
    ['Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36', 'Chrome di Android'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', 'Safari di iOS'],
]);

it('falls back for an empty or unknown user agent', function () {
    expect(SessionDevice::label(null))->toBe('Perangkat tidak dikenal')
        ->and(SessionDevice::label(''))->toBe('Perangkat tidak dikenal')
        ->and(SessionDevice::label('curl/8.0'))->toBe('Peramban');
});
