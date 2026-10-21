import { useMemo, useRef } from 'react';
import { useEditorStore } from '@/modules/canvas/store/editor';
import PluginCompactTable, { type PluginTableColumnConfig } from '@/modules/plugin/components/listing/PluginCompactTable';
import { getCategoricalColorByIndex } from '@/shared/ui/utils/categorical-palette';
import { useTrajectoryAtomsInfiniteQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import { atomsToAoS } from '@/modules/trajectory/utils/decode-atoms-binary';

import type { AtomData, GetAtomsResponse } from '@/modules/trajectory/api/services/trajectory-service';
import formatAtomValue from '@/modules/trajectory/utils/format-atom-value';

interface PluginAtomsTableProps {
    trajectoryId: string;
    analysisId?: string;
    exposureId?: string;
}

const getTypeColor = (type?: number): string => {
    if(type === undefined) return 'var(--muted)';

    return getCategoricalColorByIndex(type);
};

const ATOMS_PAGE_SIZE = 100;

const BASE_ATOM_COLUMNS: PluginTableColumnConfig[] = [
    {
        key: 'id',
        title: 'ID',
        width: 80
    },
    {
        key: 'type',
        title: 'Type',
        width: 80,
        render: (value: unknown) => (
            <div className='flex flex-row items-center gap-2'>
                <div
                    style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: getTypeColor(typeof value === 'number' ? value : undefined)
                    }}
                />
                {String(value)}
            </div>
        )
    },
    {
        key: 'x',
        title: 'X',
        width: 100,
        render: (value: unknown) => formatAtomValue(value, 3)
    },
    {
        key: 'y',
        title: 'Y',
        width: 100,
        render: (value: unknown) => formatAtomValue(value, 3)
    },
    {
        key: 'z',
        title: 'Z',
        width: 100,
        render: (value: unknown) => formatAtomValue(value, 3)
    }
];

const BASE_ATOM_COLUMN_KEYS = new Set(BASE_ATOM_COLUMNS.map((column) => column.key));

const PluginAtomsTable = ({ trajectoryId, analysisId, exposureId }: PluginAtomsTableProps) => {
    const currentTimestep = useEditorStore((state) => state.currentTimestep);

    const baseAtomsParams = useMemo(() => ({
        trajectoryId,
        analysisId: analysisId || 'default',
        exposureId,
        timestep: currentTimestep ?? 0,
        limit: ATOMS_PAGE_SIZE
    }), [trajectoryId, analysisId, exposureId, currentTimestep]);

    const {
        data: infiniteData,
        isLoading,
        isFetchingNextPage,
        fetchNextPage,
        hasNextPage,
        error
    } = useTrajectoryAtomsInfiniteQuery(baseAtomsParams, {
        enabled: Boolean(trajectoryId && currentTimestep !== undefined)
    });

    const aosCacheRef = useRef(new WeakMap<GetAtomsResponse, AtomData[]>());

    const rows: AtomData[] = useMemo(() => {
        if (!infiniteData?.pages) return [];
        const cache = aosCacheRef.current;
        return infiniteData.pages.flatMap((page) => {
            let pageRows = cache.get(page);
            if (!pageRows) {
                pageRows = atomsToAoS(page);
                cache.set(page, pageRows);
            }
            return pageRows;
        });
    }, [infiniteData]);

    const properties: string[] = useMemo(() => {
        if (!infiniteData?.pages?.length) return [];
        for (let i = infiniteData.pages.length - 1; i >= 0; i--) {
            const props = infiniteData.pages[i].propertyNames;
            if (props?.length) return props;
        }
        return [];
    }, [infiniteData]);

    const columns: PluginTableColumnConfig[] = useMemo(() => [
        ...BASE_ATOM_COLUMNS,
        ...properties
            .filter((prop) => !BASE_ATOM_COLUMN_KEYS.has(prop))
            .map((prop) => ({
                key: prop,
                title: prop,
                width: 120,
                render: (value: unknown) => formatAtomValue(value, 4)
            }))
    ], [properties]);

    const handleLoadMore = () => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    };

    return (
        <PluginCompactTable
            columns={columns}
            data={rows}
            hasMore={hasNextPage}
            isLoading={isLoading}
            isFetchingMore={isFetchingNextPage}
            onLoadMore={handleLoadMore}
            error={error}
        />
    );
};

export default PluginAtomsTable;
