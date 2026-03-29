'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const BASE_DIR = process.env.MEMORYBANK_DIR || path.join(os.homedir(), '.memorybank');
const DEFAULT_NS = 'default';

function nsDir(namespace) {
  const ns = (namespace || DEFAULT_NS).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return path.join(BASE_DIR, ns);
}

function memoriesDir(namespace) {
  return path.join(nsDir(namespace), 'memories');
}

function indexFile(namespace) {
  return path.join(nsDir(namespace), 'index.json');
}

function ensure(namespace) {
  const dir = memoriesDir(namespace);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function genId() {
  return crypto.randomBytes(6).toString('hex');
}

function now() {
  return new Date().toISOString();
}

// --- Index management ---

function loadIndex(namespace) {
  const f = indexFile(namespace);
  if (!fs.existsSync(f)) return { memories: {}, stats: { total: 0, byType: {} } };
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch { return { memories: {}, stats: { total: 0, byType: {} } }; }
}

function saveIndex(namespace, index) {
  // Recompute stats
  const entries = Object.values(index.memories);
  const byType = {};
  for (const e of entries) {
    byType[e.type] = (byType[e.type] || 0) + 1;
  }
  index.stats = { total: entries.length, byType };
  fs.writeFileSync(indexFile(namespace), JSON.stringify(index, null, 2));
}

// --- Memory file format ---

function toMarkdown(memory) {
  const fm = [
    '---',
    `id: ${memory.id}`,
    `name: ${memory.name}`,
    `type: ${memory.type}`,
    `description: ${memory.description}`,
    `created: ${memory.created}`,
    `updated: ${memory.updated}`,
  ];
  if (memory.tags && memory.tags.length) fm.push(`tags: [${memory.tags.join(', ')}]`);
  fm.push('---', '', memory.content);
  return fm.join('\n');
}

function fromMarkdown(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
  if (!m) return null;
  const meta = {};
  for (const line of m[1].split('\n')) {
    const idx = line.indexOf(': ');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 2).trim();
      if (key === 'tags') {
        val = val.replace(/^\[|\]$/g, '').split(',').map(s => s.trim()).filter(Boolean);
      }
      meta[key] = val;
    }
  }
  meta.content = m[2];
  return meta;
}

function memoryFile(namespace, id) {
  if (!/^[0-9a-f]{12}$/.test(id)) throw new Error(`Invalid memory ID: ${id}`);
  return path.join(memoriesDir(namespace), `${id}.md`);
}

// --- CRUD ---

function store(opts) {
  const namespace = opts.namespace || DEFAULT_NS;
  ensure(namespace);

  const TYPES = ['user', 'project', 'feedback', 'reference', 'custom'];
  const type = TYPES.includes(opts.type) ? opts.type : 'custom';

  const id = genId();
  const memory = {
    id,
    name: (opts.name || 'unnamed').slice(0, 200),
    type,
    description: (opts.description || '').slice(0, 500),
    content: (opts.content || '').slice(0, 50000),
    tags: Array.isArray(opts.tags) ? opts.tags.slice(0, 20).map(t => String(t).slice(0, 50)) : [],
    created: now(),
    updated: now()
  };

  fs.writeFileSync(memoryFile(namespace, id), toMarkdown(memory));

  const index = loadIndex(namespace);
  index.memories[id] = { id, name: memory.name, type, description: memory.description, tags: memory.tags, created: memory.created, updated: memory.updated };
  saveIndex(namespace, index);

  return { id, name: memory.name, type, created: memory.created };
}

function get(id, namespace) {
  namespace = namespace || DEFAULT_NS;
  const f = memoryFile(namespace, id); // throws on invalid ID
  try {
    if (!fs.existsSync(f)) return null;
    return fromMarkdown(fs.readFileSync(f, 'utf8'));
  } catch {
    return null;
  }
}

function update(id, opts) {
  const namespace = opts.namespace || DEFAULT_NS;
  const existing = get(id, namespace);
  if (!existing) return { error: `Memory ${id} not found` };

  if (opts.name) existing.name = opts.name.slice(0, 200);
  if (opts.description) existing.description = opts.description.slice(0, 500);
  if (opts.content) existing.content = opts.content.slice(0, 50000);
  if (opts.type) existing.type = opts.type;
  if (opts.tags) existing.tags = opts.tags.slice(0, 20);
  existing.updated = now();

  fs.writeFileSync(memoryFile(namespace, id), toMarkdown(existing));

  const index = loadIndex(namespace);
  if (index.memories[id]) {
    Object.assign(index.memories[id], { name: existing.name, type: existing.type, description: existing.description, tags: existing.tags, updated: existing.updated });
    saveIndex(namespace, index);
  }

  return { id, name: existing.name, updated: existing.updated };
}

function remove(id, namespace) {
  namespace = namespace || DEFAULT_NS;
  try {
    const f = memoryFile(namespace, id);
    if (!fs.existsSync(f)) return { error: `Memory ${id} not found` };
    fs.unlinkSync(f);

    const index = loadIndex(namespace);
    delete index.memories[id];
    saveIndex(namespace, index);

    return { deleted: id };
  } catch (e) {
    return { error: e.message };
  }
}

function list(opts = {}) {
  const namespace = opts.namespace || DEFAULT_NS;
  ensure(namespace);
  const index = loadIndex(namespace);
  let entries = Object.values(index.memories);

  if (opts.type) entries = entries.filter(e => e.type === opts.type);
  if (opts.tag) entries = entries.filter(e => e.tags && e.tags.includes(opts.tag));

  entries.sort((a, b) => (b.updated || b.created).localeCompare(a.updated || a.created));

  const limit = Math.min(Math.max(parseInt(opts.limit, 10) || 50, 1), 500);
  return entries.slice(0, limit);
}

// --- Search ---

function search(query, opts = {}) {
  const namespace = opts.namespace || DEFAULT_NS;
  ensure(namespace);

  if (!query || typeof query !== 'string') return [];

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const index = loadIndex(namespace);
  const results = [];

  for (const entry of Object.values(index.memories)) {
    let score = 0;
    const searchable = `${entry.name} ${entry.description} ${(entry.tags || []).join(' ')}`.toLowerCase();

    for (const term of terms) {
      if (searchable.includes(term)) score += 2;
    }

    // Also check file content for deeper matches
    if (score > 0 || terms.length > 0) {
      try {
        const raw = fs.readFileSync(memoryFile(namespace, entry.id), 'utf8');
        const content = raw.toLowerCase();
        for (const term of terms) {
          const matches = content.split(term).length - 1;
          score += matches;
        }
      } catch { /* skip unreadable */ }
    }

    if (score > 0) {
      results.push({ ...entry, score });
    }
  }

  results.sort((a, b) => b.score - a.score);
  const limit = Math.min(Math.max(parseInt(opts.limit, 10) || 20, 1), 100);
  return results.slice(0, limit);
}

function recall(query, opts = {}) {
  const namespace = opts.namespace || DEFAULT_NS;
  const matches = search(query, { namespace, limit: opts.limit || 5 });

  // Return full content for top matches
  return matches.map(m => {
    const full = get(m.id, namespace);
    return full ? { ...m, content: full.content } : m;
  });
}

function stats(namespace) {
  namespace = namespace || DEFAULT_NS;
  ensure(namespace);
  const index = loadIndex(namespace);

  // Count total content size
  let totalSize = 0;
  const dir = memoriesDir(namespace);
  try {
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.md')) totalSize += fs.statSync(path.join(dir, f)).size;
    }
  } catch { /* empty */ }

  return {
    ...index.stats,
    namespace: namespace,
    totalSizeBytes: totalSize,
    totalSizeKB: Math.round(totalSize / 1024 * 10) / 10
  };
}

function namespaces() {
  if (!fs.existsSync(BASE_DIR)) return [];
  return fs.readdirSync(BASE_DIR).filter(d => {
    return fs.statSync(path.join(BASE_DIR, d)).isDirectory();
  });
}

module.exports = {
  store, get, update, remove, list, search, recall, stats, namespaces,
  BASE_DIR, DEFAULT_NS
};
