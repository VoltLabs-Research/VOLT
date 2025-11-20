import { readMsgpackFile } from '@/utilities/msgpack';
import { decodeMultiStreamFromFile } from '@/utilities/msgpack-stream';

(async () => {
    const filePath = 'test.msgpack';
    try{
        const one = await readMsgpackFile(filePath);
        console.log('== SINGLE MESSAGE ==');
        console.dir(one, { depth: null });
        return;
    }catch(err: any){
        if(!(err instanceof RangeError) || !/Extra \d+ of \d+ byte\(s\) found/.test(err.message)){
            throw err;
        }
    }

    let i = 0;
    for await (const msg of decodeMultiStreamFromFile(filePath)){
        console.log(`\n===== MESSAGE #${i} =====`);
        console.dir(msg, { depth: null });
        i++;
    }
})();