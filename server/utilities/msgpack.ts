import fs from 'fs/promises';
import path from 'path';
import { decode } from '@msgpack/msgpack';

export const readMsgpackFile = async (filePath: string): Promise<any> => {
    const fileBuffer = await fs.readFile(filePath);
    const fileSize = (fileBuffer.byteLength / 1024 / 1024).toFixed(2);
    console.log(`[OpenDXAService] Reading file ${path.basename(filePath)} (${fileSize}) MB)`);
    
    return decode(fileBuffer);
}