import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';
import preline from 'preline/plugin';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './storage/framework/views/*.php',
        './resources/views/**/*.blade.php',
        './resources/js/**/*.tsx',
        './node_modules/preline/dist/*.js',
    ],
    theme: {
        extend: {
            colors: {
                // Sapphire (PANDUAN_DESAIN_UI_UX_SIBIMA.md 2.1)
                primary: { DEFAULT: '#1E40AF', hover: '#1D4ED8', dark: '#172554' },
            },
            fontFamily: {
                sans: ['Figtree', ...defaultTheme.fontFamily.sans],
            },
        },
    },
    plugins: [forms, preline],
};
