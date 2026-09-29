<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_mutations', function (Blueprint $table) {
            $table->id();
            $table->string('nomor_mutasi', 50)->unique();
            $table->string('jenis_mutasi', 30);
            $table->foreignId('origin_unit_id')->constrained('units');
            $table->foreignId('destination_unit_id')->constrained('units');
            $table->date('tanggal_mutasi');
            $table->text('keterangan')->nullable();
            $table->string('status', 20)->default('pending');
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_mutations');
    }
};
