<?php

use App\Http\Controllers\AssetCategoryController;
use App\Http\Controllers\PegawaiController;
use App\Http\Controllers\ProfileController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
        'laravelVersion' => Application::VERSION,
        'phpVersion' => PHP_VERSION,
    ]);
});

Route::get('/dashboard', function () {
    return Inertia::render('Dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');

    Route::get('/asset-categories', [AssetCategoryController::class, 'index'])->name('asset-categories.index');
    Route::post('/asset-categories', [AssetCategoryController::class, 'store'])->name('asset-categories.store');
    Route::put('/asset-categories/{assetCategory}', [AssetCategoryController::class, 'update'])->name('asset-categories.update');
    Route::delete('/asset-categories/{assetCategory}', [AssetCategoryController::class, 'destroy'])->name('asset-categories.destroy');

    Route::get('/pegawais', [PegawaiController::class, 'index'])->name('pegawais.index');
    Route::post('/pegawais', [PegawaiController::class, 'store'])->name('pegawais.store');
    Route::put('/pegawais/{pegawai}', [PegawaiController::class, 'update'])->name('pegawais.update');
    Route::delete('/pegawais/{pegawai}', [PegawaiController::class, 'destroy'])->name('pegawais.destroy');
    Route::post('/pegawais/{pegawai}/user', [PegawaiController::class, 'createUser'])->name('pegawais.create-user');
});

require __DIR__.'/auth.php';
