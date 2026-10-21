// Injected into every backend bundle: free references to `process` and `Buffer` resolve here, as
// they resolve to Node's globals on the desktop.
import { Buffer } from 'buffer';
import browserProcess from './process';

Object.assign(globalThis, { process: browserProcess, Buffer, global: globalThis });

export { browserProcess as process, Buffer };
