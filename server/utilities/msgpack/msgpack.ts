import { decode } from '@msgpack/msgpack';
import { readBinaryFile } from '@utilities/fs';

export const readMsgpackFile = async(filePath: string): Promise<any> =>{
    const { buffer } = await readBinaryFile(filePath);
    return decode(buffer);
}
