import { FilesystemObjectStore } from '@shared/infrastructure/storage/FilesystemObjectStore';
import { ObjectBucketName } from '@shared/contracts/types/http-object-store';
import { Readable } from 'node:stream';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { DaemonConfig } from '@core/config/daemon';
import { createQaCheckHarness } from './qa-check-harness';

const { check, finish } = createQaCheckHarness(56);

const collect = async (stream: Readable): Promise<Buffer> => {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
};

const BUCKET = ObjectBucketName.Dumps;

const main = async (): Promise<void> => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qa-object-store-'));
    const store = new FilesystemObjectStore({
        objectStoreRoot: root,
        bucketPrefix: 'cluster-',
        allowedBuckets: [ObjectBucketName.Dumps, ObjectBucketName.Models]
    } as unknown as DaemonConfig);

    console.log('== buckets ==');
    await store.ensureBuckets();
    check('listBuckets', store.listBuckets(), [ObjectBucketName.Dumps, ObjectBucketName.Models]);
    check('el prefijo se aplica en disco', await fs.access(path.join(root, 'objects', `cluster-${BUCKET}`)).then(() => true), true);

    console.log('== put / stat / get ==');
    const body = Buffer.from('hola mundo, esto es un dump');
    await store.putObject({
        ownerClusterId: 'c1',
        bucket: BUCKET,
        objectKey: 'a/b/frame-0.dump',
        body,
        metadata: {
            'Content-Type': 'application/octet-stream',
            'Content-Encoding': 'zstd',
            'trajectory-id': 'traj-1'
        }
    } as never);

    const stat = await store.statObject(BUCKET, 'a/b/frame-0.dump');
    check('el tamaño coincide', stat.size, body.length);
    check('content-type nativo (sin prefijo)', stat.metaData['content-type'], 'application/octet-stream');
    check('content-encoding nativo (el camino zstd de los GLB)', stat.metaData['content-encoding'], 'zstd');
    check('metadato propio con prefijo x-amz-meta-', stat.metaData['x-amz-meta-trajectory-id'], 'traj-1');
    check('hay etag', typeof stat.etag === 'string' && stat.etag.length === 32, true);
    check('las claves con / son directorios', await fs.access(path.join(root, 'objects', `cluster-${BUCKET}`, 'a', 'b', 'frame-0.dump')).then(() => true), true);
    check('getObjectStream devuelve los bytes exactos', (await collect(await store.getObjectStream(BUCKET, 'a/b/frame-0.dump'))).toString(), body.toString());

    console.log('== lecturas por rango (el endpoint de átomos y Parquet) ==');
    check('rango desde el inicio', (await collect(await store.getObjectRangeStream(BUCKET, 'a/b/frame-0.dump', 0, 4))).toString(), 'hola');
    check('rango en medio', (await collect(await store.getObjectRangeStream(BUCKET, 'a/b/frame-0.dump', 5, 5))).toString(), 'mundo');
    check('rango hasta el último byte', (await collect(await store.getObjectRangeStream(BUCKET, 'a/b/frame-0.dump', body.length - 4, 4))).toString(), 'dump');

    console.log('== etag como firma de invalidación ==');
    const before = (await store.statObject(BUCKET, 'a/b/frame-0.dump')).etag;
    check('estable si no cambia el contenido', (await store.statObject(BUCKET, 'a/b/frame-0.dump')).etag, before);
    await store.putObject({ ownerClusterId: 'c1', bucket: BUCKET, objectKey: 'a/b/frame-0.dump', body: Buffer.from('otro contenido distinto'), metadata: {} } as never);
    check('cambia al reescribir con otro contenido', (await store.statObject(BUCKET, 'a/b/frame-0.dump')).etag !== before, true);

    console.log('== putObjectStream ==');
    const streamed = Buffer.from('a'.repeat(5000));
    await store.putObjectStream({
        ownerClusterId: 'c1',
        bucket: BUCKET,
        objectKey: 'streamed.bin',
        stream: Readable.from([streamed]),
        size: streamed.length,
        metadata: { 'Content-Type': 'application/x-parquet' }
    } as never);
    check('el stream se escribe entero', (await store.statObject(BUCKET, 'streamed.bin')).size, streamed.length);
    check('y su content-type', (await store.statObject(BUCKET, 'streamed.bin')).metaData['content-type'], 'application/x-parquet');

    console.log('== listado y paginación por cursor ==');
    for (const key of ['p/03', 'p/01', 'p/04', 'p/02', 'otro/x']) {
        await store.putObject({ ownerClusterId: 'c1', bucket: BUCKET, objectKey: key, body: Buffer.from(key), metadata: {} } as never);
    }
    check('listObjects filtra por prefijo y ordena', await store.listObjects(BUCKET, 'p/'), ['p/01', 'p/02', 'p/03', 'p/04']);
    const page1 = await store.listObjectsPage({ bucket: BUCKET, prefix: 'p/', limit: 2 } as never);
    check('primera página', page1.keys, ['p/01', 'p/02']);
    check('nextCursor es la última clave de la página', page1.nextCursor, 'p/02');
    const page2 = await store.listObjectsPage({ bucket: BUCKET, prefix: 'p/', limit: 2, cursor: page1.nextCursor } as never);
    check('segunda página continúa sin repetir', page2.keys, ['p/03', 'p/04']);
    check('sin tercera página', page2.nextCursor, undefined);
    check('los objects traen tamaño', page1.objects.every((o) => typeof o.contentLength === 'number'), true);

    console.log('== composeObject ==');
    for (const [key, text] of [['parts/1', 'uno-'], ['parts/2', 'dos-'], ['parts/3', 'tres']] as const) {
        await store.putObject({ ownerClusterId: 'c1', bucket: BUCKET, objectKey: key, body: Buffer.from(text), metadata: {} } as never);
    }
    await store.composeObject({
        bucket: BUCKET,
        objectKey: 'joined.bin',
        sourceObjectKeys: ['parts/1', 'parts/2', 'parts/3'],
        metadata: { 'Content-Type': 'application/zip' }
    });
    check('concatena en orden', (await collect(await store.getObjectStream(BUCKET, 'joined.bin'))).toString(), 'uno-dos-tres');
    check('y conserva su metadata', (await store.statObject(BUCKET, 'joined.bin')).metaData['content-type'], 'application/zip');

    console.log('== borrado ==');
    await store.removeObject(BUCKET, 'streamed.bin');
    check('removeObject borra los bytes', await store.getObjectStream(BUCKET, 'streamed.bin').then(() => 'existe').catch(() => 'ausente'), 'ausente');
    check('y su sidecar de metadatos', await fs.access(path.join(root, 'metadata', `cluster-${BUCKET}`, 'streamed.bin.json')).then(() => 'existe').catch(() => 'ausente'), 'ausente');
    check('deleteByPrefix cuenta lo borrado', await store.deleteByPrefix(BUCKET, 'parts/'), 3);
    check('y ya no lista nada', await store.listObjects(BUCKET, 'parts/'), []);

    console.log('== seguridad y robustez ==');
    check('rechaza una clave que escapa del bucket', await store.putObject({ ownerClusterId: 'c1', bucket: BUCKET, objectKey: '../../escapada', body: Buffer.from('x'), metadata: {} } as never).then(() => 'aceptada').catch(() => 'rechazada'), 'rechazada');
    check('rechaza escape en lectura', await store.getObjectStream(BUCKET, '../../etc/passwd').then(() => 'aceptada').catch(() => 'rechazada'), 'rechazada');
    await fs.writeFile(path.join(root, 'objects', `cluster-${BUCKET}`, 'huerfano.partial'), 'basura');
    check('un .partial de una escritura muerta no se lista', (await store.listObjects(BUCKET, '')).includes('huerfano.partial'), false);
    check('stat de un objeto ausente falla', await store.statObject(BUCKET, 'no-existe').then(() => 'ok').catch(() => 'falla'), 'falla');
    check('getObjectStream de un ausente RECHAZA la promesa, no emite error diferido', await store.getObjectStream(BUCKET, 'no-existe').then(() => 'resolvio').catch(() => 'rechazo'), 'rechazo');
    check('getObjectRangeStream de un ausente también rechaza', await store.getObjectRangeStream(BUCKET, 'no-existe', 0, 10).then(() => 'resolvio').catch(() => 'rechazo'), 'rechazo');
    check('listar un bucket vacío devuelve []', await store.listObjects(ObjectBucketName.Models, ''), []);

    const openBefore = (await fs.readdir('/proc/self/fd').catch(() => [])).length;
    for (let i = 0; i < 40; i += 1) {
        await collect(await store.getObjectStream(BUCKET, 'joined.bin'));
    }
    const openAfter = (await fs.readdir('/proc/self/fd').catch(() => [])).length;
    check('40 lecturas no fugan descriptores', openAfter - openBefore <= 2, true);

    await fs.rm(root, { recursive: true, force: true });
    finish();
};

main().catch((error: unknown) => {
    console.error('EXCEPCION', error);
    process.exit(1);
});
