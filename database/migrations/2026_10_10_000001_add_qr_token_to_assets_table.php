<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->string('qr_token', 16)->nullable()->unique()->after('id');
        });

        // Backfill data eksisting yang belum memiliki qr_token
        DB::table('assets')->whereNull('qr_token')->orderBy('id')->chunkById(100, function ($assets) {
            foreach ($assets as $asset) {
                do {
                    $token = Str::random(16);
                } while (DB::table('assets')->where('qr_token', $token)->exists());

                DB::table('assets')
                    ->where('id', $asset->id)
                    ->update(['qr_token' => $token]);
            }
        });
    }

    public function down(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->dropColumn('qr_token');
        });
    }
};
