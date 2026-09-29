# Imagem de desenvolvimento — só Node + pnpm via corepack. O código-fonte
# entra por bind mount (docker-compose.yml), não por COPY, para o ciclo de
# dev não exigir rebuild de imagem a cada mudança de arquivo.
#
# Debian (não Alpine) de propósito: os engines binários do Prisma têm menos
# atrito com glibc do que com musl — evita uma categoria inteira de dor de
# cabeça de "funciona local, quebra no container" com Alpine.
FROM node:20-bookworm-slim

# libssl explícito: sem isso os engines do Prisma não detectam a versão do
# OpenSSL na imagem e caem num fallback (funciona, mas com warning a cada
# comando) — instalação explícita como o próprio Prisma recomenda.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /workspace

# Roda como o usuário "node" (uid/gid 1000, já vem na imagem oficial) em vez
# de root — qualquer arquivo criado no bind mount (migrations, coverage,
# caches) nasce com o dono certo no host, em vez de virar root e travar
# escrita fora do container.
RUN mkdir -p /home/node/.local/share/pnpm/store && chown -R node:node /home/node /workspace
USER node
ENV HOME=/home/node
