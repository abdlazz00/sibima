<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_mutation_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_mutation_id')->constrained('asset_mutations')->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained('assets');
            $table->foreignId('target_holder_id')->nullable()->constrained('pegawais')->nullOnDelete();
            $table->string('catatan', 255)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_mutation_items');
    }
};
