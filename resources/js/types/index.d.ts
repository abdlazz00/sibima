export interface AuthUser {
    id: number;
    name: string;
    email: string;
    roles: string[];
    unit: { id: number; name: string; type: 'kecamatan' | 'kelurahan' } | null;
}

export interface AssetCategory {
    id: number;
    name: string;
    parent_id: number | null;
    assets_count?: number;
    children?: AssetCategory[];
    parent?: AssetCategory | null;
}

export interface Flash {
    success: string | null;
    error: string | null;
}

export type PageProps<
    T extends Record<string, unknown> = Record<string, unknown>,
> = T & {
    auth: {
        user: AuthUser | null;
    };
    flash: Flash;
};
