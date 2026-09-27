<?php

namespace App\Services;

use App\Models\Asset;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class AssetLabelService
{
    private const MAX_NAME_LENGTH = 56;

    public function __construct(private readonly QrCodeService $qr) {}

    /** @param Collection<int, Asset> $assets */
    public function pdf(Collection $assets): string
    {
        $logo = $this->dataUri(public_path('images/lambang-kota-batam.png'));

        $labels = $assets->map(fn (Asset $asset) => [
            'asset' => $asset,
            'name' => Str::limit($asset->nama_aset, self::MAX_NAME_LENGTH),
            'qr' => $this->qr->forAsset($asset),
        ]);

        $html = view('pdf.asset-labels', ['rows' => $labels->chunk(2), 'logo' => $logo])->render();

        $options = new Options;
        $options->set('isRemoteEnabled', false);
        $options->set('defaultFont', 'DejaVu Sans');

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();

        return $dompdf->output();
    }

    private function dataUri(string $path): string
    {
        return 'data:image/png;base64,'.base64_encode(file_get_contents($path));
    }
}
