'use strict';

const store = require('./store');

const TOOLS = [
  {
    name: 'memory_store',
    description: 'Store a new memory. Use this to save information that should persist across sessions — user preferences, project context, decisions, references.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Short name for this memory (e.g. "user prefers TypeScript")' },
        type: { type: 'string', enum: ['user', 'project', 'feedback', 'reference', 'custom'], description: 'Memory type: user (about the person), project (about the work), feedback (corrections/preferences), reference (external pointers), custom' },
        content: { type: 'string', description: 'The memory content — what to remember' },
        description: { type: 'string', description: 'One-line description for indexing and recall' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags for categorization' },
        namespace: { type: 'string', description: 'Project namespace (default: "default"). Use to separate memories by project.' }
      },
      required: ['name', 'type', 'content']
    }
  },
  {
    name: 'memory_recall',
    description: 'Recall memories matching a query. Returns full content of the most relevant memories. Use this at the start of a session to load relevant context.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to search for (e.g. "user preferences", "auth architecture")' },
        namespace: { type: 'string', description: 'Project namespace (default: "default")' },
        limit: { type: 'number', description: 'Max results (default: 5)' }
      },
      required: ['query']
    }
  },
  {
    name: 'memory_list',
    description: 'List stored memories. Optionally filter by type or tag.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['user', 'project', 'feedback', 'reference', 'custom'], description: 'Filter by memory type' },
        tag: { type: 'string', description: 'Filter by tag' },
        namespace: { type: 'string', description: 'Project namespace (default: "default")' },
        limit: { type: 'number', description: 'Max results (default: 50)' }
      }
    }
  },
  {
    name: 'memory_get',
    description: 'Get a specific memory by its ID. Returns full content.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Memory ID (12-char hex)' },
        namespace: { type: 'string', description: 'Project namespace (default: "default")' }
      },
      required: ['id']
    }
  },
  {
    name: 'memory_update',
    description: 'Update an existing memory. Only provided fields are changed.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Memory ID to update' },
        name: { type: 'string', description: 'New name' },
        type: { type: 'string', enum: ['user', 'project', 'feedback', 'reference', 'custom'], description: 'New type' },
        content: { type: 'string', description: 'New content' },
        description: { type: 'string', description: 'New description' },
        tags: { type: 'array', items: { type: 'string' }, description: 'New tags' },
        namespace: { type: 'string', description: 'Project namespace (default: "default")' }
      },
      required: ['id']
    }
  },
  {
    name: 'memory_delete',
    description: 'Delete a memory by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Memory ID to delete' },
        namespace: { type: 'string', description: 'Project namespace (default: "default")' }
      },
      required: ['id']
    }
  },
  {
    name: 'memory_search',
    description: 'Full-text search across all memories. Returns matches ranked by relevance.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        namespace: { type: 'string', description: 'Project namespace (default: "default")' },
        limit: { type: 'number', description: 'Max results (default: 20)' }
      },
      required: ['query']
    }
  },
  {
    name: 'memory_stats',
    description: 'Get statistics about stored memories — counts by type, total size.',
    inputSchema: {
      type: 'object',
      properties: {
        namespace: { type: 'string', description: 'Project namespace (default: "default")' }
      }
    }
  }
];

function handleToolCall(name, args) {
  switch (name) {
    case 'memory_store':
      return store.store(args);
    case 'memory_recall':
      return store.recall(args.query, args);
    case 'memory_list':
      return store.list(args);
    case 'memory_get': {
      const mem = store.get(args.id, args.namespace);
      if (!mem) return { error: `Memory ${args.id} not found` };
      return mem;
    }
    case 'memory_update':
      return store.update(args.id, args);
    case 'memory_delete':
      return store.remove(args.id, args.namespace);
    case 'memory_search':
      return store.search(args.query, args);
    case 'memory_stats':
      return store.stats(args.namespace);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// JSON-RPC stdio transport
let buffer = '';

function send(obj) {
  const msg = JSON.stringify(obj);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(msg)}\r\n\r\n${msg}`);
}

function sendResponse(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function sendError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

function handleMessage(raw) {
  let req;
  try { req = JSON.parse(raw); } catch (e) { process.stderr.write(`bad JSON-RPC: ${e.message}\n`); return; }

  const { id, method, params } = req;

  switch (method) {
    case 'initialize':
      sendResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'memorybank', version: '1.0.0' }
      });
      break;

    case 'notifications/initialized':
      break;

    case 'tools/list':
      sendResponse(id, { tools: TOOLS });
      break;

    case 'tools/call': {
      const { name, arguments: args } = params || {};
      try {
        const result = handleToolCall(name, args || {});
        const hasError = result && result.error;
        sendResponse(id, {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: !!hasError
        });
      } catch (e) {
        sendResponse(id, {
          content: [{ type: 'text', text: JSON.stringify({ error: e.message }) }],
          isError: true
        });
      }
      break;
    }

    case 'ping':
      sendResponse(id, {});
      break;

    default:
      if (id) sendError(id, -32601, `Method not found: ${method}`);
  }
}

function parseMessages() {
  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) break;

    const header = buffer.substring(0, headerEnd);
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) { buffer = buffer.substring(headerEnd + 4); continue; }

    const len = parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    if (buffer.length < bodyStart + len) break;

    const body = buffer.substring(bodyStart, bodyStart + len);
    buffer = buffer.substring(bodyStart + len);
    handleMessage(body);
  }
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { buffer += chunk; parseMessages(); });
process.stdin.on('end', () => process.exit(0));

process.stderr.write('memorybank MCP server running on stdio\n');
