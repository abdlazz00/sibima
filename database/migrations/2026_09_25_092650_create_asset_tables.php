<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assets', function (Blueprint $table) {
            $table->id();
            $table->string('kode_barang');
            $table->unsignedInteger('nomor_register');
            $table->string('nama_aset');
            $table->foreignId('category_id')->constrained('asset_categories')->restrictOnDelete();
            $table->foreignId('unit_id')->constrained('units')->restrictOnDelete();
            $table->foreignId('current_holder_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('merk_type')->nullable();
            $table->string('kondisi');
            $table->string('status')->default('aktif');
            $table->date('tanggal_perolehan');
            $table->string('sumber_perolehan')->nullable();
            $table->decimal('nilai_perolehan', 15, 2);
            $table->decimal('nilai_buku', 15, 2);
            $table->string('no_dokumen')->nullable()->unique();
            $table->text('keterangan')->nullable();
            $table->timestamps();

            $table->unique(['kode_barang', 'nomor_register']);
            $table->index(['unit_id', 'kondisi']);
        });

        Schema::create('asset_photos', function (Blueprint $table) {
            $table->id();
            $table->morphs('photoable');
            $table->string('path');
            $table->timestamps();
        });

        Schema::create('asset_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained()->cascadeOnDelete();
            $table->string('event');
            $table->foreignId('unit_id')->constrained('units')->restrictOnDelete();
            $table->foreignId('current_holder_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('kondisi');
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('keterangan')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_histories');
        Schema::dropIfExists('asset_photos');
        Schema::dropIfExists('assets');
    }
};
