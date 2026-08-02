import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import DocumentListing from '@/shared/ui/components/DocumentListing';
import SubListingDetailPanel from '@/modules/plugin/components/listing/SubListingDetailPanel';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import formatSnakeCaseToTitle from '@/modules/plugin/utils/listing/format-snake-case';
import listingService from '@/modules/plugin/api/services/listing-service';
import { LISTING_QUERY_KEYS } from '@/modules/plugin/hooks/listing/queries';
import { buildDocumentSubListingColumnSnapshot, type SubListingColumnSnapshot } from '@/modules/plugin/components/listing/sub-listing-columns';
import { resolvePersistenceKey } from '@/shared/ui/components/DocumentListing/use-listing-view-preferences';
import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import './SubListingsPage.css';

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
    // Identity is load-bearing: `names` is a dependency of the tab-reset effect.
    const names = useMemo(() => parseNames(namesRaw), [namesRaw]);

    const queryKey = useMemo(() => (
        [...LISTING_QUERY_KEYS.subListingInfinite(), 'page', analysisId, exposureId, timestep]
    ), [analysisId, exposureId, timestep]);

    const [activeTab, setActiveTab] = useState(() => {
        // `DocumentListing` persists the selected tab under this exact param, so
        // the initial tab has to be read back through the same key it writes.
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

    // Kept stable: `DocumentListing` treats this as the identity of its data source.
    const fetchData = useCallback(async (requestParams: {
        page: number;
        limit: number;
    } & SubListingFetchContext): Promise<PaginatedResponse<SubListingRow>> => {
        const response = await listingService.getSubListing(requestParams);
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
            <div className='plugin-sub-listings-page plugin-sub-listings-page--empty'>
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
            <div className='plugin-sub-listings-page plugin-sub-listings-page--empty'>
                <RecoveryState
                    title='No sub-listings available'
                    description='This exposure has no sub-listings to display.'
                />
            </div>
        );
    }

    return (
        <div className='plugin-sub-listings-page'>
            <div className='plugin-sub-listings-page__listing'>
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
                <div className='plugin-sub-listings-page__detail'>
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
