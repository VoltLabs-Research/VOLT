import { extractTrajectoryTimesteps } from '@/modules/canvas/utils/selected-timestep-analysis';
import useGetTrajectoryById from '@/modules/trajectory/hooks/trajectory/use-get-trajectory-by-id';
import { TRAJECTORY_QUERY_KEYS, fetchTrajectoryAtoms, trajectoryAtomsQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import formatAtomValue from '@/modules/trajectory/utils/format-atom-value';
import { atomsToAoS } from '@/modules/trajectory/utils/decode-atoms-binary';
import DocumentListing from '@/shared/ui/components/DocumentListing';
import { Select, Row, Text } from '@voltstack/bravais';
import type { SelectOption } from '@voltstack/bravais';
import { applySearchParamUpdates } from '@/shared/ui/hooks/use-search-params';
import { useCallback, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import AtomTypeBadge from '../AtomTypeBadge';
import type { AtomData } from '@/modules/trajectory/api/services/trajectory-service';
import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { PaginationParams } from '@/shared/ui/hooks/use-pagination-params';
import type { ColumnConfig } from '@/shared/ui/components/DocumentListingTable';

interface PerAtomViewerContext {
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
}

interface AtomListingRow extends AtomData {
    _id: string;
}

type PerAtomViewerFetchParams = Pick<PaginationParams, 'page' | 'limit'> & PerAtomViewerContext;

const ID_SKELETON = {
    variant: 'text',
    width: 60
} as const;

const COORDINATE_SKELETON = {
    variant: 'text',
    width: 80
} as const;

const EMPTY_PROPERTIES: string[] = [];

const COORDINATE_KEYS = ['x', 'y', 'z'] as const;

const BASE_ATOM_COLUMN_KEYS = new Set<string>(['id', 'type', ...COORDINATE_KEYS]);

const renderAtomTypeBadge = (value: unknown) => {
    if (typeof value !== 'string' && typeof value !== 'number') {
        return <AtomTypeBadge type='-' />;
    }

    return <AtomTypeBadge type={value} />;
};

const parseTimestepParam = (value: string | null): number | undefined => {
    if (value === null) {
        return undefined;
    }

    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue)) {
        return undefined;
    }

    return parsedValue;
};

export default function PerAtomViewer() {
    const { trajectoryId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const analysisId = searchParams.get('analysisId') ?? undefined;
    const requestedTimestep = parseTimestepParam(searchParams.get('timestep'));

    const { trajectory } = useGetTrajectoryById({
        trajectoryId,
        enabled: Boolean(trajectoryId)
    });
    const availableTimesteps = useMemo(() => extractTrajectoryTimesteps(trajectory), [trajectory]);
    const timestep = useMemo(() => {
        if (requestedTimestep !== undefined && availableTimesteps.includes(requestedTimestep)) {
            return requestedTimestep;
        }

        return availableTimesteps[0];
    }, [availableTimesteps, requestedTimestep]);
    const isEnabled = Boolean(trajectoryId && timestep !== undefined);

    useEffect(() => {
        if (timestep === undefined || searchParams.get('timestep') === String(timestep)) {
            return;
        }

        setSearchParams((prev) => applySearchParamUpdates(prev, { timestep }), { replace: true });
    }, [searchParams, setSearchParams, timestep]);

    const firstPageAtomsParams = useMemo(() => ({
        trajectoryId: trajectoryId ?? '',
        analysisId,
        timestep: timestep ?? 0,
        page: 1,
        limit: 100
    }), [trajectoryId, analysisId, timestep]);

    const firstPageAtomsQuery = trajectoryAtomsQuery(firstPageAtomsParams, { enabled: isEnabled });

    const properties = firstPageAtomsQuery.data?.propertyNames ?? EMPTY_PROPERTIES;

    const timestepOptions = useMemo<SelectOption[]>(() => {
        return availableTimesteps.map((availableTimestep) => ({
            value: String(availableTimestep),
            title: String(availableTimestep)
        }));
    }, [availableTimesteps]);

    const handleTimestepChange = useCallback((value: string) => {
        const nextTimestep = Number(value);
        if (!Number.isFinite(nextTimestep)) {
            return;
        }

        setSearchParams((prev) => applySearchParamUpdates(prev, { timestep: nextTimestep }));
    }, [setSearchParams]);

    const fetchData = useCallback(async (params: PerAtomViewerFetchParams): Promise<PaginatedResponse<AtomListingRow>> => {
        const result = await fetchTrajectoryAtoms({
            trajectoryId: params.trajectoryId,
            analysisId: params.analysisId,
            timestep: params.timestep,
            page: params.page,
            limit: params.limit
        });

        const rows = atomsToAoS(result).map((atom) => ({
            ...atom,
            _id: String(atom.id)
        }));

        return {
            status: 'success',
            data: rows,
            pagination: {
                page: result.page,
                limit: result.limit,
                total: result.total,
                totalPages: result.totalPages,
                hasMore: result.page < result.totalPages
            }
        };
    }, []);

    const columns = useMemo<ColumnConfig<AtomListingRow>[]>(() => {
        const baseCols: ColumnConfig<AtomListingRow>[] = [
            {
                key: 'id',
                title: 'ID',
                skeleton: ID_SKELETON
            },
            {
                key: 'type',
                title: 'Type',
                skeleton: ID_SKELETON,
                render: renderAtomTypeBadge
            },
            ...COORDINATE_KEYS.map((key): ColumnConfig<AtomListingRow> => ({
                key,
                title: key.toUpperCase(),
                skeleton: COORDINATE_SKELETON,
                render: (value: unknown) => formatAtomValue(value, 3)
            }))
        ];

        const extraProperties = [...new Set(properties)].filter((prop) => !BASE_ATOM_COLUMN_KEYS.has(prop));
        for (const prop of extraProperties) {
            baseCols.push({
                key: prop,
                title: prop,
                skeleton: COORDINATE_SKELETON,
                render: (value: unknown) => formatAtomValue(value, 6)
            });
        }

        return baseCols;
    }, [properties]);

    const listingContext: PerAtomViewerContext = useMemo(() => ({
        trajectoryId: trajectoryId ?? '',
        analysisId,
        timestep: timestep ?? 0
    }), [trajectoryId, analysisId, timestep]);

    const headerActions = useMemo(() => {
        if (timestep === undefined || !timestepOptions.length) {
            return null;
        }

        return (
            <Row gap='075'>
                <Text as='p' size='sm' tone='muted'>Timestep</Text>
                <Select
                    isEditable
                    options={timestepOptions}
                    value={String(timestep)}
                    onChange={handleTimestepChange}
                    placeholder={String(timestep)}
                    className='form-field-canvas-input--compact'
                    showSelectionIcon={false}
                    title='Select timestep'
                    aria-label='Select timestep'
                />
            </Row>
        );
    }, [handleTimestepChange, timestep, timestepOptions]);

    return (
        <DocumentListing<AtomListingRow, PerAtomViewerContext>
            title={`Per-Atom Properties - Frame ${timestep ?? '-'}`}
            queryKey={TRAJECTORY_QUERY_KEYS.perAtom()}
            columns={columns}
            fetchData={fetchData}
            context={listingContext}
            defaultLimit={100}
            enabled={isEnabled}
            headerActions={headerActions}
            emptyMessage='No atoms data found.'
        />
    );
}
