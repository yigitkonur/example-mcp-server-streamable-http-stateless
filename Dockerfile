# =========================================================================
# Stage 1: Builder
# This stage installs dependencies and builds the TypeScript source code.
# =========================================================================
FROM node:20-alpine AS builder

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first to leverage Docker's layer caching.
# If these files don't change, Docker won't re-install dependencies.
COPY package*.json ./

# Install dependencies using 'npm ci' which is faster and more reliable for
# CI/CD environments as it uses the package-lock.json file.
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Compile TypeScript to JavaScript. This assumes you have a "build" script
# in your package.json (e.g., "build": "tsc").
RUN npm run build

# =========================================================================
# Stage 2: Production
# This stage creates the final, lean production image.
# =========================================================================
FROM node:20-alpine AS production

# Set the environment to production. This can improve performance for
# some libraries (like Express) and disables certain development features.
ENV NODE_ENV=production

# Set the working directory
WORKDIR /usr/src/app

# Copy only the necessary files from the 'builder' stage.
# This is the key to a small and secure image. We are NOT copying the
# entire source code, only the compiled output and production dependencies.
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist

# Expose the port the app runs on. Your server uses 1071.
# This is documentation for the user and for tools like Docker Compose.
EXPOSE 1071

# Define the command to run your application.
# We run the compiled JavaScript file from the 'dist' directory.
CMD ["node", "dist/server.js"]