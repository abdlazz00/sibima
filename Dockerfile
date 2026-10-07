# syntax=docker/dockerfile:1

FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --ignore-platform-reqs
COPY . .
RUN composer dump-autoload --no-dev --optimize --no-scripts

FROM node:24-alpine AS assets
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
COPY --from=vendor /app/vendor ./vendor
RUN npm run build

FROM php:8.4-fpm-alpine AS app
RUN apk add --no-cache libpng-dev libjpeg-turbo-dev freetype-dev libzip-dev icu-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j2 pdo_mysql gd zip bcmath intl exif opcache pcntl
COPY docker/php.ini /usr/local/etc/php/conf.d/zz-app.ini
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
WORKDIR /var/www/html
COPY --chown=www-data:www-data . .
COPY --from=vendor --chown=www-data:www-data /app/vendor ./vendor
COPY --from=assets --chown=www-data:www-data /app/public/build ./public/build
RUN mkdir -p storage/app/public storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache
USER www-data
ENTRYPOINT ["/entrypoint.sh"]
CMD ["php-fpm"]

FROM nginx:1.27-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=app /var/www/html/public /var/www/html/public
RUN rm -rf /var/www/html/public/storage \
    && ln -s ../storage/app/public /var/www/html/public/storage
