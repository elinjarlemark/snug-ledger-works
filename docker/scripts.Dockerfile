FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json ./
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-docx && rm -rf /var/lib/apt/lists/*
COPY server ./server
EXPOSE 5050
CMD ["node", "server/index.js"]
