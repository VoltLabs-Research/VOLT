import useGetAtoms from '@/modules/trajectory/hooks/trajectory/use-get-atoms';
import type { AtomData } from '@/modules/trajectory/api/dtos/trajectory';
import { TRAJECTORY_QUERY_KEYS, trajectoryAtomsQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import formatAtomValue from '@/modules/trajectory/shared/format-atom-value';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import useSearchParamsState from '@/shared/presentation/hooks/use-search-params';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import AtomTypeBadge from '../../atoms/AtomTypeBadge';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListing';

interface PerAtomViewerContext {
    trajectoryId: string;
    analysisId: string;
    exposureId?: string;
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

export default function PerAtomViewer() {
    const { trajectoryId, analysisId, exposureId } = useParams();
    const { searchParams } = useSearchParamsState();
    const timestep = Number(searchParams.get('timestep')) || 0;

    const getAtoms = useGetAtoms();
    const isEnabled = Boolean(trajectoryId && analysisId);

    const firstPageAtomsQuery = trajectoryAtomsQuery(
        {
            trajectoryId: trajectoryId ?? '',
            analysisId: analysisId ?? '',
            exposureId,
            timestep,
            page: 1,
            limit: 100
        },
        {
            enabled: isEnabled
        }
    );

    const properties = firstPageAtomsQuery.data?._meta?.properties ?? [];

    const fetchData = async (params: PerAtomViewerFetchParams): Promise<PaginatedResponse<AtomListingRow>> => {
        const result = await getAtoms({
            trajectoryId: params.trajectoryId,
            analysisId: params.analysisId,
            exposureId: params.exposureId,
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
        trajectoryId: trajectoryId!,
        analysisId: analysisId!,
        exposureId,
        timestep
    }), [trajectoryId, analysisId, exposureId, timestep]);

    return (
        <DocumentListing<AtomListingRow, PerAtomViewerContext>
            title={`Per-Atom Properties - Frame ${timestep}`}
            queryKey={TRAJECTORY_QUERY_KEYS.perAtom()}
            columns={columns}
            fetchData={fetchData}
            context={listingContext}
            defaultLimit={100}
            enabled={!!trajectoryId && !!analysisId}
            emptyMessage='No atoms data found.'
        />
    );
}
