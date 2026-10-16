# build stage
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# production stage
FROM nginx:stable as production

# Copia os arquivos do build React
COPY --from=build /app/build /usr/share/nginx/html

# Templates do nginx (o entrypoint gera a configuração final com o proxy do Chatwoot)
COPY ./dockerizer/nginx.conf.template ./dockerizer/chatwoot-proxy.conf.template /etc/nginx/templates-kbw/

# Copia o script de entrypoint que injeta variáveis de ambiente
COPY ./dockerizer/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expõe a porta usada pelo nginx
EXPOSE 3000

# Usa o script de entrypoint para iniciar o container
ENTRYPOINT ["/entrypoint.sh"]
#CMD ["nginx", "-g", "daemon off;"] 
