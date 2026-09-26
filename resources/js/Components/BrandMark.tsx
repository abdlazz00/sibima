export default function BrandMark({ className = '' }: { className?: string }) {
    return (
        <div className={`flex items-center gap-3 ${className}`}>
            <img
                src="/images/lambang-kota-batam.png"
                alt="Lambang Kota Batam"
                className="h-11 w-auto shrink-0 object-contain"
            />
            <div className="flex min-w-0 flex-col">
                <span className="text-base font-bold leading-tight tracking-tight text-white">
                    SIBIMA
                </span>
                <span className="truncate text-[10px] font-normal leading-tight text-slate-300">
                    Sistem Informasi Barang Milik Daerah
                </span>
                <span className="text-[10px] font-normal leading-tight text-slate-400">
                    Kecamatan Sagulung
                </span>
            </div>
        </div>
    );
}
