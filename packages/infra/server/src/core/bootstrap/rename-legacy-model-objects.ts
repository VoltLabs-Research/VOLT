import type { DataSource } from 'typeorm';
import logger from '@shared/logger';

// Clusters stored models as zstd-compressed float32 glTF under names ending in .glb.zst; they now
// store the quantized format gzipped under the same names ending in .glb.gz, and convert each old
// object on its first read (see the daemon's LegacyModelMigration). The artifact rows that point
// at the old names move to the new ones once, here.
export const renameLegacyModelObjects = async (dataSource: DataSource): Promise<void> => {
    const runner = dataSource.createQueryRunner();

    try{
        if(!await runner.hasTable('trajectory_scene_artifacts')) return;

        const [{ count }] = await runner.query(
            `SELECT COUNT(*) AS count FROM trajectory_scene_artifacts WHERE "objectName" LIKE '%.glb.zst'`
        );
        if(Number(count) === 0) return;

        await runner.query(
            `UPDATE trajectory_scene_artifacts
             SET "objectName" = substr("objectName", 1, length("objectName") - 4) || '.gz'
             WHERE "objectName" LIKE '%.glb.zst'`
        );
        logger.info(`@database: pointed ${count} scene artifacts at their gzip models`);
    }finally{
        await runner.release();
    }
};
