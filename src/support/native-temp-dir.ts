import fs from 'node:fs/promises';
import path from 'node:path';
import { withDir } from 'tmp-promise';

export const NATIVE_PROCESSING_RUNTIME_DIR = path.join(process.cwd(), '.runtime', 'native-processing');

export const withNativeProcessingTempDir = async <T>(
    prefix: string,
    action: (directoryPath: string) => Promise<T>
): Promise<T> => {
    await fs.mkdir(NATIVE_PROCESSING_RUNTIME_DIR, { recursive: true });

    return withDir(
        ({ path: directoryPath }) => action(directoryPath),
        {
            tmpdir: NATIVE_PROCESSING_RUNTIME_DIR,
            prefix: `${prefix}-`,
            unsafeCleanup: true
        }
    );
};
