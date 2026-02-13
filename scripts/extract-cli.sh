#!/bin/bash
# Extract the CLI script from install.sh heredoc into a standalone file.
# Used during the release process to create the taskinfa-cli.sh asset.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INPUT="$SCRIPT_DIR/install.sh"
OUTPUT="${1:-$SCRIPT_DIR/../dist/taskinfa-cli.sh}"

mkdir -p "$(dirname "$OUTPUT")"

# Extract everything between the EOFCLI heredoc markers
sed -n '/^cat > "\$TASKINFA_HOME\/bin\/taskinfa" << '\''EOFCLI'\''$/,/^EOFCLI$/{ /^cat /d; /^EOFCLI$/d; p; }' "$INPUT" > "$OUTPUT"

# Validate the output
if [ ! -s "$OUTPUT" ]; then
    echo "Error: extracted CLI is empty" >&2
    exit 1
fi

# Verify it starts with a shebang
if ! head -1 "$OUTPUT" | grep -q '^#!/bin/bash'; then
    echo "Error: extracted CLI does not start with shebang" >&2
    exit 1
fi

chmod +x "$OUTPUT"
echo "Extracted CLI to $OUTPUT ($(wc -l < "$OUTPUT") lines)"
