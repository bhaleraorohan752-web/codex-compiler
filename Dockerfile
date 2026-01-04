# 1. Use an official Node.js image as the base
FROM node:18

# 2. Install compilers (GCC for C/C++, Default JDK for Java, Python is already in Node image)
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    default-jdk \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# 3. Create app directory
WORKDIR /app

# 4. Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# 5. Copy the rest of your backend code
COPY . .

# 6. Expose the port your server runs on
EXPOSE 5000

# 7. Start the server
CMD ["node", "index.js"]