<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('import_batches', function (Blueprint $table) {
            $table->id();
            $table->string('modul', 20);
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('nama_berkas');
            $table->string('path');
            $table->string('path_hasil')->nullable();
            $table->string('status', 20)->default('memeriksa');
            $table->unsignedInteger('total_baris')->default(0);
            $table->unsignedInteger('jumlah_baru')->default(0);
            $table->unsignedInteger('jumlah_duplikat')->default(0);
            $table->unsignedInteger('jumlah_error')->default(0);
            $table->unsignedInteger('jumlah_masuk')->default(0);
            $table->unsignedInteger('progres')->default(0);
            $table->text('pesan')->nullable();
            $table->timestamps();

            $table->index(['modul', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('import_batches');
    }
};
