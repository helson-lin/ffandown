FROM centos:7
COPY ./dist/ffandown-linux /app/
workdir /app
CMD chmod +x ffandown-linux
EXPOSE 8081

ENTRYPOINT ["./ffandown-linux"]