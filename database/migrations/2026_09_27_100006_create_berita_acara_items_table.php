<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('berita_acara_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('berita_acara_penerimaan_id')->constrained()->cascadeOnDelete();
            $table->string('nama_aset');
            $table->string('merk_type')->nullable();
            $table->foreignId('category_id')->constrained('asset_categories');
            $table->unsignedInteger('jumlah_unit');
            $table->decimal('nilai_per_unit', 15, 2);
            $table->string('kondisi_awal')->default('baik');
            $table->json('asset_ids')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('berita_acara_items');
    }
};
