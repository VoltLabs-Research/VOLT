import { useMemo, useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import useSearchParamsState from '@/shared/presentation/hooks/use-search-params';
import useGetAtoms from '../../../hooks/trajectory/use-get-atoms';
import DocumentListing, { type ColumnConfig } from '@/shared/presentation/components/DocumentListing';
import AtomTypeBadge from '../../atoms/AtomTypeBadge';
import type { AtomData } from '@/modules/trajectory/application/dtos/trajectory/GetAtomsDTO';
import type { PaginatedResponse } from '@/shared/domain/pagination';

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
    
    // We need to track properties locally for column generation
    const [properties, setProperties] = useState<string[]>([]);
    
    const getAtoms = useGetAtoms();

    const fetchData = useCallback(async (params: { page: number; limit: number } & PerAtomViewerContext): Promise<PaginatedResponse<AtomData>> => {
        const result = await getAtoms({
            trajectoryId: params.trajectoryId,
            analysisId: params.analysisId,
            exposureId: params.exposureId,
            timestep: params.timestep,
            page: params.page,
            limit: params.limit
        });
        
        // Extract and store properties from first page
        if (params.page === 1 && result._meta?.properties) {
            setProperties(result._meta.properties as string[]);
        }
        
        return result;
    }, [getAtoms]);

    const columns: ColumnConfig[] = useMemo(() => {
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
                render: (v: any) => <AtomTypeBadge type={v} />
            },
            { 
                key: 'x', 
                title: 'X', 
                skeleton: { variant: 'text', width: 80 }, 
                render: (v: any) => v.toFixed(3) 
            },
            { 
                key: 'y', 
                title: 'Y', 
                skeleton: { variant: 'text', width: 80 }, 
                render: (v: any) => v.toFixed(3) 
            },
            { 
                key: 'z', 
                title: 'Z', 
                skeleton: { variant: 'text', width: 80 }, 
                render: (v: any) => v.toFixed(3) 
            }
        ];

        const uniqueProperties = [...new Set(properties)];
        for(const prop of uniqueProperties){
            baseCols.push({
                key: prop,
                title: prop,
                skeleton: { variant: 'text', width: 80 },
                render: (v) => typeof v === 'number' ? v.toFixed(6) : String(v)
            });
        }

        return baseCols;
    }, [properties]);

    const context: PerAtomViewerContext = useMemo(() => ({
        trajectoryId: trajectoryId!,
        analysisId: analysisId!,
        exposureId,
        timestep
    }), [trajectoryId, analysisId, exposureId, timestep]);

    return (
        <DocumentListing<AtomData, PerAtomViewerContext>
            title={`Per-Atom Properties - Frame ${timestep}`}
            columns={columns}
            fetchData={fetchData}
            context={context}
            defaultLimit={100}
            enabled={!!trajectoryId && !!analysisId}
            emptyMessage='No atoms data found.'
        />
    );
};

export default PerAtomViewer;
