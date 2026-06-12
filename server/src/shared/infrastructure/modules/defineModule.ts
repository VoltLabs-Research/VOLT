import type { ModuleManifest } from './types';

/**
 * Identity helper used to declare a detachable module. It does nothing at
 * runtime beyond returning its argument; its value is purely in editor support:
 * call sites get full type-checking of the manifest shape and the symbol makes
 * module declarations greppable/discoverable across the codebase.
 *
 * @example
 * export default defineModule({
 *     key: 'latex',
 *     tier: 'leaf',
 *     requires: ['cluster'],
 *     description: 'Render LaTeX documents via a connected cluster.',
 * });
 */
export const defineModule = (m: ModuleManifest): ModuleManifest => m;
