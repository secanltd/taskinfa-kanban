# Taskinfa-Bot Docker Container
# Based on Claude Code devcontainer with additional security and isolation

FROM node:20-bullseye

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    procps \
    sudo \
    fzf \
    zsh \
    iptables \
    ipset \
    iproute2 \
    dnsutils \
    jq \
    nano \
    vim \
    less \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Create non-root user
RUN useradd -m -s /bin/bash botuser && \
    mkdir -p /workspace && \
    chown -R botuser:botuser /workspace

# Copy bot application files
WORKDIR /app
COPY --chown=botuser:botuser packages/bot/dist ./bot
COPY --chown=botuser:botuser packages/shared/dist ./shared
COPY --chown=botuser:botuser packages/dashboard/dist/lib/mcp ./mcp

# Copy firewall script
COPY scripts/bot-firewall.sh /usr/local/bin/bot-firewall.sh
RUN chmod +x /usr/local/bin/bot-firewall.sh && \
    echo "botuser ALL=(ALL) NOPASSWD: /usr/local/bin/bot-firewall.sh" >> /etc/sudoers

# Set working directory for bot execution
WORKDIR /workspace

# Switch to non-root user
USER botuser

# Default entrypoint: initialize firewall (as root via sudo) then run bot
ENTRYPOINT ["sudo", "/usr/local/bin/bot-firewall.sh"]
CMD ["node", "/app/bot/index.js", "run", "--dangerously-skip-permissions"]
