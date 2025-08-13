# Stage 1: Build the Vite React app
FROM node:22 AS build
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy all source code and build
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy built Vite files to Nginx web root
COPY --from=build /app/dist /usr/share/nginx/html

# Optional: custom Nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 for Render
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
