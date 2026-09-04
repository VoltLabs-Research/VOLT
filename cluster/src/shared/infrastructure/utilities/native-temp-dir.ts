import fs from 'node:fs/promises';
import { withDir } from 'tmp-promise';
import { DAEMON_PATHS } from '@core/config/paths';

const NATIVE_PROCESSING_RUNTIME_DIR = DAEMON_PATHS.nativeProcessing;

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
