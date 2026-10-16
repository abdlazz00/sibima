import '../css/app.css';

import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-aria-components';

const appName = import.meta.env.VITE_APP_NAME || 'SIBIMA';

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.tsx`,
            import.meta.glob('./Pages/**/*.tsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(
            <RouterProvider navigate={(to) => router.visit(to as string)}>
                <App {...props} />
            </RouterProvider>,
        );
    },
    progress: {
        color: '#4B5563',
    },
});
