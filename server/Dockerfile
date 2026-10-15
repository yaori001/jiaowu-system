FROM node:20-alpine

WORKDIR /app

# 先装依赖，利用镜像层缓存
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# 再复制源码
COPY src ./src

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "src/index.js"]
