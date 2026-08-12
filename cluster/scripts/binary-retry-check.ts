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
    await run('mudo', 'sleep 300', 'estancado, 2 reintentos, code!=0');

    await run('habla-lento', 'for i in 1 2 3 4 5 6; do echo progreso $i; sleep 1; done', 'termina bien, 0 reintentos, code=0');

    await run('rapido', 'echo ok', 'termina bien, 0 reintentos, code=0');
};

void main().then(() => process.exit(0));
