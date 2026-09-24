// Placeholder brand mark; swap icon + name once the client delivers the official logo/app name (Sprint 5).
export default function BrandMark({ className = '' }: { className?: string }) {
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                className="h-8 w-8 text-blue-600"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1"
                />
            </svg>
            <span className="text-lg font-semibold text-gray-800">SIMASET</span>
        </div>
    );
}
