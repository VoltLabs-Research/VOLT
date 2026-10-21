// The better-sqlite3 API both backends reach through TypeORM, on SQLite's own WASM build. Databases
// live in OPFS through the opfs-sahpool VFS, which is synchronous inside a worker, so the API keeps
// better-sqlite3's synchronous calls and transactions. initSqlite() must resolve before the first
// `new Database()`.
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import type { BindingSpec, Database as WasmDatabase, PreparedStatement, SAHPoolUtil, Sqlite3Static, SqlValue } from '@sqlite.org/sqlite-wasm';

let sqlite: Sqlite3Static | null = null;
let pool: SAHPoolUtil | null = null;

export const initSqlite = async (directory: string): Promise<void> => {
    sqlite = await sqlite3InitModule({ print: () => {}, printErr: (message: string) => console.error(message) });
    pool = await sqlite.installOpfsSAHPoolVfs({ directory, initialCapacity: 8 });
};

const requirePool = (): SAHPoolUtil => {
    if(!pool){
        throw new Error('better-sqlite3: initSqlite() has not completed');
    }
    return pool;
};

const toNodeValue = (value: SqlValue): unknown => {
    if(value instanceof Uint8Array){
        return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
    }
    if(typeof value === 'bigint' && value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER)){
        return Number(value);
    }
    return value;
};

const toBinding = (value: unknown): SqlValue => {
    if(value === undefined || value === null){
        return null;
    }
    if(typeof value === 'boolean'){
        throw new TypeError('SQLite3 can only bind numbers, strings, bigints, buffers, and null');
    }
    if(value instanceof Uint8Array || typeof value === 'number' || typeof value === 'string' || typeof value === 'bigint'){
        return value;
    }
    throw new TypeError('SQLite3 can only bind numbers, strings, bigints, buffers, and null');
};

// better-sqlite3 takes positional arguments, or one object for named parameters.
const toBindingSpec = (params: unknown[]): BindingSpec | undefined => {
    if(params.length === 0){
        return undefined;
    }
    const [first] = params;
    if(params.length === 1 && first && typeof first === 'object' && !(first instanceof Uint8Array) && !Array.isArray(first)){
        return Object.fromEntries(Object.entries(first).map(([name, value]) => [/^[:@$]/.test(name) ? name : `@${name}`, toBinding(value)]));
    }
    return params.flat().map(toBinding);
};

interface RunResult {
    changes: number;
    lastInsertRowid: number | bigint;
}

class Statement {
    readonly reader: boolean;
    readonly source: string;
    private readonly statement: PreparedStatement;
    private readonly database: Database;

    constructor(database: Database, statement: PreparedStatement, source: string){
        this.database = database;
        this.statement = statement;
        this.source = source;
        this.reader = statement.columnCount > 0;
    }

    private execute<T>(params: unknown[], consume: (statement: PreparedStatement) => T): T {
        const spec = toBindingSpec(params);
        try{
            if(spec !== undefined){
                this.statement.bind(spec);
            }
            return consume(this.statement);
        }finally{
            this.statement.reset(true);
        }
    }

    private readRow(statement: PreparedStatement): Record<string, unknown> {
        const row = statement.get({});
        return Object.fromEntries(Object.entries(row).map(([name, value]) => [name, toNodeValue(value)]));
    }

    run(...params: unknown[]): RunResult {
        return this.execute(params, (statement) => {
            while(statement.step()){
                // Statements that return rows still run to completion, as in better-sqlite3.
            }
            return {
                changes: this.database.native.changes(),
                lastInsertRowid: toNodeValue(this.database.native.selectValue('SELECT last_insert_rowid()') ?? 0) as number
            };
        });
    }

    get(...params: unknown[]): Record<string, unknown> | undefined {
        return this.execute(params, (statement) => statement.step() ? this.readRow(statement) : undefined);
    }

    all(...params: unknown[]): Record<string, unknown>[] {
        return this.execute(params, (statement) => {
            const rows: Record<string, unknown>[] = [];
            while(statement.step()){
                rows.push(this.readRow(statement));
            }
            return rows;
        });
    }

    *iterate(...params: unknown[]): IterableIterator<Record<string, unknown>> {
        yield* this.all(...params);
    }

    pluck(): this {
        return this;
    }

    raw(): this {
        return this;
    }

    columns(): { name: string }[] {
        return this.statement.getColumnNames().map((name) => ({ name }));
    }
}

interface DatabaseOptions {
    readonly?: boolean;
    fileMustExist?: boolean;
}

class Database {
    readonly name: string;
    readonly memory: boolean;
    readonly readonly: boolean;
    open = true;
    inTransaction = false;
    readonly native: WasmDatabase;

    constructor(filename = ':memory:', options: DatabaseOptions = {}){
        this.name = filename;
        this.memory = filename === ':memory:' || filename === '';
        this.readonly = Boolean(options.readonly);
        this.native = this.memory
            ? new (sqlite as Sqlite3Static).oo1.DB(':memory:', 'c')
            : new (requirePool().OpfsSAHPoolDb)(filename);
    }

    prepare(source: string): Statement {
        return new Statement(this, this.native.prepare(source), source);
    }

    exec(source: string): this {
        this.native.exec(source);
        return this;
    }

    pragma(source: string, options: { simple?: boolean } = {}): unknown {
        const rows = this.prepare(`PRAGMA ${source}`).all();
        if(!options.simple){
            return rows;
        }
        const [first] = rows;
        return first ? Object.values(first)[0] : undefined;
    }

    transaction<T extends (...args: never[]) => unknown>(fn: T): T {
        return ((...args: Parameters<T>) => {
            this.exec('BEGIN');
            this.inTransaction = true;
            try{
                const result = fn(...args);
                this.exec('COMMIT');
                return result;
            }catch(error){
                this.exec('ROLLBACK');
                throw error;
            }finally{
                this.inTransaction = false;
            }
        }) as T;
    }

    function(): this {
        throw new Error('better-sqlite3: user-defined functions are not supported in the browser');
    }

    close(): this {
        this.native.close();
        this.open = false;
        return this;
    }
}

export default Database;
