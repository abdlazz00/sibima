<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('asset_mutation_items', function (Blueprint $table) {
            $table->foreignId('origin_holder_id')->nullable()->after('asset_id')->constrained('pegawais')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('asset_mutation_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('origin_holder_id');
        });
    }
};
