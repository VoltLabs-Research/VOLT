// The part of @duckdb/node-api the daemon uses, on duckdb-wasm's blocking build. That build does its
// file I/O through Node's synchronous fs calls, which here are this worker's OPFS file system, so
// read_parquet() and COPY ... TO take the same paths the daemon passes on the desktop.
import { NODE_RUNTIME, VoidLogger, createDuckDB } from '@duckdb/duckdb-wasm/dist/duckdb-node-blocking';
import type { DuckDBConnection as WasmConnection, DuckDBBindings } from '@duckdb/duckdb-wasm/dist/duckdb-node-blocking';
import { Table, Type, vectorFromArray, Float32, Float64, Int8, Int16, Int32, Int64, Uint8, Uint16, Uint32, Uint64, Utf8, Bool } from 'apache-arrow';
import type { DataType, Vector } from 'apache-arrow';
import { existsSync, mkdirSync, writeFileSync } from './fs';

export enum DuckDBTypeId {
    INVALID = 0, BOOLEAN = 1, TINYINT = 2, SMALLINT = 3, INTEGER = 4, BIGINT = 5, UTINYINT = 6, USMALLINT = 7,
    UINTEGER = 8, UBIGINT = 9, FLOAT = 10, DOUBLE = 11, TIMESTAMP = 12, DATE = 13, TIME = 14, INTERVAL = 15,
    HUGEINT = 16, UHUGEINT = 32, VARCHAR = 17, BLOB = 18, DECIMAL = 19, TIMESTAMP_S = 20, TIMESTAMP_MS = 21,
    TIMESTAMP_NS = 22, ENUM = 23, LIST = 24, STRUCT = 25, MAP = 26, ARRAY = 33, UUID = 27, UNION = 28, BIT = 29,
    TIME_TZ = 30, TIMESTAMP_TZ = 31, ANY = 34, BIGNUM = 35, SQLNULL = 36, STRING_LITERAL = 37, INTEGER_LITERAL = 38,
    TIME_NS = 39
}

// The engine's wasm lives in the file system, where the blocking build reads it from.
const DUCKDB_WASM_VERSION = '1.32.0';
const WASM_DIRECTORY = '/app/.volt-runtime';
const WASM_FILES = {
    mvp: 'duckdb-mvp.wasm',
    eh: 'duckdb-eh.wasm'
} as const;

const installWasm = async (file: string): Promise<string> => {
    const target = `${WASM_DIRECTORY}/duckdb-${DUCKDB_WASM_VERSION}-${file}`;
    if(!existsSync(target)){
        const response = await fetch(new URL(`./${file}`, import.meta.url));
        if(!response.ok){
            throw new Error(`duckdb: could not load ${file} (${response.status})`);
        }
        mkdirSync(WASM_DIRECTORY, { recursive: true });
        writeFileSync(target, new Uint8Array(await response.arrayBuffer()));
    }
    return target;
};

let database: Promise<DuckDBBindings> | null = null;

const openDatabase = (): Promise<DuckDBBindings> => {
    database ??= (async () => {
        const [mvp, eh] = await Promise.all([installWasm(WASM_FILES.mvp), installWasm(WASM_FILES.eh)]);
        const bindings = await createDuckDB({
            mvp: { mainModule: mvp, mainWorker: '' },
            eh: { mainModule: eh, mainWorker: '' }
        }, new VoidLogger(), NODE_RUNTIME);
        await bindings.instantiate();
        bindings.open({});
        return bindings;
    })();
    return database;
};

const TYPE_IDS: Partial<Record<Type, DuckDBTypeId>> = {
    [Type.Bool]: DuckDBTypeId.BOOLEAN,
    [Type.Int8]: DuckDBTypeId.TINYINT,
    [Type.Int16]: DuckDBTypeId.SMALLINT,
    [Type.Int32]: DuckDBTypeId.INTEGER,
    [Type.Int64]: DuckDBTypeId.BIGINT,
    [Type.Uint8]: DuckDBTypeId.UTINYINT,
    [Type.Uint16]: DuckDBTypeId.USMALLINT,
    [Type.Uint32]: DuckDBTypeId.UINTEGER,
    [Type.Uint64]: DuckDBTypeId.UBIGINT,
    [Type.Float16]: DuckDBTypeId.FLOAT,
    [Type.Float32]: DuckDBTypeId.FLOAT,
    [Type.Float64]: DuckDBTypeId.DOUBLE,
    [Type.Utf8]: DuckDBTypeId.VARCHAR,
    [Type.LargeUtf8]: DuckDBTypeId.VARCHAR,
    [Type.Binary]: DuckDBTypeId.BLOB,
    [Type.Decimal]: DuckDBTypeId.DECIMAL,
    [Type.Date]: DuckDBTypeId.DATE,
    [Type.DateDay]: DuckDBTypeId.DATE,
    [Type.DateMillisecond]: DuckDBTypeId.DATE,
    [Type.Timestamp]: DuckDBTypeId.TIMESTAMP,
    [Type.TimestampMicrosecond]: DuckDBTypeId.TIMESTAMP,
    [Type.TimestampMillisecond]: DuckDBTypeId.TIMESTAMP_MS,
    [Type.TimestampSecond]: DuckDBTypeId.TIMESTAMP_S,
    [Type.TimestampNanosecond]: DuckDBTypeId.TIMESTAMP_NS,
    [Type.Time]: DuckDBTypeId.TIME,
    [Type.List]: DuckDBTypeId.LIST,
    [Type.FixedSizeList]: DuckDBTypeId.ARRAY,
    [Type.Struct]: DuckDBTypeId.STRUCT,
    [Type.Map]: DuckDBTypeId.MAP,
    [Type.Dictionary]: DuckDBTypeId.ENUM,
    [Type.Null]: DuckDBTypeId.SQLNULL
};

const typeIdOf = (type: DataType): DuckDBTypeId => TYPE_IDS[type.typeId] ?? DuckDBTypeId.INVALID;

// Values as node-api's JS converters give them: integers above 32 bits as bigint, dates as Date,
// lists as arrays and structs as objects. node-api's non-JS values differ only in the list shape
// ({ items }), which is what `listShape` selects.
const toJs = (value: unknown, type: DataType, listShape: 'array' | 'items'): unknown => {
    if(value === null || value === undefined){
        return null;
    }
    switch(type.typeId){
        case Type.List:
        case Type.FixedSizeList: {
            const child = (type as DataType & { children: { type: DataType }[] }).children[0].type;
            const items = [...(value as Iterable<unknown>)].map((item) => toJs(item, child, listShape));
            return listShape === 'array' ? items : { items };
        }
        case Type.Struct: {
            const fields = (type as DataType & { children: { name: string; type: DataType }[] }).children;
            const row = value as Record<string, unknown>;
            return Object.fromEntries(fields.map((field) => [field.name, toJs(row[field.name], field.type, listShape)]));
        }
        case Type.Date:
        case Type.DateDay:
        case Type.DateMillisecond:
        case Type.Timestamp:
        case Type.TimestampMicrosecond:
        case Type.TimestampMillisecond:
        case Type.TimestampSecond:
        case Type.TimestampNanosecond:
            return new Date(Number(value));
        case Type.Decimal:
            return Number(value);
        default:
            return value;
    }
};

const rowObjects = (table: Table, listShape: 'array' | 'items'): Record<string, unknown>[] => {
    const fields = table.schema.fields;
    const columns = fields.map((field, index) => table.getChildAt(index) as Vector);
    const rows: Record<string, unknown>[] = [];
    for(let row = 0; row < table.numRows; row += 1){
        const object: Record<string, unknown> = {};
        fields.forEach((field, index) => {
            object[field.name] = toJs(columns[index].get(row), field.type, listShape);
        });
        rows.push(object);
    }
    return rows;
};

export class DuckDBResultReader {
    private readonly table: Table;

    constructor(table: Table){
        this.table = table;
    }

    get columnCount(): number {
        return this.table.schema.fields.length;
    }

    get currentRowCount(): number {
        return this.table.numRows;
    }

    columnNames(): string[] {
        return this.table.schema.fields.map((field) => field.name);
    }

    columnName(index: number): string {
        return this.table.schema.fields[index].name;
    }

    columnTypeId(index: number): DuckDBTypeId {
        return typeIdOf(this.table.schema.fields[index].type);
    }

    getRowObjectsJS(): Record<string, unknown>[] {
        return rowObjects(this.table, 'array');
    }

    getRowObjects(): Record<string, unknown>[] {
        return rowObjects(this.table, 'items');
    }

    getRowsJS(): unknown[][] {
        return this.getRowObjectsJS().map((row) => Object.values(row));
    }

    getRows(): unknown[][] {
        return this.getRowObjects().map((row) => Object.values(row));
    }
}

// DuckDB's vector size: a stream hands out chunks of this many rows, as the native engine does.
const CHUNK_ROWS = 2048;

class DuckDBVector {
    constructor(private readonly vector: Vector, private readonly offset: number, readonly itemCount: number){}

    getItem(index: number): unknown {
        return toJs(this.vector.get(this.offset + index), this.vector.type, 'items');
    }
}

class DuckDBDataChunk {
    constructor(private readonly table: Table, private readonly offset: number, readonly rowCount: number){}

    get columnCount(): number {
        return this.table.schema.fields.length;
    }

    getColumnVector(index: number): DuckDBVector {
        return new DuckDBVector(this.table.getChildAt(index) as Vector, this.offset, this.rowCount);
    }
}

export class DuckDBStreamingResult {
    private offset = 0;

    constructor(private readonly table: Table){}

    get columnCount(): number {
        return this.table.schema.fields.length;
    }

    columnName(index: number): string {
        return this.table.schema.fields[index].name;
    }

    async fetchChunk(): Promise<DuckDBDataChunk | null> {
        if(this.offset >= this.table.numRows){
            return null;
        }
        const rows = Math.min(CHUNK_ROWS, this.table.numRows - this.offset);
        const chunk = new DuckDBDataChunk(this.table, this.offset, rows);
        this.offset += rows;
        return chunk;
    }
}

type AppendedValue = number | bigint | string | boolean | null;

const ARROW_TYPES: Record<string, () => DataType> = {
    BOOLEAN: () => new Bool(),
    TINYINT: () => new Int8(),
    SMALLINT: () => new Int16(),
    INTEGER: () => new Int32(),
    BIGINT: () => new Int64(),
    UTINYINT: () => new Uint8(),
    USMALLINT: () => new Uint16(),
    UINTEGER: () => new Uint32(),
    UBIGINT: () => new Uint64(),
    FLOAT: () => new Float32(),
    DOUBLE: () => new Float64(),
    VARCHAR: () => new Utf8()
};

// Rows appended before a flush; Arrow batches of this size keep the memory of a large ingest bounded.
const APPENDER_FLUSH_ROWS = 65_536;

export class DuckDBAppender {
    private readonly columns: { name: string; type: () => DataType; values: AppendedValue[] }[];
    private row: AppendedValue[] = [];
    private rowCount = 0;

    constructor(private readonly connection: WasmConnection, private readonly table: string, schema: { column_name: string; column_type: string }[]){
        this.columns = schema.map((column) => {
            const type = ARROW_TYPES[column.column_type];
            if(!type){
                throw new Error(`duckdb appender: column ${column.column_name} has unsupported type ${column.column_type}`);
            }
            return { name: column.column_name, type, values: [] };
        });
    }

    private append(value: AppendedValue): void {
        this.row.push(value);
    }

    appendBoolean(value: boolean): void { this.append(value); }
    appendTinyInt(value: number): void { this.append(value); }
    appendSmallInt(value: number): void { this.append(value); }
    appendInteger(value: number): void { this.append(value); }
    appendBigInt(value: bigint): void { this.append(value); }
    appendUTinyInt(value: number): void { this.append(value); }
    appendUSmallInt(value: number): void { this.append(value); }
    appendUInteger(value: number): void { this.append(value); }
    appendUBigInt(value: bigint): void { this.append(value); }
    appendFloat(value: number): void { this.append(value); }
    appendDouble(value: number): void { this.append(value); }
    appendVarchar(value: string): void { this.append(value); }
    appendNull(): void { this.append(null); }

    endRow(): void {
        if(this.row.length !== this.columns.length){
            throw new Error(`duckdb appender: row has ${this.row.length} values, table ${this.table} has ${this.columns.length} columns`);
        }
        this.row.forEach((value, index) => this.columns[index].values.push(value));
        this.row = [];
        this.rowCount += 1;
        if(this.rowCount >= APPENDER_FLUSH_ROWS){
            this.flushSync();
        }
    }

    flushSync(): void {
        if(this.rowCount === 0){
            return;
        }
        const vectors = Object.fromEntries(this.columns.map((column) => [column.name, vectorFromArray(column.values, column.type())]));
        this.connection.insertArrowTable(new Table(vectors), { name: this.table, create: false });
        for(const column of this.columns){
            column.values = [];
        }
        this.rowCount = 0;
    }

    closeSync(): void {
        this.flushSync();
    }
}

const bindValues = (connection: WasmConnection, sql: string, values?: readonly unknown[] | Record<string, unknown>): Table => {
    if(!values || (Array.isArray(values) && values.length === 0)){
        return connection.query(sql);
    }
    if(!Array.isArray(values)){
        throw new Error('duckdb: named parameters are not supported in the browser');
    }
    const statement = connection.prepare(sql);
    try{
        return statement.query(...values);
    }finally{
        statement.close();
    }
};

export class DuckDBConnection {
    private readonly connection: WasmConnection;

    private constructor(connection: WasmConnection){
        this.connection = connection;
    }

    static async create(): Promise<DuckDBConnection> {
        return new DuckDBConnection((await openDatabase()).connect());
    }

    async run(sql: string, values?: readonly unknown[] | Record<string, unknown>): Promise<DuckDBResultReader> {
        return new DuckDBResultReader(bindValues(this.connection, sql, values));
    }

    async runAndReadAll(sql: string, values?: readonly unknown[] | Record<string, unknown>): Promise<DuckDBResultReader> {
        return this.run(sql, values);
    }

    async stream(sql: string, values?: readonly unknown[] | Record<string, unknown>): Promise<DuckDBStreamingResult> {
        return new DuckDBStreamingResult(bindValues(this.connection, sql, values));
    }

    async createAppender(table: string): Promise<DuckDBAppender> {
        const schema = rowObjects(this.connection.query(`DESCRIBE ${table}`), 'array') as { column_name: string; column_type: string }[];
        return new DuckDBAppender(this.connection, table, schema);
    }

    closeSync(): void {
        this.connection.close();
    }

    disconnectSync(): void {
        this.closeSync();
    }
}

export class DuckDBInstance {
    static async create(): Promise<DuckDBInstance> {
        await openDatabase();
        return new DuckDBInstance();
    }

    async connect(): Promise<DuckDBConnection> {
        return DuckDBConnection.create();
    }

    closeSync(): void {}
}

