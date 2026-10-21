// Browser stand-in for node:sqlite's DatabaseSync, backed by sql.js (SQLite compiled to WebAssembly).
// Only the surface the server uses: exec, prepare().get/all/run. Used by the static portfolio demo.
/* eslint-disable @typescript-eslint/no-explicit-any */
let SQL: any = null;
export function setSQL(s: any) {
  SQL = s;
}

function norm(params: any[]): any {
  if (params.length === 1 && params[0] && typeof params[0] === 'object' && !Array.isArray(params[0]) && !(params[0] instanceof Uint8Array)) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(params[0])) for (const p of ['$', ':', '@']) out[p + k] = clean(v);
    return out;
  }
  return params.map(clean);
}
const clean = (v: any) => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : typeof v === 'bigint' ? Number(v) : v);

class Statement {
  private db: any;
  private sql: string;
  constructor(db: any, sql: string) {
    this.db = db;
    this.sql = sql;
  }
  get(...params: any[]) {
    const st = this.db.prepare(this.sql);
    try {
      st.bind(norm(params));
      return st.step() ? st.getAsObject() : undefined;
    } finally {
      st.free();
    }
  }
  all(...params: any[]) {
    const st = this.db.prepare(this.sql);
    const rows: any[] = [];
    try {
      st.bind(norm(params));
      while (st.step()) rows.push(st.getAsObject());
      return rows;
    } finally {
      st.free();
    }
  }
  run(...params: any[]) {
    const st = this.db.prepare(this.sql);
    try {
      st.run(norm(params));
    } finally {
      st.free();
    }
    const changes = this.db.getRowsModified();
    const lastInsertRowid = this.db.exec('SELECT last_insert_rowid() AS id')[0]?.values[0][0] ?? 0;
    return { changes, lastInsertRowid };
  }
}

export class DatabaseSync {
  private db: any;
  constructor() {
    if (!SQL) throw new Error('sql.js not initialised');
    this.db = new SQL.Database();
  }
  exec(sql: string) {
    this.db.exec(sql);
  }
  prepare(sql: string) {
    return new Statement(this.db, sql);
  }
  close() {
    this.db.close();
  }
}
