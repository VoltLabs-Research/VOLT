import { extractTrajectoryTimesteps } from '@/modules/canvas/utilities/selected-timestep-analysis';
import useGetAtoms from '@/modules/trajectory/hooks/trajectory/use-get-atoms';
import useGetTrajectoryById from '@/modules/trajectory/hooks/trajectory/use-get-trajectory-by-id';
import { TRAJECTORY_QUERY_KEYS, trajectoryAtomsQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import formatAtomValue from '@/modules/trajectory/shared/format-atom-value';
import { atomsToAoS } from '@/modules/trajectory/utilities/decode-atoms-binary';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import { Select, Row, Text } from '@voltstack/bravais';
import type { SelectOption } from '@voltstack/bravais';
import { applySearchParamUpdates } from '@/shared/presentation/hooks/use-search-params';
import { useCallback, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import AtomTypeBadge from '../AtomTypeBadge';
import type { AtomData } from '@/modules/trajectory/api/services/trajectory-service';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListingTable';

interface PerAtomViewerContext {
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
}

interface AtomListingRow extends AtomData {
    _id: string;
}

interface PaginationRequestParams {
    page: number;
    limit: number;
}

type PerAtomViewerFetchParams = PaginationRequestParams & PerAtomViewerContext;

interface ColumnSkeletonConfig {
    variant: 'text';
    width: number;
}

const ID_SKELETON: ColumnSkeletonConfig = {
    variant: 'text',
    width: 60
};

const COORDINATE_SKELETON: ColumnSkeletonConfig = {
    variant: 'text',
    width: 80
};

const EMPTY_PROPERTIES: string[] = [];

const BASE_ATOM_COLUMN_KEYS = new Set(['id', 'type', 'x', 'y', 'z']);

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

    const getAtoms = useGetAtoms();
    const { trajectory } = useGetTrajectoryById({ trajectoryId, enabled: Boolean(trajectoryId) });
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
        const result = await getAtoms({
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
    }, [getAtoms]);

    const columns = useMemo<ColumnConfig[]>(() => {
        const baseCols: ColumnConfig[] = [
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
            {
                key: 'x',
                title: 'X',
                skeleton: COORDINATE_SKELETON,
                render: (value: unknown) => formatAtomValue(value, 3)
            },
            {
                key: 'y',
                title: 'Y',
                skeleton: COORDINATE_SKELETON,
                render: (value: unknown) => formatAtomValue(value, 3)
            },
            {
                key: 'z',
                title: 'Z',
                skeleton: COORDINATE_SKELETON,
                render: (value: unknown) => formatAtomValue(value, 3)
            }
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

    const listingQueryKey = useMemo(() => TRAJECTORY_QUERY_KEYS.perAtom(), []);

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
            queryKey={listingQueryKey}
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
