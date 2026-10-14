import { Button } from '@/Components/ui/base/buttons/button';
import { Input } from '@/Components/ui/base/input/input';
import AuthSplitLayout from '@/Layouts/AuthSplitLayout';
import { Head, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

export default function ConfirmPassword() {
    const { data, setData, post, processing, errors, reset } = useForm({
        password: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route('password.confirm'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <AuthSplitLayout>
            <Head title="Konfirmasi Kata Sandi - SIBIMA" />

            <h1 className="mb-2 text-[28px] font-bold tracking-tight text-gray-900">Konfirmasi Kata Sandi</h1>
            <p className="mb-7 text-sm text-gray-600">
                Ini adalah area aman aplikasi. Mohon konfirmasi kata sandi Anda sebelum melanjutkan.
            </p>

            <form onSubmit={submit} className="space-y-5">
                <Input
                    label="Kata Sandi"
                    name="password"
                    type="password"
                    size="lg"
                    autoComplete="current-password"
                    autoFocus
                    isRequired
                    hideRequiredIndicator
                    placeholder="••••••••"
                    value={data.password}
                    onChange={(v) => setData('password', v)}
                    isInvalid={Boolean(errors.password)}
                    hint={errors.password}
                />

                <Button type="submit" color="primary" size="lg" className="w-full" isLoading={processing}>
                    Konfirmasi
                </Button>
            </form>
        </AuthSplitLayout>
    );
}
