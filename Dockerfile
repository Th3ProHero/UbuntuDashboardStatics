# Stage 1: Build the client
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Build the server
FROM node:20-alpine AS server-build
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server/ ./
RUN npx tsc

# Stage 3: Production Image
FROM node:20-alpine
WORKDIR /app

# Install docker client inside the container (optional, but dockerode talks to socket)
# dockerode just needs the socket mounted.

COPY --from=client-build /app/client/dist /app/client/dist
COPY --from=server-build /app/server/package*.json /app/server/
COPY --from=server-build /app/server/node_modules /app/server/node_modules
COPY --from=server-build /app/server/dist /app/server/dist

WORKDIR /app/server

ENV PORT=9091
EXPOSE 9091

CMD ["node", "dist/index.js"]
