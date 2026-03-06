# Use official Node.js runtime
FROM node:18-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY server/ ./server/
COPY public/ ./public/
COPY config.json ./

# Create data directories (files will be fetched from GCS at runtime)
RUN mkdir -p data/nei data/adi data/boundaries data_cache

# Expose port (Cloud Run will set PORT env variable automatically)
EXPOSE 8080

# Start server
CMD ["node", "server/server.js"]
