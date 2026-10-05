<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Backfill awal memakai chunk() sambil mengubah kolom yang disaring, sehingga baris-barisnya terlewat
     * (chunkById menghindarinya). Isi sisa token yang kosong, lalu larang NULL agar tidak terulang.
     */
    public function up(): void
    {
        DB::table('assets')->whereNull('qr_token')->orWhere('qr_token', '')->orderBy('id')->chunkById(100, function ($assets) {
            foreach ($assets as $asset) {
                do {
                    $token = Str::random(16);
                } while (DB::table('assets')->where('qr_token', $token)->exists());

                DB::table('assets')->where('id', $asset->id)->update(['qr_token' => $token]);
            }
        });

        Schema::table('assets', function (Blueprint $table) {
            $table->string('qr_token', 16)->nullable(false)->change();
        });
    }

    public function down(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->string('qr_token', 16)->nullable()->change();
        });
    }
};
