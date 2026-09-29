<?php

namespace App\Contracts;

interface Approvable
{
    public function approvalTitle(): string;

    public function approvalShowUrl(): string;
}
