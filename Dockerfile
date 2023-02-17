FROM node:14
COPY . /app/
workdir /app
RUN npm config set registry https://registry.npm.taobao.org
RUN npm i cnpm -g
RUN cnpm i
EXPOSE 8081

ENTRYPOINT ["node", "index.js"]