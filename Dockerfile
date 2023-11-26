FROM centos:7
COPY ./dist/ffandown-linux-x64 /app/
workdir /app
CMD chmod +x ffandown-linux-x64
EXPOSE 8081

ENTRYPOINT ["./ffandown-linux-x64"]