// Node's `perf_hooks`: the High Resolution Time and Performance Timeline APIs it implements are the
// browser's own.
export const performance = globalThis.performance;
export const PerformanceObserver = globalThis.PerformanceObserver;

export default { performance, PerformanceObserver };
