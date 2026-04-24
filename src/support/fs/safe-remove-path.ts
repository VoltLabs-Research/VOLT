import fs from 'node:fs/promises';
import { logAndSwallow } from '@/support/error/errorMessage';

export const safeRemovePath = (
    targetPath: string,
    opts: { recursive?: boolean } = {}
): Promise<void> =>
    fs.rm(targetPath, { force: true, recursive: opts.recursive ?? false })
        .catch(logAndSwallow('warn', { path: targetPath }, 'Failed to remove path'));
