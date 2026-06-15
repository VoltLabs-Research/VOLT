import { extractTrajectoryTimesteps } from '@/modules/canvas/utilities/selected-timestep-analysis';
import { fetchTrajectoryAtoms } from '@/modules/trajectory/hooks/trajectory/queries';
import useGetTrajectoryById from '@/modules/trajectory/hooks/trajectory/use-get-trajectory-by-id';
import { TRAJECTORY_QUERY_KEYS, trajectoryAtomsQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import formatAtomValue from '@/modules/trajectory/shared/format-atom-value';
import { atomsToAoS } from '@/modules/trajectory/utilities/decode-atoms-binary';
import { useAtomSelectionLink } from '@/modules/canvas/hooks/use-atom-selection';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import { Select, Row, Text } from '@voltstack/bravais';
import type { SelectOption } from '@voltstack/bravais';
import { applySearchParamUpdates } from '@/shared/presentation/hooks/use-search-params';
import { useCallback, useEffect, useMemo } from 'react';
import type { MouseEvent } from 'react';
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

// Mirrors the per-atom selection into the table: a filled dot for selected
// atoms (picked in 3D or clicked here), an empty slot otherwise. The highlight
// color matches the 3D overlay so the two surfaces read as one selection.
const AtomSelectionIndicator = ({ selected }: { selected: boolean }) => (
    <span
        aria-hidden='true'
        style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: selected ? '#ffd400' : 'transparent',
            boxShadow: selected ? '0 0 0 1px rgba(0,0,0,0.25)' : 'none'
        }}
    />
);

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

    const { trajectory } = useGetTrajectoryById({ trajectoryId, enabled: Boolean(trajectoryId) });
    const availableTimesteps = useMemo(() => extractTrajectoryTimesteps(trajectory), [trajectory]);
    const timestep = useMemo(() => {
        if (requestedTimestep !== undefined && availableTimesteps.includes(requestedTimestep)) {
            return requestedTimestep;
        }

        return availableTimesteps[0];
    }, [availableTimesteps, requestedTimestep]);
    const isEnabled = Boolean(trajectoryId && timestep !== undefined);

    const { isRowSelected, onRowClick } = useAtomSelectionLink({ trajectoryId, timestep });

    const handleRowClick = useCallback((item: AtomListingRow, event: MouseEvent): boolean => {
        const atomId = Number(item.id);
        if (!Number.isFinite(atomId)) return false;
        onRowClick(atomId, { shift: event.shiftKey, ctrl: event.ctrlKey || event.metaKey });
        // Returning false keeps the listing's own multi-select machinery from
        // also reacting — this click drives the 3D selection only.
        return false;
    }, [onRowClick]);

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
                key: '_selected',
                title: '',
                width: 28,
                skeleton: { variant: 'rounded', width: 10, height: 10 },
                // Selection mirror: a filled dot marks atoms currently selected
                // (in 3D or here). Reading isRowSelected keeps the table in sync
                // with picks without the table owning any selection state.
                render: (_value: unknown, row: AtomListingRow) => (
                    <AtomSelectionIndicator selected={isRowSelected(Number(row.id))} />
                )
            },
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
    }, [properties, isRowSelected]);

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
            onItemClick={handleRowClick}
            emptyMessage='No atoms data found.'
        />
    );
}
