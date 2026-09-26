<?php

namespace App\Providers;

use App\Repositories\Contracts\AssetCategoryRepositoryInterface;
use App\Repositories\Contracts\AssetRepositoryInterface;
use App\Repositories\Contracts\PegawaiRepositoryInterface;
use App\Repositories\Contracts\UnitRepositoryInterface;
use App\Repositories\EloquentAssetCategoryRepository;
use App\Repositories\EloquentAssetRepository;
use App\Repositories\EloquentPegawaiRepository;
use App\Repositories\EloquentUnitRepository;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(AssetRepositoryInterface::class, EloquentAssetRepository::class);
        $this->app->bind(AssetCategoryRepositoryInterface::class, EloquentAssetCategoryRepository::class);
        $this->app->bind(PegawaiRepositoryInterface::class, EloquentPegawaiRepository::class);
        $this->app->bind(UnitRepositoryInterface::class, EloquentUnitRepository::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Vite::prefetch(concurrency: 3);
    }
}
