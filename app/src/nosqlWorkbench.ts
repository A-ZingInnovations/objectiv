/** Local NoSQL / Mongo-style workbench state (extension: azing.viewer.mongo-nosql). */

import { jsonToTable, type JsonTableModel } from './jsonDocument';

export const NOSQL_EXTENSION_ID = 'azing.viewer.mongo-nosql';
export const NOSQL_VIEWER_FEATURE = 'mongo-nosql';
export const NOSQL_TAB = 'nosql:workbench';

const STORAGE_KEY = 'objectiv-nosql-workbench-v1';

export type NosqlDocument = Record<string, unknown>;

export type NosqlCollection = {
  id: string;
  name: string;
  documents: NosqlDocument[];
};

export type NosqlDatabase = {
  id: string;
  name: string;
  collections: NosqlCollection[];
};

export type NosqlConnection = {
  id: string;
  name: string;
  /** local = in-app document store; mongo-uri reserved for connection metadata / mongosh. */
  kind: 'local' | 'mongo-uri';
  uri?: string;
  databases: NosqlDatabase[];
};

export type NosqlWorkbenchState = {
  connections: NosqlConnection[];
  activeConnectionId: string | null;
  activeDatabaseId: string | null;
  activeCollectionId: string | null;
};

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function isNosqlTab(path: string): boolean {
  return path === NOSQL_TAB || path.startsWith('nosql:');
}

function demoDocuments(): NosqlDocument[] {
  return [
    {
      _id: '64f0a1b2c3d4e5f678901234',
      name: 'Ada Lovelace',
      role: 'analyst',
      tags: ['math', 'early'],
      active: true,
      score: 98,
    },
    {
      _id: '64f0a1b2c3d4e5f678901235',
      name: 'Grace Hopper',
      role: 'engineer',
      tags: ['compiler', 'navy'],
      active: true,
      score: 95,
    },
    {
      _id: '64f0a1b2c3d4e5f678901236',
      name: 'Alan Turing',
      role: 'researcher',
      tags: ['crypto', 'ai'],
      active: false,
      score: 99,
    },
  ];
}

export function defaultNosqlState(): NosqlWorkbenchState {
  const colId = uid('col');
  const dbId = uid('db');
  const connId = uid('conn');
  return {
    connections: [
      {
        id: connId,
        name: 'Local demo',
        kind: 'local',
        databases: [
          {
            id: dbId,
            name: 'demo',
            collections: [
              {
                id: colId,
                name: 'people',
                documents: demoDocuments(),
              },
            ],
          },
        ],
      },
    ],
    activeConnectionId: connId,
    activeDatabaseId: dbId,
    activeCollectionId: colId,
  };
}

export function loadNosqlState(): NosqlWorkbenchState {
  if (typeof localStorage === 'undefined') return defaultNosqlState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultNosqlState();
    const parsed = JSON.parse(raw) as NosqlWorkbenchState;
    if (!parsed?.connections?.length) return defaultNosqlState();
    return parsed;
  } catch {
    return defaultNosqlState();
  }
}

export function saveNosqlState(state: NosqlWorkbenchState): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getActiveCollection(state: NosqlWorkbenchState): NosqlCollection | null {
  const conn = state.connections.find((c) => c.id === state.activeConnectionId);
  const db = conn?.databases.find((d) => d.id === state.activeDatabaseId);
  return db?.collections.find((c) => c.id === state.activeCollectionId) ?? null;
}

/** Mongo-style equality filter on top-level fields, e.g. `{ "active": true }`. */
export function applyNosqlFilter(
  documents: NosqlDocument[],
  filterText: string,
): { docs: NosqlDocument[]; error: string | null } {
  const trimmed = filterText.trim();
  if (!trimmed || trimmed === '{}') return { docs: documents, error: null };
  let filter: unknown;
  try {
    filter = JSON.parse(trimmed);
  } catch (e) {
    return {
      docs: documents,
      error: e instanceof Error ? e.message : 'Invalid filter JSON',
    };
  }
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
    return { docs: documents, error: 'Filter must be a JSON object' };
  }
  const entries = Object.entries(filter as Record<string, unknown>);
  const docs = documents.filter((doc) =>
    entries.every(([key, want]) => deepEqual(doc[key], want)),
  );
  return { docs, error: null };
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object') return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export function documentsToTable(docs: NosqlDocument[]): JsonTableModel {
  return jsonToTable(docs);
}

export function parseImportedDocuments(text: string): {
  docs: NosqlDocument[];
  error: string | null;
} {
  const trimmed = text.trim();
  if (!trimmed) return { docs: [], error: 'Empty import' };

  // JSONL / NDJSON
  if (trimmed.includes('\n') && !trimmed.startsWith('[')) {
    const docs: NosqlDocument[] = [];
    const lines = trimmed.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      try {
        const v = JSON.parse(line) as unknown;
        if (!v || typeof v !== 'object' || Array.isArray(v)) {
          return { docs: [], error: `Line ${i + 1}: expected a JSON object` };
        }
        docs.push(v as NosqlDocument);
      } catch (e) {
        return {
          docs: [],
          error: `Line ${i + 1}: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
    }
    return { docs, error: null };
  }

  try {
    const v = JSON.parse(trimmed) as unknown;
    if (Array.isArray(v)) {
      const docs: NosqlDocument[] = [];
      for (let i = 0; i < v.length; i++) {
        const row = v[i];
        if (!row || typeof row !== 'object' || Array.isArray(row)) {
          return { docs: [], error: `Item ${i}: expected a JSON object` };
        }
        docs.push(row as NosqlDocument);
      }
      return { docs, error: null };
    }
    if (v && typeof v === 'object') {
      return { docs: [v as NosqlDocument], error: null };
    }
    return { docs: [], error: 'Expected a JSON object or array of objects' };
  } catch (e) {
    return { docs: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export function ensureDocId(doc: NosqlDocument): NosqlDocument {
  if (doc._id != null) return doc;
  return { _id: uid('oid'), ...doc };
}

export function addLocalConnection(
  state: NosqlWorkbenchState,
  name: string,
): NosqlWorkbenchState {
  const colId = uid('col');
  const dbId = uid('db');
  const connId = uid('conn');
  const conn: NosqlConnection = {
    id: connId,
    name: name.trim() || 'Local',
    kind: 'local',
    databases: [
      {
        id: dbId,
        name: 'default',
        collections: [{ id: colId, name: 'docs', documents: [] }],
      },
    ],
  };
  return {
    connections: [...state.connections, conn],
    activeConnectionId: connId,
    activeDatabaseId: dbId,
    activeCollectionId: colId,
  };
}

export function addMongoUriConnection(
  state: NosqlWorkbenchState,
  name: string,
  uri: string,
): NosqlWorkbenchState {
  const colId = uid('col');
  const dbId = uid('db');
  const connId = uid('conn');
  const conn: NosqlConnection = {
    id: connId,
    name: name.trim() || 'MongoDB',
    kind: 'mongo-uri',
    uri: uri.trim(),
    databases: [
      {
        id: dbId,
        name: 'local',
        collections: [
          {
            id: colId,
            name: 'scratch',
            documents: [],
          },
        ],
      },
    ],
  };
  return {
    connections: [...state.connections, conn],
    activeConnectionId: connId,
    activeDatabaseId: dbId,
    activeCollectionId: colId,
  };
}

export function updateActiveDocuments(
  state: NosqlWorkbenchState,
  documents: NosqlDocument[],
): NosqlWorkbenchState {
  return {
    ...state,
    connections: state.connections.map((conn) => {
      if (conn.id !== state.activeConnectionId) return conn;
      return {
        ...conn,
        databases: conn.databases.map((db) => {
          if (db.id !== state.activeDatabaseId) return db;
          return {
            ...db,
            collections: db.collections.map((col) =>
              col.id === state.activeCollectionId ? { ...col, documents } : col,
            ),
          };
        }),
      };
    }),
  };
}

export function addCollection(
  state: NosqlWorkbenchState,
  name: string,
): NosqlWorkbenchState {
  const colId = uid('col');
  return {
    ...state,
    activeCollectionId: colId,
    connections: state.connections.map((conn) => {
      if (conn.id !== state.activeConnectionId) return conn;
      return {
        ...conn,
        databases: conn.databases.map((db) => {
          if (db.id !== state.activeDatabaseId) return db;
          return {
            ...db,
            collections: [
              ...db.collections,
              { id: colId, name: name.trim() || 'new_collection', documents: [] },
            ],
          };
        }),
      };
    }),
  };
}
