FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN NODE_ENV=development npm ci
COPY . .
RUN node node_modules/@angular/cli/bin/ng.js build --configuration=production

FROM nginx:alpine
RUN addgroup -S kredius && adduser -S kredius -G kredius \
    && mkdir -p /var/cache/nginx /var/run/nginx \
    && chown -R kredius:kredius /var/cache/nginx /var/run/nginx /etc/nginx/conf.d
COPY --from=build /app/dist/ui/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN chown -R kredius:kredius /usr/share/nginx/html
USER kredius
EXPOSE 8080
