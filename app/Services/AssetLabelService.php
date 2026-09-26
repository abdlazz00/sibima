<?php

namespace App\Services;

use App\Models\Asset;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Support\Collection;
use Picqer\Barcode\BarcodeGeneratorPNG;

class AssetLabelService
{
    /** @param Collection<int, Asset> $assets */
    public function pdf(Collection $assets): string
    {
        $generator = new BarcodeGeneratorPNG;
        $logo = $this->dataUri(public_path('images/lambang-kota-batam.png'));

        $labels = $assets->map(fn (Asset $asset) => [
            'asset' => $asset,
            'barcode' => 'data:image/png;base64,'.base64_encode(
                $generator->getBarcode($asset->kode_barang, $generator::TYPE_CODE_128, 2, 60)
            ),
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
