FROM mcr.microsoft.com/devcontainers/typescript-node:1-22-bookworm

# Keep PNPM_HOME in PATH for the non-root dev user.
ENV PNPM_HOME=/home/node/.local/share/pnpm
ENV PATH=${PNPM_HOME}:${PATH}

# Prepare pnpm via corepack so the version in packageManager can be used.
RUN corepack enable
