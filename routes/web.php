<?php

use App\Http\Controllers\AssetCategoryController;
use App\Http\Controllers\AssetController;
use App\Http\Controllers\AssetLabelController;
use App\Http\Controllers\AssetPhotoController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PegawaiController;
use App\Http\Controllers\PenerimaanAsetController;
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
    Route::get('/assets/labels', [AssetLabelController::class, 'show'])->name('assets.labels');
    Route::resource('assets', AssetController::class)->only(['index', 'create', 'store', 'show', 'edit', 'update']);
    Route::delete('/assets/{asset}/photos/{photo}', [AssetPhotoController::class, 'destroy'])
        ->scopeBindings()
        ->name('assets.photos.destroy');

    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');

    Route::post('/notifications/{notification}/read', [NotificationController::class, 'markRead'])->name('notifications.read');

    Route::get('/penerimaan-aset', [PenerimaanAsetController::class, 'index'])->name('penerimaan-aset.index');
    Route::get('/penerimaan-aset/create', [PenerimaanAsetController::class, 'create'])->name('penerimaan-aset.create');
    Route::post('/penerimaan-aset', [PenerimaanAsetController::class, 'store'])->name('penerimaan-aset.store');
    Route::get('/penerimaan-aset/{beritaAcara}', [PenerimaanAsetController::class, 'show'])->name('penerimaan-aset.show');

    Route::get('/asset-categories', [AssetCategoryController::class, 'index'])->name('asset-categories.index');
    Route::get('/asset-categories/create', [AssetCategoryController::class, 'create'])->name('asset-categories.create');
    Route::post('/asset-categories', [AssetCategoryController::class, 'store'])->name('asset-categories.store');
    Route::get('/asset-categories/{assetCategory}/edit', [AssetCategoryController::class, 'edit'])->name('asset-categories.edit');
    Route::put('/asset-categories/{assetCategory}', [AssetCategoryController::class, 'update'])->name('asset-categories.update');
    Route::delete('/asset-categories/{assetCategory}', [AssetCategoryController::class, 'destroy'])->name('asset-categories.destroy');

    Route::get('/pegawais', [PegawaiController::class, 'index'])->name('pegawais.index');
    Route::get('/pegawais/create', [PegawaiController::class, 'create'])->name('pegawais.create');
    Route::post('/pegawais', [PegawaiController::class, 'store'])->name('pegawais.store');
    Route::get('/pegawais/{pegawai}', [PegawaiController::class, 'show'])->name('pegawais.show');
    Route::get('/pegawais/{pegawai}/edit', [PegawaiController::class, 'edit'])->name('pegawais.edit');
    Route::put('/pegawais/{pegawai}', [PegawaiController::class, 'update'])->name('pegawais.update');
    Route::delete('/pegawais/{pegawai}', [PegawaiController::class, 'destroy'])->name('pegawais.destroy');
    Route::post('/pegawais/{pegawai}/user', [PegawaiController::class, 'createUser'])->name('pegawais.create-user');
});

require __DIR__.'/auth.php';
