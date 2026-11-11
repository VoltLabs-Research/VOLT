import { buffer } from 'node:stream/consumers';
import { singleton } from '@shared/utilities/singleton';
import { getConfig } from '@core/config/daemon';
import { logger } from '@shared/logger';
import { errorMessage } from '@shared/utilities/error-message';
import { mapLimited } from '@shared/utilities/map-limited';
import { isObjectNotFoundError } from '@shared/contracts/types/cluster-object-store';
import type { MissingObjectResolver } from '@shared/contracts/types/object-gateway';
import { getFilesystemObjectStore, type FilesystemObjectStore } from '@shared/storage/FilesystemObjectStore';
import { createZstdDecompressionStream } from '@shared/storage/storage-codec';
import {
    compressModel,
    isModelObjectKey,
    MODEL_BUCKET,
    MODEL_OBJECT_METADATA,
    MODEL_OBJECT_SUFFIX,
    toModelFormat
} from '@shared/storage/model-objects';
import { encodeFrameModel } from '@modules/trajectory/services/glb/frame-model';
import { getTrajectoryParser, type TrajectoryParser } from '@modules/trajectory/services/parsing/TrajectoryParser';

// Models stored before the current format were float32 glTF compressed with zstd, under keys ending
// in .glb.zst. Each one is converted once into the current format under the same name ending in
// MODEL_OBJECT_SUFFIX, and the old object is removed: trajectory frames are rebuilt from the frame
// data, so they get the frame's atom order (the old files were Morton-sorted), and every other model
// is re-encoded from the stored file. A read of a model that has not been converted yet converts it
// on the spot; a pass at startup converts the rest in the background.
const LEGACY_MODEL_SUFFIX = '.glb.zst';
const SWEEP_CONCURRENCY = 2;
const FRAME_MODEL_KEY = /^trajectory-([^/]+)\/timestep-(\d+)\.glb\.gz$/;

const toLegacyKey = (objectKey: string): string =>
    `${objectKey.slice(0, -MODEL_OBJECT_SUFFIX.length)}${LEGACY_MODEL_SUFFIX}`;

const toCurrentKey = (legacyKey: string): string =>
    `${legacyKey.slice(0, -LEGACY_MODEL_SUFFIX.length)}${MODEL_OBJECT_SUFFIX}`;

export class LegacyModelMigration implements MissingObjectResolver {
    private readonly inFlight = new Map<string, Promise<boolean>>();

    constructor(
        private readonly objectStore: FilesystemObjectStore,
        private readonly trajectoryParser: TrajectoryParser,
        private readonly ownClusterId: string
    ) {}

    /**
     * Converts the legacy object behind a current model key, if there is one. Resolves true when
     * the model exists now and did not before, so the caller can read it again.
     */
    convertMissing(bucket: string, objectKey: string): Promise<boolean> {
        if (bucket !== MODEL_BUCKET || !isModelObjectKey(objectKey)) {
            return Promise.resolve(false);
        }

        const running = this.inFlight.get(objectKey);
        if (running) return running;

        const conversion = this.convert(objectKey).finally(() => this.inFlight.delete(objectKey));
        this.inFlight.set(objectKey, conversion);
        return conversion;
    }

    /** Removes the legacy object behind a current model key, if there is one. Resolves true when it did. */
    async removeMissing(bucket: string, objectKey: string): Promise<boolean> {
        if (bucket !== MODEL_BUCKET || !isModelObjectKey(objectKey)) return false;
        if (await this.exists(objectKey)) return false;
        const legacyKey = toLegacyKey(objectKey);
        if (!(await this.exists(legacyKey))) return false;
        await this.objectStore.removeObject(MODEL_BUCKET, legacyKey);
        return true;
    }

    async sweep(): Promise<void> {
        const legacyKeys = (await this.objectStore.listObjects(MODEL_BUCKET, ''))
            .filter((key) => key.endsWith(LEGACY_MODEL_SUFFIX));
        if (legacyKeys.length === 0) return;

        logger.info(`@legacy-models: converting ${legacyKeys.length} stored models to the current format`);
        let converted = 0;
        let failed = 0;
        await mapLimited(legacyKeys, SWEEP_CONCURRENCY, async (legacyKey) => {
            try {
                await this.convertMissing(MODEL_BUCKET, toCurrentKey(legacyKey));
                converted++;
            } catch (error) {
                failed++;
                logger.warn(`@legacy-models: could not convert ${legacyKey}: ${errorMessage(error)}`);
            }
            if ((converted + failed) % 500 === 0) {
                logger.info(`@legacy-models: ${converted + failed}/${legacyKeys.length} models done`);
            }
        });
        logger.info(`@legacy-models: converted ${converted} models, ${failed} failed`);
    }

    private async exists(objectKey: string): Promise<boolean> {
        try {
            await this.objectStore.statObject(MODEL_BUCKET, objectKey);
            return true;
        } catch (error) {
            if (isObjectNotFoundError(error)) return false;
            throw error;
        }
    }

    private async convert(objectKey: string): Promise<boolean> {
        const legacyKey = toLegacyKey(objectKey);
        if (!(await this.exists(legacyKey))) return false;

        if (!(await this.exists(objectKey))) {
            const glb = await this.rebuildFrame(objectKey) ?? toModelFormat(await this.readLegacy(legacyKey));
            await this.objectStore.putObject({
                bucket: MODEL_BUCKET,
                objectKey,
                body: await compressModel(glb),
                metadata: { ...MODEL_OBJECT_METADATA }
            });
        }

        await this.objectStore.removeObject(MODEL_BUCKET, legacyKey);
        return true;
    }

    private async rebuildFrame(objectKey: string): Promise<Buffer | null> {
        const match = FRAME_MODEL_KEY.exec(objectKey);
        if (!match) return null;

        try {
            const parsed = await this.trajectoryParser.readFrame({
                trajectoryId: match[1],
                timestep: Number(match[2]),
                ownerClusterId: this.ownClusterId
            });
            return encodeFrameModel(parsed.positions, parsed.types);
        } catch (error) {
            logger.warn(`@legacy-models: frame data for ${objectKey} is unreadable, re-encoding the stored model: ${errorMessage(error)}`);
            return null;
        }
    }

    private async readLegacy(legacyKey: string): Promise<Buffer> {
        const decompressed = createZstdDecompressionStream(await this.objectStore.getObjectStream(MODEL_BUCKET, legacyKey));
        const [glb] = await Promise.all([buffer(decompressed.stream), decompressed.completion]);
        return glb;
    }
}

export const getLegacyModelMigration = singleton((): LegacyModelMigration => new LegacyModelMigration(
    getFilesystemObjectStore(),
    getTrajectoryParser(),
    getConfig().teamClusterId
));
