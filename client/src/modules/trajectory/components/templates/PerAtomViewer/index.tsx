import { extractTrajectoryTimesteps } from '@/modules/canvas/utilities/selected-timestep-analysis';
import useGetAtoms from '@/modules/trajectory/hooks/trajectory/use-get-atoms';
import useGetTrajectoryById from '@/modules/trajectory/hooks/trajectory/use-get-trajectory-by-id';
import { TRAJECTORY_QUERY_KEYS, trajectoryAtomsQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import formatAtomValue from '@/modules/trajectory/shared/format-atom-value';
import Container from '@/shared/presentation/components/Container';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Select from '@/shared/presentation/components/Select';
import useSearchParamsState from '@/shared/presentation/hooks/use-search-params';
import { useCallback, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import AtomTypeBadge from '../../atoms/AtomTypeBadge';
import type { AtomData } from '@/modules/trajectory/api/dtos/trajectory';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListing';
import type { SelectOption } from '@/shared/presentation/components/Select';

interface PerAtomViewerContext {
    trajectoryId: string;
    analysisId?: string;
    timestep: number;
};

interface AtomListingRow extends AtomData {
    _id: string;
};

interface PaginationRequestParams {
    page: number;
    limit: number;
};

type PerAtomViewerFetchParams = PaginationRequestParams & PerAtomViewerContext;

interface ColumnSkeletonConfig {
    variant: 'text';
    width: number;
};

const ID_SKELETON: ColumnSkeletonConfig = {
    variant: 'text',
    width: 60
};

const COORDINATE_SKELETON: ColumnSkeletonConfig = {
    variant: 'text',
    width: 80
};

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
    const { searchParams, updateSearchParams } = useSearchParamsState();
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

        updateSearchParams({ timestep }, { replace: true });
    }, [searchParams, timestep, updateSearchParams]);

    const firstPageAtomsQuery = trajectoryAtomsQuery(
        {
            trajectoryId: trajectoryId ?? '',
            analysisId,
            timestep: timestep ?? 0,
            page: 1,
            limit: 100
        },
        {
            enabled: isEnabled
        }
    );

    const properties = firstPageAtomsQuery.data?._meta?.properties ?? [];

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

        updateSearchParams({ timestep: nextTimestep });
    }, [updateSearchParams]);

    const fetchData = async (params: PerAtomViewerFetchParams): Promise<PaginatedResponse<AtomListingRow>> => {
        const result = await getAtoms({
            trajectoryId: params.trajectoryId,
            analysisId: params.analysisId,
            timestep: params.timestep,
            page: params.page,
            limit: params.limit
        });

        return {
            ...result,
            data: result.data.map((atom) => ({
                ...atom,
                _id: String(atom.id)
            }))
        };
    };

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

        const uniqueProperties = [...new Set(properties)];
        for (const prop of uniqueProperties) {
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
            <Container className='d-flex items-center gap-075'>
                <Paragraph className='font-size-1 color-muted'>Timestep</Paragraph>
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
            </Container>
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
