# memorybank

Persistent cross-session memory for AI agents. Your AI agent forgets everything between sessions — memorybank fixes that.

Works with any MCP-compatible AI tool: Claude Code, Cursor, Windsurf, and more.

## Quick Start

```bash
# Use directly with npx (zero install)
npx @ura-dev/memorybank --help

# Or install globally
npm install -g @ura-dev/memorybank
```

### As MCP Server

Add to your Claude Code config (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "memorybank": {
      "command": "npx",
      "args": ["-y", "@ura-dev/memorybank", "memorybank-mcp"]
    }
  }
}
```

Or in Cursor/VS Code (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "memorybank": {
      "command": "npx",
      "args": ["-y", "@ura-dev/memorybank", "memorybank-mcp"]
    }
  }
}
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `memory_store` | Save a new memory (user, project, feedback, reference, custom) |
| `memory_recall` | Retrieve the most relevant memories for a query |
| `memory_list` | List all memories, filter by type or tag |
| `memory_get` | Get a specific memory by ID |
| `memory_update` | Update an existing memory |
| `memory_delete` | Delete a memory |
| `memory_search` | Full-text search across all memories |
| `memory_stats` | Statistics about stored memories |

## CLI Usage

```bash
# Store a memory
memorybank store user "team-lead" "User is the team lead for the backend services team"

# Recall relevant memories
memorybank recall "user role"

# Search
memorybank search "TypeScript"

# List all memories
memorybank list
memorybank list --type=feedback

# Get a specific memory
memorybank get abc123def456

# Delete
memorybank delete abc123def456

# Stats
memorybank stats

# Use namespaces for project isolation
memorybank store project "api-rewrite" "Migrating from REST to GraphQL" --namespace=myproject
```

## Memory Types

- **user** — About the person: role, preferences, expertise
- **project** — About the work: goals, decisions, architecture
- **feedback** — Corrections and validated approaches
- **reference** — Pointers to external resources
- **custom** — Anything else

## How It Works

- **Zero dependencies** — uses only Node.js built-in modules
- **File-based storage** — each memory is a markdown file with YAML frontmatter
- **Auto-indexed** — fast lookups via maintained index
- **Namespaced** — separate memory banks per project
- **Secure** — path traversal protection, input validation

Storage location: `~/.memorybank/` (override with `MEMORYBANK_DIR` env var)

## Programmatic API

```javascript
const mb = require('@ura-dev/memorybank');

// Store
const { id } = mb.store({ name: 'api key location', type: 'reference', content: 'API keys are in .env.local' });

// Recall
const memories = mb.recall('api keys');

// Search
const results = mb.search('TypeScript');
```

## Why memorybank?

AI coding agents are powerful but stateless. Every new session starts from zero. memorybank gives your agent persistent memory:

- **Remembers your preferences** across sessions
- **Tracks project decisions** so the agent doesn't re-ask
- **Stores corrections** so mistakes aren't repeated
- **Saves references** to external resources

Think of it as a knowledge base that your AI agent builds and queries automatically.

## License

MIT
