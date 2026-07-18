import { deriveColumns } from '@modules/plugin/utilities/listing-row/DaemonListingTypes';

import type { ColumnDef } from '@shared/contracts/dtos/GetPluginListingDocumentsDTO';
import type { DaemonListingRow } from '@modules/plugin/utilities/listing-row/DaemonListingTypes';

import AnalysisModel, { type AnalysisDocument } from '@modules/analysis/models/AnalysisModel';
import TrajectoryModel from '@modules/trajectory/models/trajectory/TrajectoryModel';

interface EnrichDaemonListingRowsInput {
    rows: DaemonListingRow[];
    fallbackAnalysisId?: string;
}

interface ColumnFactoryInput {
    key: string;
    label: string;
    sortable?: boolean;
}

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
    analysisIds: string[]
): Promise<Map<string, AnalysisDocument>> => {
    const analysisList = await AnalysisModel.find({ _id: { $in: analysisIds } }).exec();

    const analyses = new Map<string, AnalysisDocument>();
    for (const analysis of analysisList) {
        analyses.set(analysis._id.toString(), analysis);
    }

    return analyses;
};

const resolveTrajectoryIds = (rows: DaemonListingRow[], analyses: Map<string, AnalysisDocument>): string[] => {
    const ids = new Set<string>();

    for (const row of rows) {
        const analysisId = row.analysis?.trim();
        const analysis = analysisId ? analyses.get(analysisId) : undefined;
        const trajectoryId = row.trajectory?.trim() || analysis?.trajectory?.toString();

        if (trajectoryId) {
            ids.add(trajectoryId);
        }
    }

    return Array.from(ids);
};

const loadTrajectoryNames = async (
    trajectoryIds: string[]
): Promise<Map<string, string>> => {
    const trajectoryList = await TrajectoryModel.find({ _id: { $in: trajectoryIds } }).select('name').lean().exec();

    const trajectoryNames = new Map<string, string>();
    for (const trajectory of trajectoryList) {
        const trajectoryName = trajectory.name?.trim();
        if (!trajectoryName) {
            continue;
        }

        trajectoryNames.set(trajectory._id.toString(), trajectoryName);
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
    fallbackAnalysisId
}: EnrichDaemonListingRowsInput): Promise<DaemonListingRow[]> => {
    if (rows.length === 0) {
        return rows;
    }

    const analysisIds = resolveAnalysisIds(rows, fallbackAnalysisId);
    const analyses = await loadAnalyses(analysisIds);
    const trajectoryIds = resolveTrajectoryIds(
        rows.map((row) => ({
            ...row,
            analysis: row.analysis?.trim() || fallbackAnalysisId || row.analysis
        })),
        analyses
    );
    const trajectoryNames = await loadTrajectoryNames(trajectoryIds);

    return rows.map((row) => {
        const analysisId = row.analysis?.trim() || fallbackAnalysisId || '';
        const analysis = analysisId ? analyses.get(analysisId) : undefined;
        const trajectoryId = row.trajectory?.trim() || analysis?.trajectory?.toString() || '';
        const trajectoryName = trajectoryNames.get(trajectoryId) || '';

        return {
            ...row,
            analysis: analysisId,
            trajectory: trajectoryId,
            trajectoryName,
            timestep: row.timestep ?? 0
        };
    });
};
