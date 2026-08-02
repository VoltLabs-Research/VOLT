import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import type { ITeamClusterObjectGatewayClient } from '@shared/contracts/ports';
import type LatexFile from '@modules/latex/models/LatexFile';
import type LatexAsset from '@modules/latex/models/LatexAsset';
import { sanitizeAssetPath } from '@modules/latex/services/LatexAssetStorage';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import pLimit from 'p-limit';

interface WorkDirManifest {
    inputs: Record<string, string>;
}

interface SyncableAsset {
    asset: LatexAsset;
    relPath: string;
    version: string;
}

const WORKDIR_MANIFEST_FILENAME = '.volt-latex-input-manifest.json';
const WORKDIR_SYNC_CONCURRENCY = 8;

export const fullPathOf = (file: Pick<LatexFile, 'name' | 'path'>): string =>
    (file.path ? `${file.path}${file.name}` : file.name);

const getWorkDirManifestPath = (workDir: string): string => {
    return path.join(workDir, WORKDIR_MANIFEST_FILENAME);
};

const buildLatexFileVersion = (file: LatexFile): string => {
    return `${file.id}:${fullPathOf(file)}:${file.updatedAt.toISOString()}`;
};

const buildAssetVersion = (asset: LatexAsset, relPath: string): string => {
    return `${asset.id}:${relPath}:${asset.storageKey}:${asset.size}:${asset.updatedAt.toISOString()}`;
};

const pathExistsAsFile = async (targetPath: string): Promise<boolean> => {
    try {
        const stats = await fs.lstat(targetPath);
        return !stats.isDirectory();
    } catch {
        return false;
    }
};

const readWorkDirManifest = async (workDir: string): Promise<WorkDirManifest> => {
    try {
        const rawManifest = await fs.readFile(getWorkDirManifestPath(workDir), 'utf-8');
        return JSON.parse(rawManifest) as WorkDirManifest;
    } catch {
        return { inputs: {} };
    }
};

const writeWorkDirManifest = async (workDir: string, manifest: WorkDirManifest): Promise<void> => {
    await fs.writeFile(getWorkDirManifestPath(workDir), JSON.stringify(manifest), 'utf-8');
};

const pruneEmptyWorkDirParents = async (workDir: string, targetPath: string): Promise<void> => {
    let currentDir = path.dirname(targetPath);

    while (currentDir !== workDir) {
        const entries = await fs.readdir(currentDir).catch(() => null);
        if (!entries || entries.length > 0) {
            return;
        }

        await fs.rmdir(currentDir).catch(() => undefined);
        currentDir = path.dirname(currentDir);
    }
};

const deleteManagedInput = async (workDir: string, relPath: string): Promise<void> => {
    const targetPath = path.join(workDir, relPath);
    await fs.rm(targetPath, {
        recursive: true,
        force: true
    }).catch(() => undefined);
    await pruneEmptyWorkDirParents(workDir, targetPath);
};

const ensureWritableInputPath = async (targetPath: string): Promise<void> => {
    const stats = await fs.lstat(targetPath).catch(() => null);
    if (stats?.isDirectory()) {
        await fs.rm(targetPath, {
            recursive: true,
            force: true
        });
    }
};

const buildSyncableAssets = (assets: LatexAsset[]): SyncableAsset[] => {
    return assets.map((asset) => {
        const relPath = sanitizeAssetPath(asset.path, asset.originalName);
        return {
            asset,
            relPath,
            version: buildAssetVersion(asset, relPath)
        };
    });
};

export const syncWorkDirInputs = async (
    workDir: string,
    latexFiles: LatexFile[],
    assets: LatexAsset[],
    storageClusterId: string,
    objectGatewayClient: ITeamClusterObjectGatewayClient
): Promise<void> => {
    const limit = pLimit(WORKDIR_SYNC_CONCURRENCY);
    const previousManifest = await readWorkDirManifest(workDir);
    const syncableAssets = buildSyncableAssets(assets);
    const nextExpectedInputs = new Map<string, string>();
    const syncedInputs = new Map<string, string>();

    for (const file of latexFiles) {
        nextExpectedInputs.set(fullPathOf(file), buildLatexFileVersion(file));
    }

    for (const asset of syncableAssets) {
        nextExpectedInputs.set(asset.relPath, asset.version);
    }

    const staleInputs = Object.keys(previousManifest.inputs)
        .filter((relPath) => !nextExpectedInputs.has(relPath));

    await Promise.all(staleInputs.map((relPath) => {
        return limit(() => deleteManagedInput(workDir, relPath));
    }));

    const syncInput = (relPath: string, write: (destPath: string) => Promise<boolean>): Promise<void> => {
        return limit(async () => {
            const version = nextExpectedInputs.get(relPath)!;
            const destPath = path.join(workDir, relPath);

            if (previousManifest.inputs[relPath] === version && await pathExistsAsFile(destPath)) {
                syncedInputs.set(relPath, version);
                return;
            }

            await fs.mkdir(path.dirname(destPath), { recursive: true });
            await ensureWritableInputPath(destPath);

            if (await write(destPath)) {
                syncedInputs.set(relPath, version);
            }
        });
    };

    await Promise.all(latexFiles.map((file) => {
        return syncInput(fullPathOf(file), async (destPath) => {
            await fs.writeFile(destPath, file.content, 'utf-8');
            return true;
        });
    }));

    await Promise.all(syncableAssets.map(({ asset, relPath }) => {
        return syncInput(relPath, async (destPath) => {
            try {
                const { stream } = await objectGatewayClient.getStream(
                    storageClusterId,
                    TEAM_CLUSTER_BUCKETS.LATEX_ASSETS,
                    asset.storageKey
                );

                await pipeline(stream, createWriteStream(destPath));
                return true;
            } catch {
                await deleteManagedInput(workDir, relPath);
                return false;
            }
        });
    }));

    await writeWorkDirManifest(workDir, {
        inputs: Object.fromEntries(syncedInputs)
    });
};
