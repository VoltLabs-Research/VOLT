import { connectDatabase, disconnectDatabase } from '@core/bootstrap/connect-database';
import { getKeyValueStore, sweepExpiredKeyValues } from '@shared/infrastructure/keyvalue/KeyValueStore';

let failures = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if(!ok) failures += 1;
    console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label.padEnd(50)} expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
};

const main = async () => {
    await connectDatabase();
    const s = getKeyValueStore();
    const K = 'qa:kv:';
    await s.delete([`${K}a`, `${K}b`, `${K}ctr`, `${K}lock`, `${K}exp`]);
    await s.deleteSets([`${K}set`]);

    check('set on free key', await s.set(`${K}a`, '1'), true);
    check('get', await s.get(`${K}a`), '1');
    check('set NX blocked by live key', await s.set(`${K}a`, '2', { ifNotExists: true }), false);
    check('value did not change', await s.get(`${K}a`), '1');
    check('set without NX overwrites', await s.set(`${K}a`, '3'), true);
    check('exists', await s.exists(`${K}a`), true);
    check('exists on missing key', await s.exists(`${K}zzz`), false);

    check('adjust seeds', await s.adjust(`${K}ctr`, 1), 1);
    check('adjust increments', await s.adjust(`${K}ctr`, 1), 2);
    check('adjust decrements', await s.adjust(`${K}ctr`, -1), 1);

    // TTL: NX must be able to take an expired key
    await s.set(`${K}exp`, 'old', { ttlMs: 1 });
    await new Promise((r) => setTimeout(r, 30));
    check('get on expired key', await s.get(`${K}exp`), null);
    check('set NX on expired key', await s.set(`${K}exp`, 'new', { ifNotExists: true }), true);
    check('expire on live key', await s.expire(`${K}exp`, 60_000), true);
    check('expire on missing key', await s.expire(`${K}zzz`, 60_000), false);

    // compare-and-delete
    await s.set(`${K}lock`, 'token-A', { ttlMs: 60_000 });
    check('deleteIfValue with wrong token', await s.deleteIfValue(`${K}lock`, 'token-B'), false);
    check('lock still stands', await s.get(`${K}lock`), 'token-A');
    check('deleteIfValue with correct token', await s.deleteIfValue(`${K}lock`, 'token-A'), true);

    check('getMany keeps order and nulls', await s.getMany([`${K}a`, `${K}zzz`, `${K}ctr`]), ['3', null, '1']);
    check('deleteReturningPresent only live keys', (await s.deleteReturningPresent([`${K}a`, `${K}zzz`])).length, 1);

    // sets
    await s.setAdd(`${K}set`, ['x', 'y', 'z'], { ttlMs: 60_000 });
    await s.setAdd(`${K}set`, ['x'], { ttlMs: 60_000 });
    check('setCount deduplicates', await s.setCount(`${K}set`), 3);
    await s.setRemove(`${K}set`, ['y']);
    check('setMembers after removal', (await s.setMembers(`${K}set`)).sort(), ['x', 'z']);
    await s.setExpire(`${K}set`, 60_000);
    check('setExpire does not empty the set', await s.setCount(`${K}set`), 2);
    await s.deleteSets([`${K}set`]);
    check('deleteSets', await s.setCount(`${K}set`), 0);

    // named lock: truly serializes
    const order: string[] = [];
    await Promise.all([
        s.withLock(`${K}race`, async () => { order.push('a-enter'); await new Promise((r) => setTimeout(r, 120)); order.push('a-exit'); }),
        (async () => { await new Promise((r) => setTimeout(r, 20)); return s.withLock(`${K}race`, async () => { order.push('b-enter'); order.push('b-exit'); }); })()
    ]);
    check('withLock serializes (b does not enter while a holds it)', order, ['a-enter', 'a-exit', 'b-enter', 'b-exit']);

    check('sweep returns a number', typeof await sweepExpiredKeyValues(), 'number');
    await s.delete([`${K}ctr`, `${K}exp`]);
    await disconnectDatabase();
    console.log(`\n${failures === 0 ? 'ALL OK' : failures + ' FAILURES'}`);
    process.exit(failures === 0 ? 0 : 1);
};
main().catch((e) => { console.error('EXCEPTION', e); process.exit(1); });
