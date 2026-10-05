import { PropsWithChildren } from 'react';

/** Tata letak dua panel untuk halaman guest (Masuk, Lupa & Atur Ulang Kata Sandi). */
export default function AuthSplitLayout({ children }: PropsWithChildren) {
    return (
        <div className="flex min-h-screen flex-col bg-white selection:bg-blue-600 selection:text-white md:flex-row">
            {/* Left Panel - Visual Branding (Desktop) */}
            <div
                role="img"
                aria-label="SIBIMA - Sistem Informasi Barang Milik Daerah Kecamatan Sagulung"
                className="relative hidden min-h-screen select-none bg-cover bg-center bg-no-repeat md:flex md:w-1/2"
                style={{ backgroundImage: "url('/images/login-left.png')" }}
            />

            {/* Right Panel - Form */}
            <div className="flex min-h-screen w-full flex-col items-center justify-center bg-white px-6 py-12 sm:px-12 md:w-1/2 lg:px-16">
                {/* Mobile Header Branding */}
                <div className="mb-8 flex flex-col items-center text-center md:hidden">
                    <img
                        src="/images/lambang-kota-batam.png"
                        alt="Lambang Kota Batam"
                        className="mb-3 h-16 w-auto object-contain"
                    />
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                        SIBIMA
                    </h1>
                    <p className="mt-1 text-xs text-gray-500">
                        Sistem Informasi Barang Milik Daerah &bull; Kecamatan
                        Sagulung
                    </p>
                </div>

                <div className="w-full max-w-[400px]">{children}</div>
            </div>
        </div>
    );
}
