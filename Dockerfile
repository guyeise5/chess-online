FROM node:21 as dependencies
WORKDIR /app
COPY ./server/package.json /app/server/package.json
COPY ./client/package.json /app/client/package.json
RUN cd /app/server/ && npm i
RUN cd /app/client/ && npm i

#######################################
FROM node:21 as builder
WORKDIR /app
COPY . .
COPY --from=dependencies /app/server/node_modules /app/server/node_modules
COPY --from=dependencies /app/client/node_modules /app/client/node_modules
RUN cd server && npm run build

#########################################
FROM node:21

WORKDIR /app
COPY --from=dependencies /app/server/node_modules /app/server/node_modules
COPY --from=builder /app/server/build /app
CMD ["node", "/app/server/index.js"]

