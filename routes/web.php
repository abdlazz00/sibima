<?php

use App\Http\Controllers\ApprovalActionController;
use App\Http\Controllers\AssetCategoryController;
use App\Http\Controllers\AssetController;
use App\Http\Controllers\AssetLabelController;
use App\Http\Controllers\AssetMutationController;
use App\Http\Controllers\AssetPhotoController;
use App\Http\Controllers\AssetReportController;
use App\Http\Controllers\AssetRequestController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\LaporanAsetController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\ScanController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PegawaiController;
use App\Http\Controllers\PenerimaanAsetController;
use App\Http\Controllers\PersetujuanController;
use App\Http\Controllers\WorkflowSettingsController;
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

Route::get('/dashboard', DashboardController::class)->middleware(['auth', 'verified'])->name('dashboard');

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
    Route::get('/penerimaan-aset/{beritaAcara}/edit', [PenerimaanAsetController::class, 'edit'])->name('penerimaan-aset.edit');
    Route::put('/penerimaan-aset/{beritaAcara}', [PenerimaanAsetController::class, 'update'])->name('penerimaan-aset.update');
    Route::delete('/penerimaan-aset/{beritaAcara}', [PenerimaanAsetController::class, 'destroy'])->name('penerimaan-aset.destroy');

    Route::post('/approval-requests/{approvalRequest}/approve', [ApprovalActionController::class, 'approve'])->name('approval-requests.approve');
    Route::post('/approval-requests/{approvalRequest}/reject', [ApprovalActionController::class, 'reject'])->name('approval-requests.reject');
    Route::post('/approval-requests/{approvalRequest}/cancel', [ApprovalActionController::class, 'cancel'])->name('approval-requests.cancel');
    Route::post('/approval-requests/{approvalRequest}/reassign', [ApprovalActionController::class, 'reassign'])->name('approval-requests.reassign');

    Route::get('/persetujuan', [PersetujuanController::class, 'index'])->name('persetujuan.index');

    Route::get('/pengaturan/alur', [WorkflowSettingsController::class, 'index'])->name('workflow-settings.index');
    Route::get('/pengaturan/alur/{workflow}', [WorkflowSettingsController::class, 'edit'])->name('workflow-settings.edit');
    Route::put('/pengaturan/alur/{workflow}', [WorkflowSettingsController::class, 'update'])->name('workflow-settings.update');
    Route::post('/pengaturan/alur/{workflow}/reset', [WorkflowSettingsController::class, 'reset'])->name('workflow-settings.reset');

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
    Route::resource('asset-mutations', AssetMutationController::class)->only(['index', 'create', 'store', 'show']);
    Route::resource('asset-reports', AssetReportController::class)->only(['index', 'create', 'store', 'show']);
    Route::get('/laporan-aset', [LaporanAsetController::class, 'index'])->name('laporan-aset.index');
    Route::get('/laporan-aset/unduh', [LaporanAsetController::class, 'unduh'])->name('laporan-aset.download');
    Route::get('/laporan', [ReportController::class, 'index'])->name('report.index');
    Route::get('/laporan/{laporan}/unduh', [ReportController::class, 'download'])
        ->where('laporan', 'aset|mutasi|rusak-hilang')
        ->name('report.download');
    Route::get('/scan', [ScanController::class, 'index'])->name('scan.index');
    Route::get('/scan/{id}', [ScanController::class, 'show'])->where('id', '[0-9]{1,15}')->name('scan.show');
    Route::resource('asset-requests', AssetRequestController::class)->only(['index', 'create', 'store', 'show']);
    Route::post('/asset-requests/{assetRequest}/fulfill', [AssetRequestController::class, 'fulfill'])->name('asset-requests.fulfill');
    Route::post('/asset-requests/{assetRequest}/close', [AssetRequestController::class, 'close'])->name('asset-requests.close');
});

require __DIR__.'/auth.php';
