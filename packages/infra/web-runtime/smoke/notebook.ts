// Notebook smoke page: kernels this page runs (src/host/notebook-kernels.ts). A cell's result and
// what it prints, an error, top-level await, input(), an interrupt, completions, and a second kernel
// of the same workspace, which shares the first one's environment and files.
import { NotebookKernel } from '../src/host/notebook-kernels';
import type { KernelOutput, NotebookKernelEvent } from '../src/host/notebook-kernels';

const report = (step: string, value: unknown): void => console.log(`SMOKE ${step} ${JSON.stringify(value)}`);

const runtimeUrl = new URL('../', import.meta.url);

// What a cell shows, in short: images by their size, HTML by its start.
const summarize = (output: KernelOutput): unknown => {
    const data = output.data as Record<string, unknown> | undefined;
    if(!data){
        return output.output_type === 'error' ? { error: output.ename, value: output.evalue } : output;
    }
    return Object.fromEntries(Object.entries(data).map(([mime, value]) => [mime, typeof value === 'string' ? value.slice(0, 40) : value]));
};

const run = async (): Promise<void> => {
    const storage = await navigator.storage.getDirectory();
    await storage.removeEntry('volt-notebooks', { recursive: true }).catch(() => {});

    const startedAt = Date.now();
    const kernel = new NotebookKernel({ runtimeUrl, workspace: 'smoke', requirements: ['msgpack'] });
    const outputs = new Map<string, unknown[]>();
    kernel.subscribe((event: NotebookKernelEvent) => {
        if(event.type === 'output' && event.id){
            outputs.set(event.id, [...outputs.get(event.id) ?? [], summarize(event.output)]);
        }else if(event.type === 'input'){
            kernel.answerInput('Ada');
        }else if(event.type === 'exit'){
            report('exit', event.failure);
        }
    });
    await kernel.ready;
    report('ready', { seconds: Math.round((Date.now() - startedAt) / 1000) });

    const execute = async (step: string, code: string, onStart?: (id: string) => void): Promise<void> => {
        let cell = '';
        const reply = await kernel.execute(code, (id) => {
            cell = id;
            onStart?.(id);
        });
        report(step, { ...reply, outputs: outputs.get(cell) ?? [] });
    };
    await execute('result', 'x = 21\nx * 2');
    await execute('print', 'import sys\nprint("out")\nprint("err", file=sys.stderr)');
    await execute('exception', '1 / 0');
    await execute('await', 'import asyncio\nawait asyncio.sleep(0.01)\n"awaited"');
    await execute('input', 'print("hi", input("Name? "))');
    await execute('files', 'import msgpack, os\nopen("shared.txt", "w").write("from the first kernel")\nos.getcwd()');
    report('completion', await kernel.complete('import os\nos.pa', 15));
    const loop = execute('interrupt', 'while True:\n    pass');
    setTimeout(() => kernel.interrupt(), 1000);
    await loop;
    await execute('after-interrupt', 'x + 1');
    kernel.shutdown();

    const restartedAt = Date.now();
    const second = new NotebookKernel({ runtimeUrl, workspace: 'smoke', requirements: ['msgpack'] });
    second.subscribe((event) => {
        if(event.type === 'output' && event.id){
            outputs.set(event.id, [...outputs.get(event.id) ?? [], summarize(event.output)]);
        }
    });
    await second.ready;
    report('second-ready', { seconds: Math.round((Date.now() - restartedAt) / 1000) });
    let cell = '';
    const reply = await second.execute('import msgpack\nopen("shared.txt").read()', (id) => {
        cell = id;
    });
    report('shared', { ...reply, outputs: outputs.get(cell) ?? [] });
    second.shutdown();
    report('done', true);
};

run().catch((error: Error) => report('error', error.stack ?? error.message));
