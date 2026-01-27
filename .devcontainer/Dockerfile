# Taskinfa-Bot Development Container

FROM node:20-bullseye

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    vim \
    nano \
    less \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Set up workspace
WORKDIR /workspace

# Use node user (comes with the node image)
USER node

# Keep container running
CMD ["sleep", "infinity"]
