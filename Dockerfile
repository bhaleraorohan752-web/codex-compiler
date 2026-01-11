# Use a base image that includes build tools
FROM node:18

# Install Python and GCC (for C/C++)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install popular Python libraries
RUN pip3 install --no-cache-dir \
    numpy \
    pandas \
    requests \
    matplotlib \
    scipy

# Rest of your Dockerfile (COPY, EXPOSE, CMD)
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["node", "index.js"]