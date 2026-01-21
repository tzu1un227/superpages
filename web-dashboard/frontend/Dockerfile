# Build Stage
FROM node:18-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# ARGS for build time environment variables
ARG REACT_APP_API_BASE_URL
ENV REACT_APP_API_BASE_URL=$REACT_APP_API_BASE_URL
ARG REACT_APP_GOOGLE_CLIENT_ID
ENV REACT_APP_GOOGLE_CLIENT_ID=$REACT_APP_GOOGLE_CLIENT_ID
RUN echo "DEBUG: Building with REACT_APP_GOOGLE_CLIENT_ID=${REACT_APP_GOOGLE_CLIENT_ID}"

# Ensure build environment variables take precedence over any local .env files
RUN rm -f .env .env.local .env.production .env.development

RUN npm run build

# Production Stage
FROM nginx:alpine

# Copy build artifacts from previous stage
COPY --from=build /app/build /usr/share/nginx/html

# Copy custom nginx configuration template
COPY nginx.conf.template /etc/nginx/conf.d/nginx.conf.template

# Remove default nginx config to be safe
RUN rm /etc/nginx/conf.d/default.conf

EXPOSE 80

# Use shell to run envsubst and then start nginx
CMD ["/bin/sh", "-c", "envsubst '${FRONTEND_PORT} ${BACKEND_PORT}' < /etc/nginx/conf.d/nginx.conf.template > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]
