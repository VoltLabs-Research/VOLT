import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import useSearchParamsState from '@/shared/presentation/hooks/use-search-params';
import useGetAtoms from '@/modules/trajectory/hooks/use-get-atoms';
import { trajectoryAtomsQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import DocumentListing, { type ColumnConfig } from '@/shared/presentation/components/DocumentListing';
import AtomTypeBadge from '../../atoms/AtomTypeBadge';
import type { AtomData } from '@/modules/trajectory/api/dtos/get-atoms';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import { TRAJECTORY_QUERY_KEYS } from '@/modules/trajectory/hooks/trajectory/queries';
import formatAtomValue from '@/modules/trajectory/utilities/format-atom-value';

interface PerAtomViewerContext {
    trajectoryId: string;
    analysisId: string;
    exposureId?: string;
    timestep: number;
}

const PerAtomViewer = () => {
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

    const fetchData = async (params: { page: number; limit: number } & PerAtomViewerContext): Promise<PaginatedResponse<AtomData & { _id: string }>> => {
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
                skeleton: { variant: 'text', width: 60 } 
            },
            {
                key: 'type',
                title: 'Type',
                skeleton: { variant: 'text', width: 60 },
                render: (value: unknown) => <AtomTypeBadge type={value as string | number} />
            },
            { 
                key: 'x', 
                title: 'X', 
                skeleton: { variant: 'text', width: 80 }, 
                render: (value: unknown) => formatAtomValue(value, 3)
            },
            { 
                key: 'y', 
                title: 'Y', 
                skeleton: { variant: 'text', width: 80 }, 
                render: (value: unknown) => formatAtomValue(value, 3)
            },
            { 
                key: 'z', 
                title: 'Z', 
                skeleton: { variant: 'text', width: 80 }, 
                render: (value: unknown) => formatAtomValue(value, 3)
            }
        ];

        const uniqueProperties = [...new Set(properties)];
        for(const prop of uniqueProperties){
            baseCols.push({
                key: prop,
                title: prop,
                skeleton: { variant: 'text', width: 80 },
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
        <DocumentListing<AtomData & { _id: string }, PerAtomViewerContext>
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
};

export default PerAtomViewer;
