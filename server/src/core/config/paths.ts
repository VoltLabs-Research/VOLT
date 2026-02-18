import path from 'path';

/**
 * Absolute path to the server's static/ directory, regardless of where this file is imported from.
 * Use this instead of fragile __dirname + '../../..' path chains.
 */
export const STATIC_ROOT = path.resolve(__dirname, '../../../static');
