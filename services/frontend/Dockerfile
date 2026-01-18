FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# Устанавливаем зависимости + axios принудительно
RUN npm install
RUN npm install axios

COPY . .

EXPOSE 5173

# Запускаем в режиме разработки, доступном для внешнего мира
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]