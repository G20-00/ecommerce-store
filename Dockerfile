FROM node:20-alpine3.18 AS base

ENV DIR /project
WORKDIR $DIR
ARG NPM_TOKEN

FROM base AS build

RUN apk update && apk add --no-cache dumb-init=1.2.5-r2

COPY . $DIR
RUN echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" > "$DIR/.npmrc" && \
  npm install --frozen-lockfile && \
  rm -f .npmrc

RUN npm run build
RUN npm prune --prod --config.ignore-scripts=true

FROM base AS production

ENV NODE_ENV=production
ENV USER=node

COPY --from=build /usr/bin/dumb-init /usr/bin/dumb-init
COPY --from=build $DIR $DIR

USER $USER
EXPOSE 3001
CMD ["npm", "start"]