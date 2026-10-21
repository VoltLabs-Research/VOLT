// The browser's Worker, captured before a program replaces the global: code written for Node may
// assign `global.Worker` (Emscripten's pthreads set it to worker_threads.Worker), which in a worker
// realm would otherwise be what the runtime starts its own workers with.
export const BrowserWorker = globalThis.Worker;
