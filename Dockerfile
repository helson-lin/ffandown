FROM ubuntu:18.04
COPY ./dist/ffandown-linux-x64 /app/
WORKDIR /app
CMD chmod +x ffandown-linux-x64
EXPOSE 8081

ENTRYPOINT ["./ffandown-linux-x64"]