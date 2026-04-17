import { createRequire } from 'node:module';
import path from 'node:path';
import fg from 'fast-glob';

const require = createRequire(__filename);

interface DiscoveredModuleExportContext {
    exportName: string;
    filePath: string;
    relativePath: string;
}

interface DiscoverModuleExportsConfig<TDiscovered> {
    filePattern: RegExp;
    roots: string[];
    mapExport: (context: DiscoveredModuleExportContext, exportedValue: unknown) => TDiscovered | null;
}

export const discoverModuleExports = async <TDiscovered>(
    config: DiscoverModuleExportsConfig<TDiscovered>
): Promise<TDiscovered[]> => {
    const sourceRoot = path.resolve(__dirname, '..', '..');
    const filePaths = (await fg(
        config.roots.map((root) => path.posix.join(root.replace(/\\/g, '/'), '**/*')),
        {
            cwd: sourceRoot,
            absolute: true,
            onlyFiles: true,
            dot: true,
            unique: true
        }
    ))
        .filter((filePath) => config.filePattern.test(path.basename(filePath)))
        .sort();
    const discovered: TDiscovered[] = [];

    for (const filePath of filePaths) {
        const moduleExports = require(filePath) as Record<string, unknown>;
        const relativePath = path
            .relative(sourceRoot, filePath)
            .replace(/\.(cjs|cts|js|ts)$/, '')
            .split(path.sep)
            .join('.');

        for (const [exportName, exportedValue] of Object.entries(moduleExports)) {
            const mappedExport = config.mapExport(
                {
                    exportName,
                    filePath,
                    relativePath
                },
                exportedValue
            );

            if (mappedExport) {
                discovered.push(mappedExport);
            }
        }
    }

    return discovered;
};
