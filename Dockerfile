FROM node:18

# Install Python and GCC
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install ONLY small, essential packages to avoid memory crashes
RUN pip3 install --no-cache-dir requests numpy

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["node", "index.js"]