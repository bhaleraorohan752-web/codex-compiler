FROM node:18

# Install Python and GCC
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Fix for PEP 668: Added --break-system-packages flag
RUN pip3 install --no-cache-dir --break-system-packages requests numpy

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["node", "index.js"]