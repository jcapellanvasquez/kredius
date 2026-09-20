FROM node:20-alpine AS build
ENV NODE_ENV=development
WORKDIR /app
COPY . .
RUN echo "=== NODE_ENV: $NODE_ENV ===" && \
    echo "=== npm version ===" && npm --version && \
    echo "=== node version ===" && node --version
RUN rm -rf node_modules && npm install
RUN echo "=== @angular/cli installed? ===" && \
    ls node_modules/@angular/cli/ 2>&1 | head -10 || echo "NOT FOUND" && \
    echo "=== .bin/ng exists? ===" && \
    ls -la node_modules/.bin/ng 2>&1 || echo "ng NOT in .bin"
RUN npm run build -- --configuration=production

FROM nginx:alpine
RUN addgroup -S kredius && adduser -S kredius -G kredius \
    && mkdir -p /var/cache/nginx /var/run/nginx \
    && chown -R kredius:kredius /var/cache/nginx /var/run/nginx /etc/nginx/conf.d
COPY --from=build /app/dist/ui/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN chown -R kredius:kredius /usr/share/nginx/html
USER kredius
EXPOSE 8080
