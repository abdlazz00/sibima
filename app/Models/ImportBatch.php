<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ImportBatch extends Model
{
    public const MEMERIKSA = 'memeriksa';

    public const SIAP = 'siap';

    public const MEMPROSES = 'memproses';

    public const SELESAI = 'selesai';

    public const GAGAL = 'gagal';

    public const KEDALUWARSA = 'kedaluwarsa';

    protected $fillable = [
        'modul', 'user_id', 'nama_berkas', 'path', 'path_hasil', 'status', 'total_baris',
        'jumlah_baru', 'jumlah_duplikat', 'jumlah_error', 'jumlah_masuk', 'progres', 'pesan',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
