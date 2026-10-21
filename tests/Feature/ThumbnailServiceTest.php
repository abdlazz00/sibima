<?php

use App\Services\ThumbnailService;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('public');
});

it('generates a 96x96 webp thumbnail from an image file', function () {
    $service = new ThumbnailService;

    // Create a 400x300 test JPEG in fake storage
    $image = imagecreatetruecolor(400, 300);
    $bg = imagecolorallocate($image, 255, 0, 0);
    imagefill($image, 0, 0, $bg);
    ob_start();
    imagejpeg($image);
    $jpegData = ob_get_clean();
    imagedestroy($image);

    Storage::disk('public')->put('assets/1/sample.jpg', $jpegData);

    $thumbPath = $service->generate('assets/1/sample.jpg', 96, 96);

    expect($thumbPath)->not->toBeNull();
    expect($thumbPath)->toEndWith('.webp');
    Storage::disk('public')->assertExists($thumbPath);

    // Verify thumb dimensions
    $thumbContent = Storage::disk('public')->get($thumbPath);
    $thumbImg = imagecreatefromstring($thumbContent);
    expect(imagesx($thumbImg))->toBe(96);
    expect(imagesy($thumbImg))->toBe(96);
    imagedestroy($thumbImg);
});

it('returns thumbnail url if exists, otherwise falls back to original url', function () {
    $service = new ThumbnailService;

    // Without thumbnail generated yet
    $fallbackUrl = $service->url('pegawai/sample.jpg');
    expect($fallbackUrl)->toBe(Storage::disk('public')->url('pegawai/sample.jpg'));

    // Create image and generate thumbnail
    $image = imagecreatetruecolor(200, 200);
    ob_start();
    imagejpeg($image);
    $jpegData = ob_get_clean();
    imagedestroy($image);

    Storage::disk('public')->put('pegawai/sample.jpg', $jpegData);
    $service->generate('pegawai/sample.jpg');

    $thumbUrl = $service->url('pegawai/sample.jpg');
    expect($thumbUrl)->toContain('thumbs/96x96/pegawai/sample.webp');
});

it('deletes thumbnails when original is deleted', function () {
    $service = new ThumbnailService;

    $image = imagecreatetruecolor(200, 200);
    ob_start();
    imagejpeg($image);
    $jpegData = ob_get_clean();
    imagedestroy($image);

    Storage::disk('public')->put('assets/2/pic.jpg', $jpegData);
    $thumbPath = $service->generate('assets/2/pic.jpg');

    Storage::disk('public')->assertExists($thumbPath);

    $service->deleteThumbnails('assets/2/pic.jpg');
    Storage::disk('public')->assertMissing($thumbPath);
});
