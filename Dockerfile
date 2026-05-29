FROM nginx:alpine

COPY index.html /usr/share/nginx/html/index.html
COPY audio /usr/share/nginx/html/audio
COPY data /usr/share/nginx/html/data
COPY flags /usr/share/nginx/html/flags

EXPOSE 80
