import { useState } from 'react';

const EyeIcon = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
    >
        <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

const EyeOffIcon = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
    >
        <path d="m2 2 20 20" />
        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    </svg>
);

export default function PasswordInput({
    id,
    name,
    value,
    onChange,
    autoComplete,
    placeholder = '••••••••',
    autoFocus,
    required = true,
}: {
    id: string;
    name: string;
    value: string;
    onChange: (value: string) => void;
    autoComplete: string;
    placeholder?: string;
    autoFocus?: boolean;
    required?: boolean;
}) {
    const [show, setShow] = useState(false);

    return (
        <div className="relative">
            <input
                id={id}
                type={show ? 'text' : 'password'}
                name={name}
                value={value}
                autoComplete={autoComplete}
                autoFocus={autoFocus}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                className="h-11 w-full rounded-lg border border-gray-300 bg-white pl-3.5 pr-11 text-sm text-gray-900 transition placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-600"
                required={required}
            />
            <button
                type="button"
                onClick={() => setShow(!show)}
                aria-label={
                    show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'
                }
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600 focus:outline-none"
            >
                {show ? (
                    <EyeOffIcon className="h-5 w-5" />
                ) : (
                    <EyeIcon className="h-5 w-5" />
                )}
            </button>
        </div>
    );
}
