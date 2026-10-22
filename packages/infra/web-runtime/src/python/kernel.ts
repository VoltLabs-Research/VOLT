// `python3 -m volt_kernel [REQUIREMENT...]`: a notebook's kernel (kernel.py), serving the page that
// started it over the process's IPC channel (kernel-protocol.ts). Its interpreter is a virtual
// environment's, created the first time and kept with the packages installed into it; the notebooks
// that share the environment share them. The requirements are installed before the kernel is ready.
import fs from 'fs';
import path from 'path';
import { SYSTEM_PYTHON, createEnvironment, importOwnModule, loadMicropip, processEnv, startPython } from './interpreter';
import { INPUT_ANSWERED, INPUT_DATA_BYTES, INPUT_HEADER_BYTES, INPUT_WAITING } from './kernel-protocol';
import type { KernelMessage, KernelRequest } from './kernel-protocol';

interface ExecuteReply {
    status: 'ok' | 'error';
    execution_count: number;
}

interface CompleteReply {
    matches: string[];
    cursor_start: number;
    cursor_end: number;
}

const decoder = new TextDecoder();

const send = (message: KernelMessage): void => {
    process.send?.(message);
};

export const runKernel = async (executable: string, requirements: string[]): Promise<number> => {
    // Requests that arrive while the interpreter starts wait for it.
    const requests: KernelRequest[] = [];
    let wake: (() => void) | null = null;
    process.on('message', (request: KernelRequest) => {
        requests.push(request);
        wake?.();
    });
    const next = async (): Promise<KernelRequest> => {
        while(requests.length === 0){
            await new Promise<void>((resolve) => {
                wake = resolve;
            });
        }
        wake = null;
        return requests.shift() as KernelRequest;
    };

    send({ type: 'status', state: 'starting' });
    const environment = path.dirname(path.dirname(executable));
    if(!fs.existsSync(path.join(environment, 'pyvenv.cfg'))){
        createEnvironment(environment, SYSTEM_PYTHON);
    }
    const python = await startPython(executable, [], processEnv());
    const interrupt = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));
    python.setInterruptBuffer(interrupt);

    const input = new SharedArrayBuffer(INPUT_HEADER_BYTES + INPUT_DATA_BYTES);
    const inputControl = new Int32Array(input, 0, 2);
    const inputData = new Uint8Array(input, INPUT_HEADER_BYTES);
    let current: string | null = null;
    // Blocks the interpreter until the page answers; undefined (None) when it cancels.
    const requestInput = (prompt: string, password: boolean): string | undefined => {
        Atomics.store(inputControl, 0, INPUT_WAITING);
        send({ type: 'input', id: current, prompt, password });
        Atomics.wait(inputControl, 0, INPUT_WAITING);
        if(Atomics.load(inputControl, 0) !== INPUT_ANSWERED){
            return undefined;
        }
        return decoder.decode(inputData.slice(0, inputControl[1]));
    };

    const kernel = importOwnModule(python, 'volt_kernel');
    kernel.start({ send: (message: string) => send(JSON.parse(message) as KernelMessage), requestInput });
    await loadMicropip(python);
    if(requirements.length > 0){
        send({ type: 'status', state: 'preparing' });
        await kernel.prepare(requirements);
    }
    send({ type: 'ready', interrupt, input });

    for(;;){
        if(requests.length === 0){
            send({ type: 'status', state: 'idle' });
        }
        const request = await next();
        if(request.type === 'execute'){
            send({ type: 'status', state: 'busy' });
            // An interrupt the page sent after the last execution ended is not this one's.
            Atomics.store(interrupt, 0, 0);
            current = request.id;
            const reply = JSON.parse(await kernel.execute(request.id, request.code) as string) as ExecuteReply;
            current = null;
            send({ type: 'reply', id: request.id, status: reply.status, executionCount: reply.execution_count });
            // The executions queued after one that failed do not run, as Jupyter stops on an error.
            if(reply.status === 'error'){
                for(const queued of requests.splice(0).filter((pending) => pending.type === 'execute')){
                    send({ type: 'reply', id: queued.id, status: 'aborted', executionCount: null });
                }
            }
        }else if(request.type === 'complete'){
            const reply = JSON.parse(kernel.complete(request.code, request.cursor) as string) as CompleteReply;
            send({ type: 'completion', id: request.id, matches: reply.matches, cursorStart: reply.cursor_start, cursorEnd: reply.cursor_end });
        }
    }
};
