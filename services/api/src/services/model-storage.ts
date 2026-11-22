import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const MAX_MODEL_ASSET_BYTES = 25 * 1024 * 1024; // 25 MB

export interface StoredModelResult {
  storageProvider: 'LOCAL_MANAGED';
  storageKey: string;
  fileName: string;
  mimeType: 'model/gltf-binary' | 'model/gltf+json';
  fileSizeBytes: number;
}

export interface ModelStorageAdapter {
  saveModel(params: {
    originalFileName: string;
    buffer: Buffer;
  }): Promise<StoredModelResult>;
  readModel(storageKey: string): Promise<Buffer | null>;
  deleteModel(storageKey: string): Promise<void>;
}

export function validateModelBuffer(params: {
  fileName: string;
  buffer: Buffer;
}): { ext: '.glb' | '.gltf'; mimeType: 'model/gltf-binary' | 'model/gltf+json' } {
  const ext = path.extname(params.fileName).toLowerCase();
  if (ext !== '.glb' && ext !== '.gltf') {
    throw new Error('INVALID_MODEL_EXTENSION: Only .glb and .gltf files are supported.');
  }
  if (!params.buffer || params.buffer.length === 0) {
    throw new Error('EMPTY_MODEL_FILE: Uploaded model file is empty.');
  }
  if (params.buffer.length > MAX_MODEL_ASSET_BYTES) {
    throw new Error('MODEL_FILE_TOO_LARGE: Model file exceeds the 25 MB limit.');
  }

  if (ext === '.glb') {
    // glTF binary magic header: 0x46546C67 ("glTF" in ASCII)
    if (params.buffer.length < 12 || params.buffer.subarray(0, 4).toString('ascii') !== 'glTF') {
      throw new Error('INVALID_GLB_HEADER: File does not contain a valid glTF binary header.');
    }
    return { ext: '.glb', mimeType: 'model/gltf-binary' };
  }

  try {
    const parsed = JSON.parse(params.buffer.toString('utf8')) as { asset?: { version?: string } };
    if (!parsed || typeof parsed !== 'object' || !parsed.asset?.version) {
      throw new Error('INVALID_GLTF_JSON');
    }
  } catch {
    throw new Error('INVALID_GLTF_JSON: File is not valid glTF JSON.');
  }

  return { ext: '.gltf', mimeType: 'model/gltf+json' };
}

export class LocalManagedModelStorage implements ModelStorageAdapter {
  private readonly baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.resolve(process.cwd(), '.uploads', 'models');
  }

  private resolveSafePath(storageKey: string): string {
    const sanitized = path.basename(storageKey);
    if (!/^[a-zA-Z0-9_-]+\.(glb|gltf)$/.test(sanitized)) {
      throw new Error('INVALID_STORAGE_KEY');
    }
    return path.join(this.baseDir, sanitized);
  }

  async saveModel(params: { originalFileName: string; buffer: Buffer }): Promise<StoredModelResult> {
    const { ext, mimeType } = validateModelBuffer({
      fileName: params.originalFileName,
      buffer: params.buffer,
    });
    fs.mkdirSync(this.baseDir, { recursive: true });
    const storageKey = `${crypto.randomUUID()}${ext}`;
    const targetPath = this.resolveSafePath(storageKey);
    fs.writeFileSync(targetPath, params.buffer);
    return {
      storageProvider: 'LOCAL_MANAGED',
      storageKey,
      fileName: path.basename(params.originalFileName).slice(0, 180),
      mimeType,
      fileSizeBytes: params.buffer.length,
    };
  }

  async readModel(storageKey: string): Promise<Buffer | null> {
    try {
      const targetPath = this.resolveSafePath(storageKey);
      if (!fs.existsSync(targetPath)) return null;
      return fs.readFileSync(targetPath);
    } catch {
      return null;
    }
  }

  async deleteModel(storageKey: string): Promise<void> {
    try {
      const targetPath = this.resolveSafePath(storageKey);
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
    } catch {
      // Ignore cleanup errors for missing/external keys
    }
  }
}

export const defaultModelStorage = new LocalManagedModelStorage();
