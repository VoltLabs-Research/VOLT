// The messages between a notebook's kernel (kernel.ts, a python3 process) and the page that started
// it (src/host/notebook-kernels.ts), over the process's IPC channel. Outputs are nbformat's.

export type KernelRequest =
    | { type: 'execute'; id: string; code: string }
    | { type: 'complete'; id: string; code: string; cursor: number };

// An output of nbformat: stream, display_data, execute_result or error.
export type KernelOutput = { output_type: string } & Record<string, unknown>;

export type KernelState = 'starting' | 'preparing' | 'idle' | 'busy';

export type KernelMessage =
    | { type: 'status'; state: KernelState }
    // Shared with the page: the interpreter's interrupt buffer, and the channel input() reads from.
    | { type: 'ready'; interrupt: Int32Array; input: SharedArrayBuffer }
    // An output of the execution `id`, or of the kernel's preparation when null.
    | { type: 'output'; id: string | null; output: KernelOutput }
    | { type: 'clear'; id: string | null; wait: boolean }
    // input() or getpass() waits for the page's answer on the input channel.
    | { type: 'input'; id: string | null; prompt: string; password: boolean }
    // How an execution ended: 'aborted' when an earlier one failed before it ran.
    | { type: 'reply'; id: string; status: 'ok' | 'error' | 'aborted'; executionCount: number | null }
    | { type: 'completion'; id: string; matches: string[]; cursorStart: number; cursorEnd: number };

// What the page writes to the interrupt buffer: Python raises KeyboardInterrupt in the running cell.
export const SIGINT = 2;

// The input channel: Int32 words [state, length], then the answer's UTF-8 bytes.
export const INPUT_WAITING = 0;
export const INPUT_ANSWERED = 1;
export const INPUT_CANCELLED = 2;
export const INPUT_HEADER_BYTES = 8;
export const INPUT_DATA_BYTES = 64 * 1024;
