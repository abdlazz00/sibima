import { Button } from '@/Components/ui/base/buttons/button';
import { Checkbox } from '@/Components/ui/base/checkbox/checkbox';
import { Input } from '@/Components/ui/base/input/input';
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

            <h1 className="mb-7 text-[28px] font-bold tracking-tight text-gray-900">Masuk</h1>

            {status && (
                <div className="mb-5 rounded-lg border border-green-200 bg-green-50 p-3.5 text-sm font-medium text-green-700">
                    {status}
                </div>
            )}

            <form onSubmit={submit} className="space-y-5">
                <Input
                    label="Email / NIP"
                    name="email"
                    size="lg"
                    autoComplete="username"
                    autoFocus
                    isRequired
                    hideRequiredIndicator
                    placeholder="Masukkan email atau NIP"
                    value={data.email}
                    onChange={(v) => setData('email', v)}
                    isInvalid={Boolean(errors.email)}
                    hint={errors.email}
                />

                <Input
                    label="Kata Sandi"
                    name="password"
                    type="password"
                    size="lg"
                    autoComplete="current-password"
                    isRequired
                    hideRequiredIndicator
                    placeholder="••••••••"
                    value={data.password}
                    onChange={(v) => setData('password', v)}
                    isInvalid={Boolean(errors.password)}
                    hint={errors.password}
                />

                <div className="flex items-center justify-between pt-1">
                    <Checkbox
                        name="remember"
                        label="Ingat saya"
                        isSelected={data.remember}
                        onChange={(checked) => setData('remember', checked)}
                    />

                    {canResetPassword && (
                        <Link
                            href={route('password.request')}
                            className="rounded-sm text-sm font-medium text-blue-800 hover:text-blue-700 hover:underline focus:outline-hidden focus:ring-2 focus:ring-blue-800 focus:ring-offset-1"
                        >
                            Lupa kata sandi?
                        </Link>
                    )}
                </div>

                <div className="pt-2">
                    <Button type="submit" color="primary" size="lg" className="w-full" isLoading={processing}>
                        Masuk
                    </Button>
                </div>
            </form>
        </AuthSplitLayout>
    );
}
