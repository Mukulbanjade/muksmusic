# muksmusic-server container: pure Node + a self-contained yt-dlp binary.
# Debian slim (glibc) — required, since the yt-dlp standalone binary is a
# PyInstaller build that does not run on Alpine/musl.
FROM node:20-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux \
      -o /usr/local/bin/yt-dlp \
 && chmod +x /usr/local/bin/yt-dlp \
 && apt-get purge -y curl && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY src ./src
COPY package.json ./

# Hosts (Fly/Render/Railway) inject PORT; default to 8080.
ENV PORT=8080
EXPOSE 8080

CMD ["node", "src/index.js"]
