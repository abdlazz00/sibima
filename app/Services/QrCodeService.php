<?php

namespace App\Services;

use App\Models\Asset;
use BaconQrCode\Common\ErrorCorrectionLevel;
use BaconQrCode\Encoder\Encoder;
use BaconQrCode\Renderer\GDLibRenderer;
use BaconQrCode\Writer;

class QrCodeService
{
    public function pngDataUri(string $content, int $size = 300, int $margin = 1): string
    {
        $png = (new Writer(new GDLibRenderer($size, $margin)))->writeString(
            $content,
            Encoder::DEFAULT_BYTE_MODE_ENCODING,
            ErrorCorrectionLevel::M()
        );

        return 'data:image/png;base64,'.base64_encode($png);
    }

    public function urlForAsset(Asset $asset): string
    {
        // berbasis APP_URL, bukan host request, agar QR tercetak tetap valid walau dibuat lewat localhost/IP
        return rtrim(config('app.url'), '/').route('scan.show', ['token' => $asset->qr_token], false);
    }

    public function forAsset(Asset $asset): string
    {
        return $this->pngDataUri($this->urlForAsset($asset));
    }
}
