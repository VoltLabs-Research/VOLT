import { readMsgpackFile } from '@/utilities/msgpack';

(async () =>{
    const file = 'test.msgpack';
    console.log(await readMsgpackFile(file));
})();