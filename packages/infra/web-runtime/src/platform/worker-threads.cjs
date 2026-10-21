// CommonJS shape of the built-in: one object whose isMainThread/parentPort/workerData are set when the realm is a thread.
module.exports = require('./worker-threads.ts').default;
