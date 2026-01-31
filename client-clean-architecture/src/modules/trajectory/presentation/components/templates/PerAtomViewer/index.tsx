import { useMemo, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import useAtomsStore from '../../../stores/use-atoms-store';
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
    const [searchParams] = useSearchParams();
    const timestep = Number(searchParams.get('timestep')) || 0;
    
    const rows = useAtomsStore((state) => state.rows);
    const properties = useAtomsStore((state) => state.properties);
    const setRows = useAtomsStore((state) => state.setRows);
    const appendRows = useAtomsStore((state) => state.appendRows);
    const setProperties = useAtomsStore((state) => state.setProperties);
    const reset = useAtomsStore((state) => state.reset);
    
    const getAtoms = useGetAtoms();

    const fetchData = useCallback((params: any) => {
        return getAtoms({
            trajectoryId: trajectoryId!,
            analysisId: analysisId || 'default',
            exposureId,
            timestep,
            ...params
        });
    }, [trajectoryId, analysisId, exposureId, timestep, getAtoms]);

    const handleDataFetched = useCallback((result: PaginatedResponse<AtomData>, isFirstPage: boolean) => {
        if(isFirstPage) {
            setRows(result.data);
            setProperties(result._meta?.properties as string[] || []);
        } else {
            appendRows(result.data);
        }
    }, [setRows, appendRows, setProperties]);

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

    return (
        <DocumentListing<AtomData, PerAtomViewerContext>
            title={`Per-Atom Properties - Frame ${timestep}`}
            columns={columns}
            data={rows}
            fetchData={fetchData}
            onDataFetched={handleDataFetched}
            context={{ trajectoryId: trajectoryId!, analysisId: analysisId || 'default', exposureId, timestep }}
            onContextChange={reset}
            defaultLimit={100}
            enabled={!!trajectoryId && !!analysisId}
            emptyMessage='No atoms data found.'
        />
    );
};

export default PerAtomViewer;
