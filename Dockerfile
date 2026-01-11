# Use a base image that includes build tools
FROM node:18

# Install Python, GCC, and basic build tools
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# We remove scipy and matplotlib as they are very heavy
RUN pip3 install --no-cache-dir numpy pandas requests

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["node", "index.js"]