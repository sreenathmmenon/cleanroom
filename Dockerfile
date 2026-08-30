# Cleanroom — TrueForge with the Cleanroom agent pre-seeded.
#
# Runs TrueForge in standalone mode (SQLite, no Postgres/Redis) and seeds the
# agent, its skill, and its providers on boot, so a judge opening the URL finds
# Cleanroom already in the Agents Library.
#
# Standalone mode is the only mode that keeps this to a single container. It
# also means TrueForge's own OIDC login is unavailable — see DEPLOY.md for what
# that implies and how the instance is scoped.
FROM node:22-slim

WORKDIR /app

# TrueForge is installed from npm rather than built from source: the published
# package ships dist/, so there is nothing to compile.
RUN npm install --omit=dev @truefoundry/trueforge@0.1.4 && npm cache clean --force

# Seeding scripts and the agent definition. The corpora come too, so the demo
# datasets are servable from the same origin.
COPY package.json ./
COPY scripts/ ./scripts/
COPY agent/ ./agent/
COPY skills/ ./skills/
COPY data/ ./data/
COPY docker-entrypoint.sh ./

RUN chmod +x docker-entrypoint.sh

# HOST=0.0.0.0 so the platform's router can reach the process; the default is
# localhost, which would make the deploy silently unreachable.
ENV NODE_ENV=production \
    STANDALONE=true \
    HOST=0.0.0.0 \
    PORT=8790

EXPOSE 8790

CMD ["./docker-entrypoint.sh"]
