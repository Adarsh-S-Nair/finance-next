FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Remove dev dependencies and source files
RUN npm prune --production
RUN rm -rf src tsconfig.json

# Run the engine
CMD ["node", "dist/index.js"]

