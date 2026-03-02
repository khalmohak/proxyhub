FROM node:20-alpine

# Build tools needed for better-sqlite3 native compilation on Alpine
RUN apk add --no-cache curl python3 make g++

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --production

COPY src ./src

EXPOSE 3000 8080

CMD ["node", "src/index.js"]
