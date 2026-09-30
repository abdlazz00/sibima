<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_requests', function (Blueprint $table) {
            $table->id();
            $table->string('nomor_permohonan')->unique();
            $table->string('jenis');
            $table->foreignId('pegawai_id')->nullable()->constrained('pegawais')->nullOnDelete();
            $table->foreignId('unit_id')->constrained('units');
            $table->foreignId('category_id')->constrained('asset_categories');
            $table->unsignedInteger('jumlah')->default(1);
            $table->text('keterangan');
            $table->string('status')->default('pending');
            $table->foreignId('created_by')->constrained('users');
            $table->foreignId('mutation_id')->nullable()->constrained('asset_mutations')->nullOnDelete();
            $table->foreignId('fulfilled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('fulfilled_at')->nullable();
            $table->text('catatan_penutupan')->nullable();
            $table->timestamps();
            $table->index(['status', 'jenis']);
        });

        Schema::create('asset_request_assets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_request_id')->constrained()->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained();
            $table->unique(['asset_request_id', 'asset_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_request_assets');
        Schema::dropIfExists('asset_requests');
    }
};
