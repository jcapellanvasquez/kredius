FROM node:24-alpine AS build
ENV NODE_ENV=development
WORKDIR /app
COPY . .
RUN npm install
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
