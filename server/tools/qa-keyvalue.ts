import { connectDatabase, disconnectDatabase } from '@core/bootstrap/connect-database';
import { getKeyValueStore, sweepExpiredKeyValues } from '@shared/infrastructure/keyvalue/KeyValueStore';

let failures = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if(!ok) failures += 1;
    console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label.padEnd(50)} esperado=${JSON.stringify(expected)} obtenido=${JSON.stringify(actual)}`);
};

const main = async () => {
    await connectDatabase();
    const s = getKeyValueStore();
    const K = 'qa:kv:';
    await s.delete([`${K}a`, `${K}b`, `${K}ctr`, `${K}lock`, `${K}exp`]);
    await s.deleteSets([`${K}set`]);

    check('set en clave libre', await s.set(`${K}a`, '1'), true);
    check('get', await s.get(`${K}a`), '1');
    check('set NX bloqueado por clave viva', await s.set(`${K}a`, '2', { ifNotExists: true }), false);
    check('el valor no cambio', await s.get(`${K}a`), '1');
    check('set sin NX sobrescribe', await s.set(`${K}a`, '3'), true);
    check('exists', await s.exists(`${K}a`), true);
    check('exists en ausente', await s.exists(`${K}zzz`), false);

    check('adjust siembra', await s.adjust(`${K}ctr`, 1), 1);
    check('adjust incrementa', await s.adjust(`${K}ctr`, 1), 2);
    check('adjust decrementa', await s.adjust(`${K}ctr`, -1), 1);

    // TTL: NX debe poder tomar una clave caducada
    await s.set(`${K}exp`, 'viejo', { ttlMs: 1 });
    await new Promise((r) => setTimeout(r, 30));
    check('get de clave caducada', await s.get(`${K}exp`), null);
    check('set NX sobre clave caducada', await s.set(`${K}exp`, 'nuevo', { ifNotExists: true }), true);
    check('expire sobre clave viva', await s.expire(`${K}exp`, 60_000), true);
    check('expire sobre clave ausente', await s.expire(`${K}zzz`, 60_000), false);

    // compare-and-delete
    await s.set(`${K}lock`, 'token-A', { ttlMs: 60_000 });
    check('deleteIfValue con token equivocado', await s.deleteIfValue(`${K}lock`, 'token-B'), false);
    check('el cerrojo sigue en pie', await s.get(`${K}lock`), 'token-A');
    check('deleteIfValue con el token correcto', await s.deleteIfValue(`${K}lock`, 'token-A'), true);

    check('getMany mantiene el orden y los nulos', await s.getMany([`${K}a`, `${K}zzz`, `${K}ctr`]), ['3', null, '1']);
    check('deleteReturningPresent solo lo vivo', (await s.deleteReturningPresent([`${K}a`, `${K}zzz`])).length, 1);

    // conjuntos
    await s.setAdd(`${K}set`, ['x', 'y', 'z'], { ttlMs: 60_000 });
    await s.setAdd(`${K}set`, ['x'], { ttlMs: 60_000 });
    check('setCount deduplica', await s.setCount(`${K}set`), 3);
    await s.setRemove(`${K}set`, ['y']);
    check('setMembers tras quitar', (await s.setMembers(`${K}set`)).sort(), ['x', 'z']);
    await s.setExpire(`${K}set`, 60_000);
    check('setExpire no vacia el conjunto', await s.setCount(`${K}set`), 2);
    await s.deleteSets([`${K}set`]);
    check('deleteSets', await s.setCount(`${K}set`), 0);

    // cerrojo con nombre: serializa de verdad
    const order: string[] = [];
    await Promise.all([
        s.withLock(`${K}race`, async () => { order.push('a-entra'); await new Promise((r) => setTimeout(r, 120)); order.push('a-sale'); }),
        (async () => { await new Promise((r) => setTimeout(r, 20)); return s.withLock(`${K}race`, async () => { order.push('b-entra'); order.push('b-sale'); }); })()
    ]);
    check('withLock serializa (b no entra dentro de a)', order, ['a-entra', 'a-sale', 'b-entra', 'b-sale']);

    check('sweep devuelve un numero', typeof await sweepExpiredKeyValues(), 'number');
    await s.delete([`${K}ctr`, `${K}exp`]);
    await disconnectDatabase();
    console.log(`\n${failures === 0 ? 'TODO OK' : failures + ' FALLOS'}`);
    process.exit(failures === 0 ? 0 : 1);
};
main().catch((e) => { console.error('EXCEPCION', e); process.exit(1); });
