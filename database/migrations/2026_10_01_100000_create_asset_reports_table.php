<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_reports', function (Blueprint $table) {
            $table->id();
            $table->string('nomor_laporan')->unique();
            $table->foreignId('asset_id')->constrained();
            $table->foreignId('unit_id')->constrained('units');
            $table->foreignId('pegawai_id')->nullable()->constrained('pegawais')->nullOnDelete();
            $table->string('jenis');
            $table->string('kondisi_baru');
            $table->date('tanggal_kejadian');
            $table->text('kronologi');
            $table->string('status')->default('pending');
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();
            $table->index(['asset_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_reports');
    }
};
