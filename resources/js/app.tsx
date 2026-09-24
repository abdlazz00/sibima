import '../css/app.css';
import 'preline/preline';

import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.tsx`,
            import.meta.glob('./Pages/**/*.tsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(<App {...props} />);

        // Preline's auto-init runs on script load, before React has painted
        // anything into `el` — re-run it once the initial page is actually
        // in the DOM, otherwise nothing on the first page view initializes.
        setTimeout(() => window.HSStaticMethods?.autoInit(), 0);
    },
    progress: {
        color: '#4B5563',
    },
});

router.on('navigate', () => {
    // Same race as above: 'navigate' fires as the visit resolves, before
    // React commits the new page's DOM, so defer to the next tick.
    setTimeout(() => window.HSStaticMethods?.autoInit(), 0);
});
