import trajectoryService from '@/modules/trajectory/api/services/trajectory';
import { trajectoryAtomsQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import formatAtomValue from '@/modules/trajectory/shared/format-atom-value';
import { useCallback, useMemo } from 'react';

import type { ColumnConfig } from '@/shared/presentation/components/DocumentListingTable';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { AtomData } from '@/modules/trajectory/api/dtos/trajectory';

interface PluginAtomsTableProps {
    trajectoryId: string;
    analysisId?: string;
    exposureId?: string;
    timestep?: number;
};

type AtomDataRow = AtomData & { _id: string };

interface AtomsListingContext {
    trajectoryId: string;
    analysisId: string;
    exposureId?: string;
    timestep: number;
};

const TYPE_PALETTE = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2',
    '#7f7f7f', '#bcbd22', '#17becf', '#aec7e8', '#ffbb78', '#98df8a', '#ff9896',
    '#c5b0d5', '#c49c94', '#f7b6d2', '#c7c7c7', '#dbdb8d', '#9edae5'
];

const ATOMS_PAGE_SIZE = 100;

/**
 * Returns a color for a given atom type index.
 *
 * @param t - 1-based atom type number.
 */
const getTypeColor = (t?: number): string => {
    if (t === undefined || t === null) return '#888888';
    const type = Math.max(1, Math.floor(t));
    if (type <= TYPE_PALETTE.length) return TYPE_PALETTE[type - 1];
    const hue = ((type - 1) * 47) % 360;
    return `hsl(${hue}deg 60% 55%)`;
};

const renderTypeCell = (v: unknown) => {
    const numericValue = typeof v === 'number' ? v : undefined;
    return (
        <div className='d-flex items-center gap-05'>
            <div
                style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: getTypeColor(numericValue)
                }}
            />
            {String(v)}
        </div>
    );
};

const BASE_COLUMNS: ColumnConfig<AtomDataRow>[] = [
    { key: 'id', title: 'ID', width: 80 },
    { key: 'type', title: 'Type', width: 80, render: renderTypeCell },
    { key: 'x', title: 'X', width: 100, render: (value: unknown) => formatAtomValue(value, 3) },
    { key: 'y', title: 'Y', width: 100, render: (value: unknown) => formatAtomValue(value, 3) },
    { key: 'z', title: 'Z', width: 100, render: (value: unknown) => formatAtomValue(value, 3) }
];

const PluginAtomsTable = ({
    trajectoryId,
    analysisId,
    exposureId,
    timestep
}: PluginAtomsTableProps) => {
    const currentTimestep = useEditorStore((state) => state.currentTimestep);
    const resolvedTimestep = timestep ?? currentTimestep;
    const resolvedAnalysisId = analysisId || 'default';
    const enabled = Boolean(trajectoryId && resolvedTimestep !== undefined);

    const metaParams = useMemo(() => ({
        trajectoryId,
        analysisId: resolvedAnalysisId,
        exposureId,
        timestep: resolvedTimestep ?? 0,
        page: 1,
        limit: 1
    }), [trajectoryId, resolvedAnalysisId, exposureId, resolvedTimestep]);

    const { data: metaResponse } = trajectoryAtomsQuery(metaParams, { enabled });

    const properties = metaResponse?._meta?.properties ?? [];

    const columns: ColumnConfig<AtomDataRow>[] = useMemo(() => {
        const extra: ColumnConfig<AtomDataRow>[] = properties.map((prop) => ({
            key: prop,
            title: prop,
            width: 120,
            render: (value: unknown) => formatAtomValue(value, 4)
        }));

        return [...BASE_COLUMNS, ...extra];
    }, [properties]);

    const context: AtomsListingContext = useMemo(() => ({
        trajectoryId,
        analysisId: resolvedAnalysisId,
        exposureId,
        timestep: resolvedTimestep ?? 0
    }), [trajectoryId, resolvedAnalysisId, exposureId, resolvedTimestep]);

    const queryKey = useMemo(
        () => ['trajectory', 'atoms-listing', context],
        [context]
    );

    const fetchData = useCallback(async (
        params: PaginationParams & AtomsListingContext
    ): Promise<PaginatedResponse<AtomDataRow>> => {
        const response = await trajectoryService.getAtoms({
            trajectoryId: params.trajectoryId,
            analysisId: params.analysisId,
            exposureId: params.exposureId,
            timestep: params.timestep,
            page: params.page,
            limit: params.limit
        });

        return {
            status: 'success',
            data: response.data.map((atom) => ({
                ...atom,
                _id: String(atom.id)
            })),
            pagination: response.pagination
        };
    }, []);

    return (
        <DocumentListing<AtomDataRow, AtomsListingContext>
            title='Particles'
            queryKey={queryKey}
            fetchData={fetchData}
            context={context}
            enabled={enabled}
            columns={columns}
            defaultLimit={ATOMS_PAGE_SIZE}
            compact
            hideHeader
            hideTabs
        />
    );
};

export default PluginAtomsTable;
