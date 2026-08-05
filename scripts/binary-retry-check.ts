/**
 * Comprueba el watchdog de progreso de BinaryExecutorService:
 *
 *  - un proceso mudo se declara estancado y se reintenta, sin quedarse colgado
 *  - un proceso que sigue escribiendo NO se mata, aunque tarde mas que el umbral
 *  - un proceso normal corre una sola vez
 *
 * Ejecutar dentro del contenedor del daemon:
 *   PLUGIN_PROCESS_STALL_TIMEOUT_MS=1500 npx tsx scripts/binary-retry-check.ts
 */
import { getBinaryExecutorService } from '@modules/plugin/services/runtime/BinaryExecutorService';

const service = getBinaryExecutorService();

const run = async (label: string, script: string, expectation: string): Promise<void> => {
    const systemLines: string[] = [];
    const startedAt = Date.now();
    const result = await service.executeProcess({
        jobId: `retry-check-${label}`,
        commandPath: '/bin/sh',
        args: ['-c', script],
        cwd: '/tmp',
        logSink: {
            handleChunk: ({ stream, text }) => {
                if (stream === 'system') systemLines.push(text.trim());
            }
        }
    });

    const retries = systemLines.filter((line) => line.includes('retrying')).length;
    console.log(`\n[${label}] esperado: ${expectation}`);
    console.log(`  code=${result.code} en ${Date.now() - startedAt}ms reintentos=${retries}`);
    for (const line of systemLines) console.log(`  system> ${line}`);
};

const main = async (): Promise<void> => {
    // Mudo y eterno: debe detectarse por inactividad y agotar los intentos.
    await run('mudo', 'sleep 300', 'estancado, 2 reintentos, code!=0');

    // Habla cada segundo durante 6s, por encima del umbral de 1.5s: no debe morir.
    await run('habla-lento', 'for i in 1 2 3 4 5 6; do echo progreso $i; sleep 1; done', 'termina bien, 0 reintentos, code=0');

    // Trivial.
    await run('rapido', 'echo ok', 'termina bien, 0 reintentos, code=0');
};

void main().then(() => process.exit(0));
