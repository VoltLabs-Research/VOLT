import type { DataSource, EntityManager } from 'typeorm';

type Transaction = (...args: unknown[]) => Promise<unknown>;

// better-sqlite3 runs on one connection, which TypeORM's driver hands to every transaction. Two that
// start together both find no transaction open and both send BEGIN; the second fails with "cannot
// start a transaction within a transaction". The root manager's transactions therefore run one at a
// time. One opened inside another, through the manager it was given, is a savepoint as before.
export const serializeSqliteTransactions = (dataSource: DataSource): void => {
    const manager = dataSource.manager;
    const transaction = manager.transaction.bind(manager) as Transaction;
    let tail: Promise<unknown> = Promise.resolve();

    manager.transaction = ((...args: unknown[]) => {
        const run = tail.then(() => transaction(...args));
        tail = run.catch(() => undefined);
        return run;
    }) as EntityManager['transaction'];
};
