<<<<<<< HEAD
FROM ubuntu:16.04

# 维护者信息
MAINTAINER "ffandown"

# 创建文件夹app
RUN mkdir /app

ADD ./dist/ffandown-linux-x64 /app

WORKDIR /app

# 设置可执行权限
RUN chmod +x ffandown-linux-x64

# 设置默认命令
CMD ["./ffandown-linux-x64"]

=======
FROM ubuntu:18.04
COPY ./dist/ffandown-linux-x64 /app/
workdir /app
CMD chmod +x ffandown-linux-x64
>>>>>>> refactor/devorce
EXPOSE 8081

ENTRYPOINT ["./ffandown-linux-x64"]