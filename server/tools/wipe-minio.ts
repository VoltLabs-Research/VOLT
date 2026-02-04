import '@/config/env';
import { getMinioClient, initializeMinio } from '@/config/minio';
import logger from '@/logger';

const wipeMinIO = async() => {
    await initializeMinio();

    const client = getMinioClient();
    const buckets = await client.listBuckets();
    const promises = buckets.map(async({ name }) => {
        const objectsStream = client.listObjects(name, '', true);
        const objects: any[] = [];

        for await (const obj of objectsStream) {
            objects.push({ name: obj.name });
        }

        if(objects.length){
            await client.removeObjects(name, objects);
        }

        await client.removeBucket(name);
        logger.info(`[wipeMinIO]: ${name} OK`);
    });

    await Promise.all(promises);
};

wipeMinIO();
