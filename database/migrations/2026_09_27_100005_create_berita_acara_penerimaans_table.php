<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('berita_acara_penerimaans', function (Blueprint $table) {
            $table->id();
            $table->string('no_berita_acara')->unique();
            $table->date('tanggal_penerimaan');
            $table->string('sumber_perolehan')->nullable();
            $table->string('no_kontrak_spk');
            $table->string('vendor')->nullable();
            $table->text('catatan')->nullable();
            $table->foreignId('unit_id')->constrained();
            $table->foreignId('created_by')->constrained('users');
            $table->string('status')->default('draft');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('berita_acara_penerimaans');
    }
};
