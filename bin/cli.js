#!/usr/bin/env node
'use strict';

const store = require('../lib/store');

const args = process.argv.slice(2);
const cmd = args[0];

function flag(name) {
  const f = args.find(a => a.startsWith(`--${name}=`));
  return f ? f.split('=').slice(1).join('=') : undefined;
}

function usage() {
  console.log(`memorybank — Persistent memory for AI agents

Usage:
  memorybank store <type> <name> <content>    Store a new memory
  memorybank recall <query>                   Recall relevant memories
  memorybank search <query>                   Search all memories
  memorybank list [--type=<type>]             List memories
  memorybank get <id>                         Get a specific memory
  memorybank delete <id>                      Delete a memory
  memorybank stats                            Show statistics
  memorybank namespaces                       List all namespaces

Options:
  --namespace=<ns>    Project namespace (default: "default")
  --type=<type>       Filter by type (user|project|feedback|reference|custom)
  --limit=<n>         Max results
  --format=json       Output as JSON

Environment:
  MEMORYBANK_DIR      Storage directory (default: ~/.memorybank)

MCP Server:
  memorybank-mcp      Run as MCP server (stdio transport)
`);
}

const ns = flag('namespace');
const fmt = flag('format');

function out(data) {
  if (fmt === 'json') {
    console.log(JSON.stringify(data, null, 2));
  } else if (Array.isArray(data)) {
    if (data.length === 0) { console.log('(no results)'); return; }
    for (const item of data) {
      const tags = item.tags && item.tags.length ? ` [${item.tags.join(', ')}]` : '';
      console.log(`  ${item.id}  ${item.type.padEnd(10)} ${item.name}${tags}`);
      if (item.description) console.log(`           ${item.description}`);
      if (item.content) console.log(`           ${item.content.slice(0, 120)}${item.content.length > 120 ? '...' : ''}`);
    }
  } else if (data && typeof data === 'object') {
    if (data.error) { console.error(`Error: ${data.error}`); process.exit(1); }
    if (data.content) {
      console.log(`[${data.type}] ${data.name} (${data.id})`);
      if (data.description) console.log(`  ${data.description}`);
      console.log('');
      console.log(data.content);
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
  }
}

switch (cmd) {
  case 'store': {
    const type = args[1];
    const name = args[2];
    const content = args.slice(3).filter(a => !a.startsWith('--')).join(' ');
    if (!type || !name || !content) { console.error('Usage: memorybank store <type> <name> <content>'); process.exit(1); }
    out(store.store({ type, name, content, namespace: ns }));
    break;
  }
  case 'recall': {
    const query = args.slice(1).filter(a => !a.startsWith('--')).join(' ');
    if (!query) { console.error('Usage: memorybank recall <query>'); process.exit(1); }
    out(store.recall(query, { namespace: ns, limit: flag('limit') }));
    break;
  }
  case 'search': {
    const query = args.slice(1).filter(a => !a.startsWith('--')).join(' ');
    if (!query) { console.error('Usage: memorybank search <query>'); process.exit(1); }
    out(store.search(query, { namespace: ns, limit: flag('limit') }));
    break;
  }
  case 'list':
    out(store.list({ type: flag('type'), tag: flag('tag'), namespace: ns, limit: flag('limit') }));
    break;
  case 'get': {
    const id = args[1];
    if (!id) { console.error('Usage: memorybank get <id>'); process.exit(1); }
    const mem = store.get(id, ns);
    if (!mem) { console.error(`Memory ${id} not found`); process.exit(1); }
    out(mem);
    break;
  }
  case 'delete': {
    const id = args[1];
    if (!id) { console.error('Usage: memorybank delete <id>'); process.exit(1); }
    out(store.remove(id, ns));
    break;
  }
  case 'stats':
    out(store.stats(ns));
    break;
  case 'namespaces':
    out(store.namespaces());
    break;
  case undefined:
  case 'help':
  case '--help':
  case '-h':
    usage();
    break;
  default:
    console.error(`Unknown command: ${cmd}`);
    usage();
    process.exit(1);
}
