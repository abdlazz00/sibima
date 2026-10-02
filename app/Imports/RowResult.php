<?php

namespace App\Imports;

final class RowResult
{
    public const BARU = 'baru';

    public const DUPLIKAT = 'duplikat';

    public const ERROR = 'error';

    /**
     * @param  array<string, mixed>  $data
     * @param  list<array{kolom: string, alasan: string}>  $errors
     */
    private function __construct(
        public readonly string $status,
        public readonly array $data = [],
        public readonly array $errors = [],
        public readonly ?string $warning = null,
    ) {}

    /** @param array<string, mixed> $data */
    public static function baru(array $data, ?string $warning = null): self
    {
        return new self(self::BARU, $data, [], $warning);
    }

    public static function duplikat(): self
    {
        return new self(self::DUPLIKAT);
    }

    /** @param list<array{kolom: string, alasan: string}> $errors */
    public static function error(array $errors): self
    {
        return new self(self::ERROR, [], $errors);
    }
}
