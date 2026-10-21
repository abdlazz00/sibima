<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;

class ThumbnailService
{
    public const DEFAULT_SIZE = 96;

    /**
     * Generate square center-cropped thumbnail for a stored image.
     */
    public function generate(string $originalPath, int $width = self::DEFAULT_SIZE, int $height = self::DEFAULT_SIZE): ?string
    {
        $disk = Storage::disk('public');
        if (! $disk->exists($originalPath)) {
            return null;
        }

        $content = $disk->get($originalPath);
        if ($content === null || $content === '') {
            return null;
        }

        $src = @imagecreatefromstring($content);
        if (! $src) {
            return null;
        }

        $srcW = imagesx($src);
        $srcH = imagesy($src);

        // Center square crop
        $cropSize = min($srcW, $srcH);
        $srcX = (int) max(0, ($srcW - $cropSize) / 2);
        $srcY = (int) max(0, ($srcH - $cropSize) / 2);

        $dst = imagecreatetruecolor($width, $height);

        // Preserve transparency for PNG/WebP if applicable
        imagealphablending($dst, false);
        imagesavealpha($dst, true);
        $transparent = imagecolorallocatealpha($dst, 255, 255, 255, 127);
        imagefilledrectangle($dst, 0, 0, $width, $height, $transparent);
        imagealphablending($dst, true);

        imagecopyresampled($dst, $src, 0, 0, $srcX, $srcY, $width, $height, $cropSize, $cropSize);

        ob_start();
        $useWebp = function_exists('imagewebp');
        if ($useWebp) {
            imagewebp($dst, null, 80);
        } else {
            imagejpeg($dst, null, 80);
        }
        $thumbData = ob_get_clean();

        imagedestroy($src);
        imagedestroy($dst);

        if (! $thumbData) {
            return null;
        }

        $ext = $useWebp ? 'webp' : 'jpg';
        $thumbPath = $this->thumbPath($originalPath, $width, $height, $ext);
        $disk->put($thumbPath, $thumbData);

        return $thumbPath;
    }

    /**
     * Get thumbnail URL with fallback to original image URL.
     */
    public function url(?string $originalPath, int $width = self::DEFAULT_SIZE, int $height = self::DEFAULT_SIZE): ?string
    {
        if (! $originalPath) {
            return null;
        }

        $disk = Storage::disk('public');
        $ext = function_exists('imagewebp') ? 'webp' : 'jpg';
        $thumbPath = $this->thumbPath($originalPath, $width, $height, $ext);

        if ($disk->exists($thumbPath)) {
            return $disk->url($thumbPath);
        }

        return $disk->url($originalPath);
    }

    /**
     * Delete any generated thumbnails for a given original path.
     */
    public function deleteThumbnails(string $originalPath, int $width = self::DEFAULT_SIZE, int $height = self::DEFAULT_SIZE): void
    {
        $disk = Storage::disk('public');
        foreach (['webp', 'jpg'] as $ext) {
            $path = $this->thumbPath($originalPath, $width, $height, $ext);
            if ($disk->exists($path)) {
                $disk->delete($path);
            }
        }
    }

    private function thumbPath(string $originalPath, int $width, int $height, string $ext): string
    {
        $pathWithoutExt = preg_replace('/\.[^.]+$/', '', $originalPath);

        return "thumbs/{$width}x{$height}/{$pathWithoutExt}.{$ext}";
    }
}
