# Stage 1: Install Composer dependencies
FROM composer:2.8 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install \
    --no-dev \
    --no-interaction \
    --prefer-dist \
    --ignore-platform-reqs \
    --no-scripts

# Stage 2: Build frontend assets
FROM node:22-alpine AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Copy Ziggy files from vendor stage so tsc and vite can resolve it
COPY --from=vendor /app/vendor/tightenco/ziggy ./vendor/tightenco/ziggy
ENV VITE_APP_NAME="SIBIMA"
RUN npm run build

# Stage 3: Production PHP-FPM + Nginx + Supervisor
FROM php:8.4-fpm-bookworm AS production

WORKDIR /var/www/html

# Install required system packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    supervisor \
    cron \
    git \
    unzip \
    libzip-dev \
    libpng-dev \
    libjpeg62-turbo-dev \
    libfreetype6-dev \
    libicu-dev \
    && rm -rf /var/lib/apt/lists/*

# Configure & install PHP extensions for Laravel, QR Code, DomPDF & PhpSpreadsheet
RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
        pdo_mysql \
        zip \
        gd \
        bcmath \
        intl \
        exif \
        opcache \
        pcntl

# Install Composer CLI in production container
COPY --from=composer:2.8 /usr/bin/composer /usr/bin/composer

# Copy application source files
COPY . /var/www/html

# Copy vendor dependencies from vendor stage
COPY --from=vendor /app/vendor /var/www/html/vendor

# Copy compiled frontend assets from frontend stage
COPY --from=frontend /app/public/build /var/www/html/public/build

# Generate optimized autoloader for production
RUN composer dump-autoload --optimize --no-dev --no-scripts

# Copy container configurations
COPY docker/nginx.conf /etc/nginx/sites-available/default
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/php.ini /usr/local/etc/php/conf.d/custom.ini
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh

# Configure Laravel schedule runner via cron
RUN echo "* * * * * www-data php /var/www/html/artisan schedule:run >> /dev/null 2>&1" > /etc/cron.d/laravel-scheduler \
    && chmod 0644 /etc/cron.d/laravel-scheduler \
    && crontab -u www-data /etc/cron.d/laravel-scheduler

EXPOSE 80

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
