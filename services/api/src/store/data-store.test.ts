import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataStore, resolveDefaultDataFilePath } from './data-store.js';

const temporaryDirectories: string[] = [];
const stores: DataStore[] = [];

function makeTemporaryDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mrs-json-store-'));
  temporaryDirectories.push(directory);
  return directory;
}

function makePersistentStore(directory = makeTemporaryDirectory(), fileName = 'platform-state.json'): DataStore {
  const store = new DataStore({
    filePath: path.join(directory, fileName),
    testMode: false,
    enforceLock: true,
  });
  stores.push(store);
  return store;
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const store of stores.splice(0)) store.releaseLock();
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('DataStore JSON reliability', () => {
  it('writes a complete state through atomic replacement and leaves no temporary file', () => {
    const store = makePersistentStore();
    const filePath = store.getFilePath();
    store.getState().settings.storeName = 'Atomic Write Check';

    expect(store.persist()).toBe(true);
    expect(JSON.parse(fs.readFileSync(filePath, 'utf8')).settings.storeName).toBe('Atomic Write Check');
    expect(fs.readdirSync(path.dirname(filePath)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
  });

  it('preserves the old file, restores committed memory and cleans the temporary file after a write failure', () => {
    const store = makePersistentStore();
    const filePath = store.getFilePath();
    const original = fs.readFileSync(filePath, 'utf8');
    const originalStoreName = store.getState().settings.storeName;
    store.getState().settings.storeName = 'Must Not Commit';
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw Object.assign(new Error('forced write failure'), { code: 'EIO' });
    });

    expect(store.persist()).toBe(false);
    expect(fs.readFileSync(filePath, 'utf8')).toBe(original);
    expect(store.getState().settings.storeName).toBe(originalStoreName);
    expect(fs.readdirSync(path.dirname(filePath)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
  });

  it('preserves the old file and removes the temporary file when atomic rename fails', () => {
    const store = makePersistentStore();
    const filePath = store.getFilePath();
    const original = fs.readFileSync(filePath, 'utf8');
    const originalStoreName = store.getState().settings.storeName;
    store.getState().settings.storeName = 'Must Not Commit';
    vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw Object.assign(new Error('forced rename failure'), { code: 'EIO' });
    });

    expect(store.persist()).toBe(false);
    expect(fs.readFileSync(filePath, 'utf8')).toBe(original);
    expect(store.getState().settings.storeName).toBe(originalStoreName);
    expect(fs.readdirSync(path.dirname(filePath)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
  });

  it('aborts startup on malformed JSON without replacing the original file', () => {
    const directory = makeTemporaryDirectory();
    const filePath = path.join(directory, 'platform-state.json');
    const malformed = '{"products": [ this is not valid JSON';
    fs.writeFileSync(filePath, malformed, 'utf8');

    expect(() => new DataStore({ filePath, testMode: false, enforceLock: true }))
      .toThrow(/CORRUPT_STATE_FILE/);
    expect(fs.readFileSync(filePath, 'utf8')).toBe(malformed);
    expect(fs.existsSync(`${filePath}.lock`)).toBe(false);
  });

  it('aborts startup for a valid JSON object with malformed required state sections', () => {
    const directory = makeTemporaryDirectory();
    const filePath = path.join(directory, 'platform-state.json');
    const malformed = JSON.stringify({ users: [], settings: {} });
    fs.writeFileSync(filePath, malformed, 'utf8');

    expect(() => new DataStore({ filePath, testMode: false, enforceLock: true }))
      .toThrow(/CORRUPT_STATE_FILE/);
    expect(fs.readFileSync(filePath, 'utf8')).toBe(malformed);
  });

  it('rejects a second writer and leaves the active process lock untouched', () => {
    const store = makePersistentStore();
    const lockPath = store.getLockFilePath();
    const lockContents = fs.readFileSync(lockPath, 'utf8');

    expect(() => new DataStore({ filePath: store.getFilePath(), testMode: false, enforceLock: true }))
      .toThrow(/SINGLE_WRITER_LOCK_HELD/);
    expect(fs.readFileSync(lockPath, 'utf8')).toBe(lockContents);
    expect(JSON.parse(lockContents).pid).toBe(process.pid);
  });

  it('preserves a stale lock and requires manual inspection rather than deleting it', () => {
    const directory = makeTemporaryDirectory();
    const filePath = path.join(directory, 'platform-state.json');
    const lockPath = `${filePath}.lock`;
    const staleLock = JSON.stringify({ pid: 2_147_483_647, lockToken: 'stale-test-lock' });
    fs.writeFileSync(lockPath, staleLock, 'utf8');

    expect(() => new DataStore({ filePath, testMode: false, enforceLock: true }))
      .toThrow(/STALE_STATE_LOCK/);
    expect(fs.readFileSync(lockPath, 'utf8')).toBe(staleLock);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('resolves relative data paths from the API package rather than the process working directory', () => {
    const expected = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../relative-state.json');
    expect(resolveDefaultDataFilePath({ MRS_DATA_FILE_PATH: 'relative-state.json' })).toBe(expected);
    expect(resolveDefaultDataFilePath({})).toBe(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.data/platform-state.json')
    );
  });

  it('keeps historical customers unverified while preserving only explicitly persisted verification', () => {
    const directory = makeTemporaryDirectory();
    const seed = new DataStore({ filePath: path.join(directory, 'unused.json'), testMode: true });
    const fixture = structuredClone(seed.getState()) as any;
    delete fixture.collections;
    delete fixture.inventoryMovements;
    delete fixture.notifications;
    delete fixture.integrationEvents;
    delete fixture.customers[0].emailVerified;
    delete fixture.customers[0].passwordHash;
    fixture.customers[1].emailVerified = true;
    const filePath = path.join(directory, 'legacy-platform-state.json');
    fs.writeFileSync(filePath, JSON.stringify(fixture), 'utf8');

    const loaded = makePersistentStore(directory, 'legacy-platform-state.json');
    expect(loaded.getState().customers[0]?.emailVerified).toBe(false);
    expect(loaded.getState().customers[0]?.passwordHash).toBeUndefined();
    expect(loaded.getState().customers[1]?.emailVerified).toBe(true);
    // Missing optional sections are backfilled in memory from seed defaults only; the file is untouched.
    expect(loaded.getState().collections).toEqual(seed.getState().collections);
    expect(loaded.getState().inventoryMovements).toEqual(seed.getState().inventoryMovements);
    expect(loaded.getState().notifications).toEqual(seed.getState().notifications);
    expect(loaded.getState().integrationEvents).toEqual(seed.getState().integrationEvents);
    expect(JSON.parse(fs.readFileSync(filePath, 'utf8')).collections).toBeUndefined();
  });
});
