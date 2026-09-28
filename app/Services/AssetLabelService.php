<?php

namespace App\Services;

use App\Models\Asset;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class AssetLabelService
{
    public const SIZES = [
        'kecil' => [
            'width' => 83, 'height' => 25, 'per_row' => 2, 'qr_col' => 25, 'qr' => 22.5,
            'header_font' => 8.0, 'header_font_kel' => 6.5,
            'name_font' => 7.2, 'code_font' => 6.8, 'name_limit' => 50,
            'header_row_height' => 9.0, 'name_row_height' => 8.0, 'code_row_height' => 8.0,
            'name_box_height' => 7.0,
        ],
        'besar' => [
            'width' => 94, 'height' => 38, 'per_row' => 2, 'qr_col' => 38, 'qr' => 34,
            'header_font' => 10.5, 'header_font_kel' => 8.5,
            'name_font' => 9.2, 'code_font' => 8.2, 'name_limit' => 70,
            'header_row_height' => 14.0, 'name_row_height' => 12.0, 'code_row_height' => 12.0,
            'name_box_height' => 10.5,
        ],
    ];

    public function __construct(private readonly QrCodeService $qr) {}

    /** @param Collection<int, Asset> $assets */
    public function pdf(Collection $assets, string $size): string
    {
        $dims = self::SIZES[$size] ?? self::SIZES['kecil'];
        $dims['info_col'] = $dims['width'] - $dims['qr_col'];
        $dims['qr_pct'] = round(($dims['qr_col'] / $dims['width']) * 100, 2);
        $dims['info_pct'] = round(100 - $dims['qr_pct'], 2);
        $dims['row_height'] = $dims['height'] / 3;

        $labels = $assets->map(fn (Asset $asset) => [
            'asset' => $asset,
            'name' => Str::limit($asset->nama_aset, $dims['name_limit']),
            'tahun' => $asset->tanggal_perolehan ? date('Y', strtotime((string) $asset->tanggal_perolehan)) : '-',
            'qr' => $this->qr->forAsset($asset),
        ]);

        $html = view('pdf.asset-labels', [
            'rows' => $labels->chunk($dims['per_row']),
            'dims' => $dims,
        ])->render();

        $options = new Options;
        $options->set('isRemoteEnabled', false);
        $options->set('defaultFont', 'DejaVu Sans');

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();

        return $dompdf->output();
    }
}
