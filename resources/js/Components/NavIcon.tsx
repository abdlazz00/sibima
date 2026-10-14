import {
    AlertTriangle,
    BarChart01,
    CheckSquare,
    Download01,
    File05,
    Grid01,
    LayersThree01,
    Package,
    QrCode01,
    Settings01,
    Shield01,
    Shuffle01,
    Users01,
} from '@untitledui/icons';
import { FC } from 'react';

const ICONS: Record<string, FC<{ className?: string }>> = {
    grid: Grid01,
    package: Package,
    'qr-code': QrCode01,
    layers: LayersThree01,
    users: Users01,
    download: Download01,
    shuffle: Shuffle01,
    'check-square': CheckSquare,
    'file-text': File05,
    'alert-triangle': AlertTriangle,
    'bar-chart': BarChart01,
    settings: Settings01,
    shield: Shield01,
};

interface NavIconProps {
    name: string;
    className?: string;
}

export default function NavIcon({
    name,
    className = 'h-[18px] w-[18px]',
}: NavIconProps) {
    const Icon = ICONS[name];

    return Icon ? <Icon className={className} aria-hidden="true" /> : null;
}
