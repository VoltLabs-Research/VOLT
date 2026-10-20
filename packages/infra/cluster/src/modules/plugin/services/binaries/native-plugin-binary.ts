import { createReadStream } from 'node:fs';
import { currentPlatformTag } from '@shared/utilities/platform-tag';

const ELF_MAGIC = Buffer.from([0x7f, 0x45, 0x4c, 0x46]);
const PE_MAGIC = Buffer.from([0x4d, 0x5a]);

const readPrefix = async (filePath: string, length: number): Promise<Buffer> => {
    const stream = createReadStream(filePath, { start: 0, end: length - 1 });
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
};

export const assertNativePluginBinary = async (filePath: string): Promise<void> => {
    const prefix = await readPrefix(filePath, 4);
    if (process.platform === 'win32') {
        if (prefix.subarray(0, 2).equals(PE_MAGIC)) return;
        if (prefix.equals(ELF_MAGIC)) {
            throw new Error(
                `Plugin binary is a Linux executable and cannot run on ${currentPlatformTag()}. Reinstall the plugin for this Windows host.`
            );
        }
        throw new Error(`Plugin binary is not a Windows executable: ${filePath}`);
    }

    if (prefix.equals(ELF_MAGIC) || prefix.subarray(0, 2).equals(PE_MAGIC) || prefix[0] === 0xcf || prefix[0] === 0xca) {
        return;
    }
};
