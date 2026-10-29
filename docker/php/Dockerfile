# Imagem de desenvolvimento (PHP-FPM). OPcache valida timestamps para recarregar o código a cada alteração.
FROM php:8.4-fpm-alpine

RUN apk add --no-cache \
        bash git curl zip unzip mysql-client tzdata \
        icu-dev oniguruma-dev libzip-dev \
        libpng-dev libjpeg-turbo-dev libwebp-dev freetype-dev \
        autoconf build-base linux-headers \
    && docker-php-ext-configure gd --with-jpeg --with-webp --with-freetype \
    && docker-php-ext-install pdo pdo_mysql mbstring intl bcmath zip gd exif pcntl opcache \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && apk del autoconf build-base linux-headers

ENV TZ=America/Sao_Paulo
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY docker/php/php.ini /usr/local/etc/php/conf.d/zz-app.ini
COPY docker/php/opcache-dev.ini /usr/local/etc/php/conf.d/zz-opcache.ini

ARG UID=1000
ARG GID=1000
# /var/www/html/vendor é o ponto de montagem do volume php_vendor: o volume novo herda este dono.
RUN addgroup -g ${GID} app 2>/dev/null || true \
    && adduser -D -s /bin/sh -u ${UID} -G $(getent group ${GID} | cut -d: -f1) app \
    && mkdir -p /var/app/storage/uploads && chown -R ${UID}:${GID} /var/app \
    && mkdir -p /var/www/html/vendor && chown ${UID}:${GID} /var/www/html/vendor

WORKDIR /var/www/html
USER app

EXPOSE 9000
CMD ["php-fpm"]
