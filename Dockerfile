FROM node:8.4.0-alpine

# Set a working directory
WORKDIR /usr/src/app

# Copy application files
COPY . .

EXPOSE 80
# Build
RUN yarn install --no-progress && yarn build && rm -rf node_modules
# Install Node.js dependencies
RUN yarn install --production --no-progress && yarn cache clean

CMD [ "node", "build/server.js" ]
