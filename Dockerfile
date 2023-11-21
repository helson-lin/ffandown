FROM centos:7
COPY ./dist/ffandown-linuxstatic-x64 /app/
workdir /app
CMD chmod +x ffandown-linuxstatic-x64
EXPOSE 8081

ENTRYPOINT ["./ffandown-linuxstatic-x64"]