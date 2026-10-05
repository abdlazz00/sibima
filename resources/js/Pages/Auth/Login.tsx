import InputError from '@/Components/InputError';
import PasswordInput from '@/Components/PasswordInput';
import AuthSplitLayout from '@/Layouts/AuthSplitLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

export default function Login({
    status,
    canResetPassword,
}: {
    status?: string;
    canResetPassword: boolean;
}) {
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false as boolean,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <AuthSplitLayout>
            <Head title="Masuk - SIBIMA" />

            <h1 className="mb-7 text-[28px] font-bold tracking-tight text-gray-900">
                Masuk
            </h1>

            {status && (
                <div className="mb-5 rounded-lg border border-green-200 bg-green-50 p-3.5 text-sm font-medium text-green-700">
                    {status}
                </div>
            )}

            <form onSubmit={submit} className="space-y-5">
                {/* Email or NIP Field */}
                <div>
                    <label
                        htmlFor="email"
                        className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                        Email / NIP
                    </label>
                    <input
                        id="email"
                        type="text"
                        name="email"
                        value={data.email}
                        autoComplete="username"
                        autoFocus
                        placeholder="Masukkan email atau NIP"
                        onChange={(e) => setData('email', e.target.value)}
                        className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-gray-900 transition placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                        required
                    />
                    <InputError message={errors.email} className="mt-1.5" />
                </div>

                {/* Password Field */}
                <div>
                    <label
                        htmlFor="password"
                        className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                        Kata Sandi
                    </label>
                    <PasswordInput
                        id="password"
                        name="password"
                        value={data.password}
                        autoComplete="current-password"
                        onChange={(v) => setData('password', v)}
                    />
                    <InputError message={errors.password} className="mt-1.5" />
                </div>

                {/* Remember Me & Forgot Password Row */}
                <div className="flex items-center justify-between pt-1">
                    <label className="flex cursor-pointer select-none items-center">
                        <input
                            type="checkbox"
                            name="remember"
                            checked={data.remember}
                            onChange={(e) =>
                                setData('remember', e.target.checked as boolean)
                            }
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="ml-2 text-sm text-gray-600">
                            Ingat saya
                        </span>
                    </label>

                    {canResetPassword && (
                        <Link
                            href={route('password.request')}
                            className="rounded text-sm font-medium text-primary hover:text-primary-hover hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                        >
                            Lupa kata sandi?
                        </Link>
                    )}
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={processing}
                        className="flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-medium text-white shadow-sm transition hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 active:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {processing ? 'Memproses...' : 'Masuk'}
                    </button>
                </div>
            </form>
        </AuthSplitLayout>
    );
}
