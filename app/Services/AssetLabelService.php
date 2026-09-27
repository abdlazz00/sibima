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
            'header_font' => 6.5, 'header_font_kel' => 5,
            'name_font' => 7.2, 'code_font' => 6.5, 'name_limit' => 50,
        ],
        'besar' => [
            'width' => 100, 'height' => 40, 'per_row' => 1, 'qr_col' => 40, 'qr' => 37,
            'header_font' => 9, 'header_font_kel' => 7,
            'name_font' => 10.5, 'code_font' => 9.5, 'name_limit' => 70,
        ],
    ];

    public function __construct(private readonly QrCodeService $qr) {}

    /** @param Collection<int, Asset> $assets */
    public function pdf(Collection $assets, string $size): string
    {
        $dims = self::SIZES[$size] ?? self::SIZES['kecil'];
        $dims['info_col'] = $dims['width'] - $dims['qr_col'];
        $dims['row_height'] = $dims['height'] / 3;

        $labels = $assets->map(fn (Asset $asset) => [
            'asset' => $asset,
            'name' => Str::limit($asset->nama_aset, $dims['name_limit']),
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
