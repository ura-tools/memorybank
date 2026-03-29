'use strict';

// Override storage dir for tests
process.env.MEMORYBANK_DIR = require('path').join(__dirname, '.test-memories');

const store = require('./lib/store');
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (e) {
    console.error(`  FAIL  ${name}: ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'assertion failed');
}

function cleanup() {
  const dir = process.env.MEMORYBANK_DIR;
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

// --- Tests ---
console.log('memorybank tests\n');
cleanup();

let testId;

test('store creates a memory and returns id', () => {
  const result = store.store({ name: 'test memory', type: 'user', content: 'This is a test memory.' });
  assert(result.id && result.id.length === 12, 'should return 12-char hex id');
  assert(result.type === 'user', 'should return type');
  testId = result.id;
});

test('get retrieves stored memory', () => {
  const mem = store.get(testId);
  assert(mem, 'should find memory');
  assert(mem.name === 'test memory', 'name should match');
  assert(mem.content === 'This is a test memory.', 'content should match');
  assert(mem.type === 'user', 'type should match');
});

test('list returns stored memories', () => {
  const list = store.list();
  assert(Array.isArray(list), 'should return array');
  assert(list.length >= 1, 'should have at least 1 memory');
  assert(list.some(m => m.id === testId), 'should include our memory');
});

test('list filters by type', () => {
  store.store({ name: 'project note', type: 'project', content: 'Project info.' });
  const userOnly = store.list({ type: 'user' });
  assert(userOnly.every(m => m.type === 'user'), 'should only return user type');
});

test('update modifies memory', () => {
  const result = store.update(testId, { content: 'Updated content.', name: 'updated memory' });
  assert(!result.error, 'should not error');
  const mem = store.get(testId);
  assert(mem.content === 'Updated content.', 'content should be updated');
  assert(mem.name === 'updated memory', 'name should be updated');
});

test('update non-existent returns error', () => {
  const result = store.update('000000000000', { content: 'x' });
  assert(result.error, 'should return error');
});

test('search finds by name', () => {
  const results = store.search('updated memory');
  assert(results.length > 0, 'should find results');
  assert(results[0].id === testId, 'should find our memory');
});

test('search finds by content', () => {
  store.store({ name: 'typescript preference', type: 'feedback', content: 'User prefers TypeScript over JavaScript for all new projects.' });
  const results = store.search('TypeScript');
  assert(results.length > 0, 'should find by content');
  assert(results.some(r => r.name === 'typescript preference'), 'should find the right memory');
});

test('recall returns full content', () => {
  const results = store.recall('TypeScript');
  assert(results.length > 0, 'should find results');
  assert(results[0].content, 'should include content');
  assert(results[0].content.includes('TypeScript'), 'content should match');
});

test('remove deletes memory', () => {
  const result = store.remove(testId);
  assert(result.deleted === testId, 'should confirm deletion');
  const mem = store.get(testId);
  assert(!mem, 'should not find deleted memory');
});

test('remove non-existent returns error', () => {
  const result = store.remove('000000000000');
  assert(result.error, 'should return error');
});

test('stats returns counts', () => {
  const s = store.stats();
  assert(typeof s.total === 'number', 'should have total');
  assert(typeof s.byType === 'object', 'should have byType');
  assert(s.total >= 2, 'should have at least 2 memories');
});

test('invalid ID format rejected', () => {
  try {
    store.get('../../../etc/passwd');
    assert(false, 'should throw');
  } catch (e) {
    assert(e.message.includes('Invalid'), 'should mention invalid');
  }
});

test('path traversal blocked', () => {
  try {
    store.get('../../etc/pw');
    assert(false, 'should throw');
  } catch (e) {
    assert(e.message.includes('Invalid'), 'should block traversal');
  }
});

test('large content truncated', () => {
  const big = 'x'.repeat(60000);
  const result = store.store({ name: 'big memory', type: 'custom', content: big });
  const mem = store.get(result.id);
  assert(mem.content.length <= 50001, 'should truncate large content');
});

test('tags stored and searchable', () => {
  const result = store.store({ name: 'tagged', type: 'reference', content: 'Has tags.', tags: ['important', 'architecture'] });
  const list = store.list({ tag: 'important' });
  assert(list.some(m => m.id === result.id), 'should find by tag');
});

test('namespaces isolation', () => {
  store.store({ name: 'ns test', type: 'project', content: 'In custom ns.', namespace: 'project-alpha' });
  const defaultList = store.list();
  const alphaList = store.list({ namespace: 'project-alpha' });
  assert(!defaultList.some(m => m.name === 'ns test'), 'should not appear in default');
  assert(alphaList.some(m => m.name === 'ns test'), 'should appear in project-alpha');
});

test('namespaces lists all', () => {
  const ns = store.namespaces();
  assert(Array.isArray(ns), 'should return array');
  assert(ns.includes('default'), 'should include default');
  assert(ns.includes('project-alpha'), 'should include project-alpha');
});

// Cleanup
cleanup();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
