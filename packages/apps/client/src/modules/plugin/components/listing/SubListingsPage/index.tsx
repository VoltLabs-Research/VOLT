import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import DocumentListing from '@/shared/ui/components/DocumentListing';
import SubListingDetailPanel from '@/modules/plugin/components/listing/SubListingDetailPanel';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import formatSnakeCaseToTitle from '@/modules/plugin/utils/listing/format-snake-case';
import { fetchSubListing } from '@/modules/plugin/hooks/listing/queries';
import { LISTING_QUERY_KEYS } from '@/modules/plugin/hooks/listing/queries';
import { buildDocumentSubListingColumnSnapshot, type SubListingColumnSnapshot } from '@/modules/plugin/components/listing/sub-listing-columns';
import { resolvePersistenceKey } from '@/shared/ui/components/DocumentListing/use-listing-view-preferences';
import type { PaginatedResponse } from '@voltstack/voltclient';

interface SubListingRow extends Record<string, unknown> {
    _id: string;
}

interface SubListingFetchContext {
    subListingName: string;
    analysisId: string;
    exposureId: string;
    timestep: number;
}

const parseNames = (raw: string | null): string[] => {
    if(!raw) return [];
    return raw.split(',').map((entry) => entry.trim()).filter(Boolean);
};

const SubListingsPage = () => {
    const params = useParams();
    const [searchParams] = useSearchParams();

    const analysisId = params.analysisId ?? '';
    const exposureId = searchParams.get('exposureId') ?? '';
    const timestepRaw = searchParams.get('timestep');
    const timestep = timestepRaw !== null ? Number(timestepRaw) : Number.NaN;
    const namesRaw = searchParams.get('names') ?? '';

    const names = useMemo(() => parseNames(namesRaw), [namesRaw]);

    const queryKey = useMemo(() => (
        [...LISTING_QUERY_KEYS.subListingInfinite(), 'page', analysisId, exposureId, timestep]
    ), [analysisId, exposureId, timestep]);

    const [activeTab, setActiveTab] = useState(() => {
        const persistedTab = searchParams.get(`${resolvePersistenceKey(queryKey)}-tab`);
        if(persistedTab && names.includes(persistedTab)) return persistedTab;

        const tabFromUrl = searchParams.get('tab');
        if(tabFromUrl && names.includes(tabFromUrl)) return tabFromUrl;

        return names[0] ?? '';
    });
    const [snapshotsByTab, setSnapshotsByTab] = useState<Record<string, SubListingColumnSnapshot<SubListingRow>>>({});
    const [selectedRow, setSelectedRow] = useState<SubListingRow | null>(null);

    useEffect(() => {
        setActiveTab((current) => {
            if(current && names.includes(current)) return current;
            return names[0] ?? '';
        });
        setSnapshotsByTab({});
    }, [analysisId, exposureId, timestep, names]);

    useEffect(() => {
        setSelectedRow(null);
    }, [activeTab]);

    const missingParams: string[] = [];
    if(!analysisId) missingParams.push('analysisId');
    if(!exposureId) missingParams.push('exposureId');
    if(!Number.isFinite(timestep)) missingParams.push('timestep');

    const paramsValid = missingParams.length === 0;
    const hasNames = names.length > 0;

    const tabs = useMemo(() => names.map((name) => ({
        id: name,
        label: formatSnakeCaseToTitle(name)
    })), [names]);

    const context = useMemo<SubListingFetchContext>(() => ({
        subListingName: activeTab,
        analysisId,
        exposureId,
        timestep
    }), [activeTab, analysisId, exposureId, timestep]);

    const fetchData = useCallback(async (requestParams: {
        page: number;
        limit: number;
    } & SubListingFetchContext): Promise<PaginatedResponse<SubListingRow>> => {
        const response = await fetchSubListing(requestParams);
        const rows = response.rows as SubListingRow[];

        if(response.page === 1){
            setSnapshotsByTab((previous) => ({
                ...previous,
                [requestParams.subListingName]: buildDocumentSubListingColumnSnapshot(response.columns, rows)
            }));
        }

        return {
            status: 'success',
            data: rows,
            pagination: {
                page: response.page,
                limit: response.limit,
                total: response.total,
                totalPages: response.totalPages,
                hasMore: response.page < response.totalPages
            }
        };
    }, []);

    const columns = snapshotsByTab[activeTab]?.columns ?? [];

    const handleItemClick = (item: SubListingRow) => {
        setSelectedRow((current) => {
            if(!current) return item;
            return current._id === item._id ? null : item;
        });
        return true;
    };

    if(!paramsValid){
        return (
            <div className='flex h-full min-h-0 w-full flex-row overflow-hidden max-[900px]:flex-col'>
                <RecoveryState
                    title='Missing required parameters'
                    description={`This page needs ${missingParams.join(', ')} in the URL.`}
                    tone={RecoveryStateTone.Error}
                />
            </div>
        );
    }

    if(!hasNames){
        return (
            <div className='flex h-full min-h-0 w-full flex-row overflow-hidden max-[900px]:flex-col'>
                <RecoveryState
                    title='No sub-listings available'
                    description='This exposure has no sub-listings to display.'
                />
            </div>
        );
    }

    return (
        <div className='flex h-full min-h-0 w-full flex-row overflow-hidden max-[900px]:flex-col'>
            <div className='flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'>
                <DocumentListing<SubListingRow, SubListingFetchContext>
                    title={activeTab ? formatSnakeCaseToTitle(activeTab) : 'Sub-Listings'}
                    description={`Timestep ${timestep}`}
                    queryKey={queryKey}
                    fetchData={fetchData}
                    context={context}
                    columns={columns}
                    tabs={tabs}
                    defaultTabId={activeTab || undefined}
                    onTabChange={setActiveTab}
                    onItemClick={handleItemClick}
                    enabled={paramsValid && hasNames && Boolean(activeTab)}
                    hideTabs={tabs.length <= 1}
                    emptyMessage='No rows to display for this sub-listing.'
                />
            </div>
            {selectedRow && (
                <div className='flex min-h-0 flex-col overflow-hidden flex-[0_0_clamp(320px,38%,520px)] max-[900px]:flex-[0_0_45%] max-[900px]:border-t max-[900px]:border-border'>
                    <SubListingDetailPanel
                        row={selectedRow}
                        columns={columns}
                        onClose={() => setSelectedRow(null)}
                    />
                </div>
            )}
        </div>
    );
};

export default SubListingsPage;
