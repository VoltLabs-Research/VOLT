import { connectDaemonDataSource, disconnectDaemonDataSource } from '@shared/infrastructure/persistence/DataSource';
import { getDaemonStateStore } from '@shared/infrastructure/persistence/DaemonStateStore';
import * as store from '@shared/infrastructure/queues/queue-job-store';

let failures = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) failures += 1;
    console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label.padEnd(52)} esperado=${JSON.stringify(expected)} obtenido=${JSON.stringify(actual)}`);
};

const main = async () => {
    await connectDaemonDataSource();
    const s = getDaemonStateStore();
    const Q = 'analysis_processing';
    const req = (jobKey: string, attempts = 1, backoff: string | null = null, delay: number | null = null) =>
        ({ queue: Q, jobKey, payload: { jobId: jobKey, n: 1 } as never, maxAttempts: attempts, backoffType: backoff, backoffDelayMs: delay });

    console.log('\n== DaemonStateStore ==');
    await s.deleteKeys(['k1', 'k2', 'lst']);
    check('setKeyIfAbsent en clave libre', await s.setKeyIfAbsent('k1', 'a', 60), true);
    check('setKeyIfAbsent bloqueado por clave viva', await s.setKeyIfAbsent('k1', 'b', 60), false);
    check('getValue devuelve el primero', await s.getValue('k1'), 'a');
    await s.setValueWithTtl('k2', '5', 60);
    check('decrementKey', await s.decrementKey('k2'), 4);
    check('decrementKey en clave ausente', await s.decrementKey('nunca-existio'), -1);
    check('deleteKeys cuenta las presentes', await s.deleteKeys(['k1', 'k2', 'ausente']), 2);
    check('getValue tras borrar', await s.getValue('k1'), null);
    await s.appendListWithTtl('lst', ['a', 'b', 'c'], 60);
    check('popListHead respeta el orden (1)', await s.popListHead('lst'), 'a');
    check('popListHead respeta el orden (2)', await s.popListHead('lst'), 'b');
    await s.appendListWithTtl('lst', ['z'], 60);
    check('appendListWithTtl reemplaza la lista', await s.popListHead('lst'), 'z');
    check('popListHead en lista vacia', await s.popListHead('lst'), null);
    check('sweep no revienta', typeof await (await import('@shared/infrastructure/persistence/DaemonStateStore')).sweepExpiredDaemonState(), 'number');

    console.log('\n== queue-job-store ==');
    await store.removeJobByKey('qa-1'); await store.removeJobByKey('qa-2'); await store.removeJobByKey('qa-3');
    check('insertJob', await store.insertJob(req('qa-1')), true);
    check('insertJob duplicado en estado vivo', await store.insertJob(req('qa-1')), false);
    check('isJobLive', await store.isJobLive(Q, 'qa-1'), true);
    const claimed = await store.claimNextJob(Q, 'w1', 60_000);
    check('claimNextJob devuelve una fila', claimed !== null, true);
    check('claimNextJob sube attemptsMade', claimed?.attemptsMade, 1);
    check('claimNextJob trae el payload', (claimed?.payload as { jobId: string })?.jobId, 'qa-1');
    check('renewLease del dueño', await store.renewLease(claimed!.id, 'w1', 60_000), true);
    check('renewLease de otro worker', await store.renewLease(claimed!.id, 'w2', 60_000), false);
    check('claimNextJob no reentrega lo activo', await store.claimNextJob(Q, 'w2', 60_000), null);
    check('failJob sin reintentos -> failed', await store.failJob(claimed!.id, 'boom'), 'failed');
    check('retryFailedJobByKey', await store.retryFailedJobByKey('qa-1'), true);
    check('retryFailedJobByKey sobre no-failed', await store.retryFailedJobByKey('qa-1'), false);
    const again = await store.claimNextJob(Q, 'w1', 60_000);
    check('deferJob no gasta intento', (await (async () => { await store.deferJob(again!.id, new Date(Date.now() - 1000)); const r = await store.claimNextJob(Q, 'w1', 60_000); return r?.attemptsMade; })()), 1);
    check('completeJob', await store.completeJob(again!.id).then(() => true), true);
    check('insertJob tras terminal (mismo key)', await store.insertJob(req('qa-1')), true);

    check('insertJobs en lote', await store.insertJobs(Q, [req('qa-2'), req('qa-3')]), 2);
    check('insertJobs omite duplicados vivos', await store.insertJobs(Q, [req('qa-2')]), 0);
    const counts = await store.countJobsByState(Q);
    check('countJobsByState suma', counts.waiting >= 3, true);
    check('findJobByKey', (await store.findJobByKey('qa-2'))?.jobKey, 'qa-2');
    check('removeJobByKey', await store.removeJobByKey('qa-2'), true);
    check('removeJobByKey inexistente', await store.removeJobByKey('no-existe'), false);

    // reintentos con backoff — la cola debe quedar vacia: claimNextJob coge el mas antiguo
    for (const k of ['qa-1','qa-2','qa-3']) await store.removeJobByKey(k);
    await store.removeJobByKey('qa-retry');
    await store.insertJob(req('qa-retry', 3, 'exponential', 100));
    const r1 = await store.claimNextJob(Q, 'w1', 60_000);
    check('el job reclamado es el esperado', r1?.jobKey, 'qa-retry');
    check('maxAttempts persistido', r1?.maxAttempts, 3);
    check('failJob con intentos restantes -> delayed', await store.failJob(r1!.id, 'x'), 'delayed');
    const backoffRow = await store.findJobByKey('qa-retry');
    check('el reintento queda programado en el futuro', new Date(backoffRow!.runAt).getTime() > Date.now(), true);

    // reclamo de leases caducados — de nuevo con la cola limpia
    await store.removeJobByKey('qa-retry');
    await store.removeJobByKey('qa-stall');
    await store.insertJob(req('qa-stall'));
    const st = await store.claimNextJob(Q, 'w1', 1);
    await new Promise((r) => setTimeout(r, 50));
    const reclaim1 = await store.reclaimStalledJobs();
    check('reclaimStalledJobs reencola el primer stall', reclaim1.requeued >= 1, true);
    await store.claimNextJob(Q, 'w1', 1);
    await new Promise((r) => setTimeout(r, 50));
    const reclaim2 = await store.reclaimStalledJobs();
    check('reclaimStalledJobs falla el segundo stall', reclaim2.failed >= 1, true);
    void st;

    check('purgeExpiredTerminalJobs no revienta', typeof await store.purgeExpiredTerminalJobs(), 'number');

    for (const k of ['qa-1','qa-2','qa-3','qa-retry','qa-stall']) await store.removeJobByKey(k);
    await disconnectDaemonDataSource();
    console.log(`\n${failures === 0 ? 'TODO OK' : failures + ' FALLOS'}`);
    process.exit(failures === 0 ? 0 : 1);
};
main().catch((e) => { console.error('EXCEPCION', e); process.exit(1); });
