// Installs Node's timers (./timers) as the globals, as they are in Node.
import timers from './timers';

Object.assign(globalThis, timers);

export {};
