import { existsSync } from 'node:fs';
import path from 'path';

const STATIC_CANDIDATES = [
    process.env.STATIC_ROOT,
    path.resolve(__dirname, '../../../static'),
    path.resolve(__dirname, '../../../../../static'),
    path.resolve(process.cwd(), 'static')
].filter((candidate): candidate is string => Boolean(candidate));

export const STATIC_ROOT = STATIC_CANDIDATES.find((candidate) => existsSync(candidate))
    ?? STATIC_CANDIDATES[0];
