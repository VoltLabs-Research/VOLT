import { deriveColumns } from '@modules/plugin/application/dtos/listing-row/DaemonListingTypes';

import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type { ColumnDef } from '@modules/plugin/application/dtos/listing-row/GetPluginListingDocumentsDTO';
import type { DaemonListingRow } from '@modules/plugin/application/dtos/listing-row/DaemonListingTypes';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import type Analysis from '@modules/analysis/domain/entities/Analysis';

interface EnrichDaemonListingRowsInput {
    rows: DaemonListingRow[];
    analysisRepository: IAnalysisRepository;
    trajectoryRepository: ITrajectoryRepository;
    fallbackAnalysisId?: string;
};

interface ColumnFactoryInput {
    key: string;
    label: string;
    sortable?: boolean;
};

const TRAJECTORY_COLUMN_KEY = 'trajectoryName';
const TIMESTEP_COLUMN_KEY = 'timestep';
const RESERVED_COLUMN_KEYS = new Set([TRAJECTORY_COLUMN_KEY, TIMESTEP_COLUMN_KEY]);

const createColumn = ({ key, label, sortable = true }: ColumnFactoryInput): ColumnDef => {
    return {
        key,
        label,
        sortable
    };
};

const buildDynamicColumns = (rows: DaemonListingRow[], daemonColumns?: string[]): ColumnDef[] => {
    const columns = daemonColumns?.length
        ? daemonColumns.map((column) => createColumn({ key: column, label: column }))
        : deriveColumns(rows);

    return columns.filter((column) => !RESERVED_COLUMN_KEYS.has(String(column.key ?? column.label)));
};

const resolveAnalysisIds = (rows: DaemonListingRow[], fallbackAnalysisId?: string): string[] => {
    const ids = new Set<string>();

    for (const row of rows) {
        const analysisId = row.analysis?.trim() || fallbackAnalysisId;
        if (analysisId) {
            ids.add(analysisId);
        }
    }

    return Array.from(ids);
};

const loadAnalyses = async (
    analysisIds: string[],
    analysisRepository: IAnalysisRepository
): Promise<Map<string, Analysis>> => {
    const analysisEntries = await Promise.all(analysisIds.map(async (analysisId) => {
        const analysis = await analysisRepository.findById(analysisId);
        return analysis ? [analysisId, analysis] as const : null;
    }));

    const analyses = new Map<string, Analysis>();
    for (const entry of analysisEntries) {
        if (!entry) {
            continue;
        }

        analyses.set(entry[0], entry[1]);
    }

    return analyses;
};

const resolveTrajectoryIds = (rows: DaemonListingRow[], analyses: Map<string, Analysis>): string[] => {
    const ids = new Set<string>();

    for (const row of rows) {
        const analysisId = row.analysis?.trim();
        const analysis = analysisId ? analyses.get(analysisId) : undefined;
        const trajectoryId = row.trajectory?.trim() || analysis?.props.trajectory;

        if (trajectoryId) {
            ids.add(trajectoryId);
        }
    }

    return Array.from(ids);
};

const loadTrajectoryNames = async (
    trajectoryIds: string[],
    trajectoryRepository: ITrajectoryRepository
): Promise<Map<string, string>> => {
    const trajectoryEntries = await Promise.all(trajectoryIds.map(async (trajectoryId) => {
        const trajectory = await trajectoryRepository.findById(trajectoryId);
        const trajectoryName = trajectory?.props.name?.trim();

        return trajectoryName ? [trajectoryId, trajectoryName] as const : null;
    }));

    const trajectoryNames = new Map<string, string>();
    for (const entry of trajectoryEntries) {
        if (!entry) {
            continue;
        }

        trajectoryNames.set(entry[0], entry[1]);
    }

    return trajectoryNames;
};

export const buildListingColumns = (rows: DaemonListingRow[], daemonColumns?: string[]): ColumnDef[] => {
    return [
        createColumn({ key: TRAJECTORY_COLUMN_KEY, label: 'Trajectory' }),
        createColumn({ key: TIMESTEP_COLUMN_KEY, label: 'Timestep' }),
        ...buildDynamicColumns(rows, daemonColumns)
    ];
};

export const buildListingExportColumns = (rows: DaemonListingRow[], daemonColumns?: string[]): string[] => {
    const dynamicColumns = buildDynamicColumns(rows, daemonColumns).map((column) => String(column.key ?? column.label));

    return Array.from(new Set([
        '_id',
        'analysisId',
        'trajectoryId',
        'trajectoryName',
        'timestep',
        'exposureId',
        ...dynamicColumns
    ]));
};

export const enrichDaemonListingRows = async ({
    rows,
    analysisRepository,
    trajectoryRepository,
    fallbackAnalysisId
}: EnrichDaemonListingRowsInput): Promise<DaemonListingRow[]> => {
    if (rows.length === 0) {
        return rows;
    }

    const analysisIds = resolveAnalysisIds(rows, fallbackAnalysisId);
    const analyses = await loadAnalyses(analysisIds, analysisRepository);
    const trajectoryIds = resolveTrajectoryIds(
        rows.map((row) => ({
            ...row,
            analysis: row.analysis?.trim() || fallbackAnalysisId || row.analysis
        })),
        analyses
    );
    const trajectoryNames = await loadTrajectoryNames(trajectoryIds, trajectoryRepository);

    return rows.map((row) => {
        const analysisId = row.analysis?.trim() || fallbackAnalysisId || '';
        const analysis = analysisId ? analyses.get(analysisId) : undefined;
        const trajectoryId = row.trajectory?.trim() || analysis?.props.trajectory || '';
        const trajectoryName = row.trajectoryName?.trim()
            || trajectoryNames.get(trajectoryId)
            || '';

        return {
            ...row,
            analysis: analysisId,
            trajectory: trajectoryId,
            trajectoryName,
            timestep: row.timestep ?? 0
        };
    });
};
