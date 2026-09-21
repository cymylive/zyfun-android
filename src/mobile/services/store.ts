/**
 * 移动端本地存储 —— 替代桌面版的 SQLite (libsql + drizzle)
 *
 * 移动端把结构化数据直接放 IndexedDB，接口签名与 dbService 保持一致的语义。
 * 后续若要切 @capacitor-community/sqlite，只需替换这一层实现，上层路由不动。
 */
import { randomUUID } from '@zy/crypto';

const DB_NAME = 'zyfun';
const DB_VERSION = 1;

type TableName = 'site' | 'iptv' | 'channel' | 'history' | 'star' | 'setting' | 'analyze' | 'plugin';

const STORES: TableName[] = ['site', 'iptv', 'channel', 'history', 'star', 'setting', 'analyze', 'plugin'];

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: 'id' });
          store.createIndex('key', 'key', { unique: false });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(table: TableName, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(table, mode);
        const store = t.objectStore(table);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

const now = () => Date.now();

export interface IBaseRow {
  id: string;
  key: string;
  createdAt: number;
  updatedAt: number;
  [k: string]: any;
}

/**
 * 通用 CRUD，语义对齐 src/main/services/DbService/crud/*.ts
 */
export function createCrud<T extends IBaseRow>(table: TableName) {
  return {
    async all(): Promise<T[]> {
      return tx<T[]>(table, 'readonly', (s) => s.getAll() as IDBRequest<T[]>);
    },

    async active(): Promise<T[]> {
      const rows = await this.all();
      return rows.filter((r) => r.isActive !== false).sort((a, b) => a.createdAt - b.createdAt);
    },

    async get(id: string): Promise<T | undefined> {
      return tx<T | undefined>(table, 'readonly', (s) => s.get(id) as IDBRequest<T | undefined>);
    },

    async getByKey(key: string): Promise<T | undefined> {
      const rows = await this.all();
      return rows.find((r) => r.key === key);
    },

    async add(doc: Partial<T>): Promise<T> {
      const row = {
        ...doc,
        id: doc.id ?? randomUUID(),
        key: doc.key ?? randomUUID(),
        createdAt: doc.createdAt ?? now(),
        updatedAt: now(),
      } as T;
      await tx(table, 'readwrite', (s) => s.put(row));
      return row;
    },

    async update(ids: string[], doc: Partial<T>): Promise<T[]> {
      const out: T[] = [];
      for (const id of ids) {
        const cur = await this.get(id);
        if (!cur) continue;
        const next = { ...cur, ...doc, id, updatedAt: now() } as T;
        await tx(table, 'readwrite', (s) => s.put(next));
        out.push(next);
      }
      return out;
    },

    async remove(ids: string[]): Promise<void> {
      for (const id of ids) {
        await tx(table, 'readwrite', (s) => s.delete(id));
      }
    },

    async clear(): Promise<void> {
      await tx(table, 'readwrite', (s) => s.clear());
    },

    async page(pageNum = 1, pageSize = 10, kw?: string): Promise<{ list: T[]; total: number }> {
      let rows = await this.all();
      if (kw) {
        const k = String(kw).toLowerCase();
        rows = rows.filter((r) => JSON.stringify(r).toLowerCase().includes(k));
      }
      rows.sort((a, b) => b.updatedAt - a.updatedAt);
      const total = rows.length;
      const start = (pageNum - 1) * pageSize;
      return { list: rows.slice(start, start + pageSize), total };
    },

    async set(docs: T[]): Promise<T[]> {
      await this.clear();
      const out: T[] = [];
      for (const doc of docs) out.push(await this.add(doc));
      return out;
    },
  };
}

/** 对齐 dbService.setting 的 getValue / setValue */
export const settingStore = {
  async getValue<K extends string>(key: K): Promise<any> {
    const row = await createCrud<any>('setting').getByKey(key);
    return row?.value?.data ?? row?.value;
  },
  async setValue(key: string, value: any): Promise<void> {
    const crud = createCrud<any>('setting');
    const row = await crud.getByKey(key);
    if (row) {
      await crud.update([row.id], { value: { data: value } });
    } else {
      await crud.add({ key, value: { data: value } } as any);
    }
  },
  async all(): Promise<any[]> {
    return createCrud<any>('setting').all();
  },
};

export const mobileDb = {
  site: createCrud<any>('site'),
  iptv: createCrud<any>('iptv'),
  channel: createCrud<any>('channel'),
  history: createCrud<any>('history'),
  star: createCrud<any>('star'),
  setting: settingStore,
  analyze: createCrud<any>('analyze'),
  plugin: createCrud<any>('plugin'),
};
