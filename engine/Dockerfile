FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev dependencies for building)
RUN npm install

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Copy JavaScript files that aren't compiled by TypeScript to dist
# TypeScript only compiles .ts files, so we need to manually copy .js files
# Exclude test files
RUN find src -name "*.js" -type f ! -name "test-*.js" | while read file; do \
      rel_path=$(echo "$file" | sed 's|^src/||'); \
      mkdir -p "dist/$(dirname "$rel_path")"; \
      cp "$file" "dist/$rel_path"; \
    done

# Remove dev dependencies and source files
RUN npm prune --production
RUN rm -rf src tsconfig.json

# Run the engine
CMD ["node", "dist/index.js"]

