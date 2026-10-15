<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

beforeEach(function () {
    Route::middleware('web')->get('/__client-ip', fn (Request $request) => $request->ip());
    Route::middleware('web')->get('/__host', fn (Request $request) => $request->getHost());
});

test('behind a private proxy the client ip is the first untrusted address of the forwarded chain', function () {
    $this->withServerVariables(['REMOTE_ADDR' => '172.18.0.5'])
        ->withHeaders(['X-Forwarded-For' => '6.6.6.6, 203.0.113.9'])
        ->get('/__client-ip')
        ->assertContent('203.0.113.9');
});

test('a forwarded header sent straight from a public address is ignored', function () {
    $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.7'])
        ->withHeaders(['X-Forwarded-For' => '6.6.6.6'])
        ->get('/__client-ip')
        ->assertContent('198.51.100.7');
});

test('the forwarded host header is never trusted', function () {
    $this->withServerVariables(['REMOTE_ADDR' => '172.18.0.5'])
        ->withHeaders(['X-Forwarded-Host' => 'evil.example'])
        ->get('/__host')
        ->assertContent('localhost');
});
