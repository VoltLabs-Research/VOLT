import path from 'path';
import { decode } from '@msgpack/msgpack';
import { readBinaryFile } from '@utilities/fs';

export const readMsgpackFile = async (filePath: string): Promise<any> => {
    const { buffer, totalBytes } = await readBinaryFile(filePath);
    const fileSize = (totalBytes / 1024 / 1024).toFixed(2);
    console.log(`[OpenDXAService] Reading file ${path.basename(filePath)} (${fileSize} MB)`);
    return decode(buffer);
}