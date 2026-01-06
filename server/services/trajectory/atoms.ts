import { ErrorCodes } from '@/constants/error-codes';
import { Analysis, Plugin } from '@/models';
import { NodeType } from '@/types/models/modifier';
import RuntimeError from '@/utilities/runtime/runtime-error';
import DumpStorage from '@/services/trajectory/dump-storage';
import TrajectoryParserFactory from '@/parsers/factory';
import AtomProperties, { ExposureAtomConfig } from '@/services/trajectory/atom-properties';
import { asyncForLoop } from '@/utilities/runtime/async-loop';

export default class SimulationAtoms {
    private readonly atomProps: AtomProperties;

    constructor(
        private trajectoryId: string,
        private timestep: string
    ) {
        this.atomProps = new AtomProperties();
    }

    private async getAtomProperties(analysisId: string, exposureId: string): Promise<ExposureAtomConfig> {
        return this.atomProps.getExposureAtomConfig(analysisId, exposureId);
    }

    public async getFrameAtoms(
        analysisId: string,
        exposureId: string,
        page: number,
        pageSize: number
    ) {
        const startIndex = (page - 1) * pageSize;

        const [analysis, dumpPath] = await Promise.all([
            Analysis.findById(analysisId).lean(),
            DumpStorage.getDump(this.trajectoryId, this.timestep)
        ]);

        if (!analysis) throw new RuntimeError(ErrorCodes.ANALYSIS_NOT_FOUND, 404);
        if (!dumpPath) throw new RuntimeError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404);

        const plugin = await Plugin.findOne({ slug: analysis.plugin }).lean();
        if (!plugin) throw new RuntimeError(ErrorCodes.PLUGIN_NOT_FOUND, 404);

        const exposureNode = plugin.workflow.nodes.find(
            (node: any) => node.type === NodeType.EXPOSURE && String(node.id) === String(exposureId)
        );
        if (!exposureNode) throw new RuntimeError(ErrorCodes.PLUGIN_NODE_NOT_FOUND, 404);

        const config = await this.getAtomProperties(analysisId, exposureId);
        const perAtomProperties = config.perAtomProperties;

        const parsed = await TrajectoryParserFactory.parse(dumpPath, { includeIds: true });

        const totalAtoms = parsed.metadata.natoms;
        const endIndex = Math.min(startIndex + pageSize, totalAtoms);
        const rowCount = endIndex - startIndex;

        if (rowCount <= 0) {
            return {
                data: [],
                properties: [],
                page,
                pageSize,
                total: totalAtoms,
                hasMore: false
            };
        }

        const { positions, types, ids } = parsed;

        let pluginIndex: Map<number, any> | null = null;

        if (perAtomProperties.length > 0) {
            const targetIds = new Set<number>();
            for (let idx = 0; idx < rowCount; idx++) {
                const i = startIndex + idx;
                const atomId = ids ? ids[i] : i + 1;
                targetIds.add(atomId);
            }

            pluginIndex = await this.atomProps.buildPluginIndexForAtomIds(
                this.trajectoryId,
                analysisId,
                exposureId,
                this.timestep,
                targetIds
            );
        }

        // Build rows
        const rows = new Array(rowCount);
        const discoveredProps = new Set<string>();
        await asyncForLoop(0, rowCount, 1000, async (idx) => {
            const i = startIndex + idx;
            const base = i * 3;
            const atomId = ids ? ids[i] : i + 1;

            const row: any = {
                id: atomId,
                type: types?.[i],
                x: positions[base],
                y: positions[base + 1],
                z: positions[base + 2]
            };

            if (pluginIndex) {
                const item = pluginIndex.get(atomId);
                if (item) {
                    for (const prop of perAtomProperties) {
                        const value = item[prop];
                        if (value === undefined) continue;

                        if (Array.isArray(value)) {
                            const keys = config.schemaKeysMap.get(prop);
                            if (!keys?.length) continue;

                            for (let k = 0; k < keys.length; k++) {
                                const columnTitle = `${prop} ${keys[k]}`;
                                row[columnTitle] = value[k];
                                discoveredProps.add(columnTitle);
                            }
                        } else {
                            row[prop] = value;
                            discoveredProps.add(prop);
                        }
                    }
                }
            }

            rows[idx] = row;
        });

        return {
            data: rows,
            properties: Array.from(discoveredProps),
            page,
            pageSize,
            total: totalAtoms,
            hasMore: endIndex < totalAtoms
        };
    }
}
