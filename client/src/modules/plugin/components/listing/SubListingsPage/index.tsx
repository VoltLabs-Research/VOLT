import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import DocumentListing, { type DocumentListingTab } from '@/shared/presentation/components/DocumentListing';
import SubListingDetailPanel from '@/modules/plugin/components/listing/SubListingDetailPanel';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import formatSnakeCaseToTitle from '@/modules/plugin/utilities/listing/format-snake-case';
import listingService from '@/modules/plugin/api/services/listing-service';
import { LISTING_QUERY_KEYS } from '@/modules/plugin/hooks/listing/queries';
import { buildDocumentSubListingColumnSnapshot, type SubListingColumnSnapshot } from '@/modules/plugin/components/listing/sub-listing-columns';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { GetSubListingOutputDTO } from '@/modules/plugin/api/services/listing-service';
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

const hashString = (value: string): string => {
    let hash = 0;
    for(let i = 0; i < value.length; i++){
        hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(36);
};

const resolvePersistenceKey = (queryKey: unknown[]): string => {
    return `list-${hashString(JSON.stringify(queryKey))}`;
};

const buildTabs = (names: string[]): DocumentListingTab[] => {
    return names.map((name) => ({
        id: name,
        label: formatSnakeCaseToTitle(name)
    }));
};

const resolveRowIdentifier = (row: SubListingRow, index: number): string => {
    const candidate = row._id ?? row.id;
    if(typeof candidate === 'string' || typeof candidate === 'number'){
        return String(candidate);
    }
    return String(index);
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

    const persistedTabKey = `${resolvePersistenceKey(queryKey)}-tab`;
    const persistedTab = searchParams.get(persistedTabKey);
    const tabFromUrl = searchParams.get('tab');

    const initialTab = useMemo(() => {
        if(persistedTab && names.includes(persistedTab)) return persistedTab;
        if(tabFromUrl && names.includes(tabFromUrl)) return tabFromUrl;
        return names[0] ?? '';
    }, [names, persistedTab, tabFromUrl]);

    const [activeTab, setActiveTab] = useState(initialTab);
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
    const isEnabled = paramsValid && hasNames && Boolean(activeTab);

    const tabs = useMemo(() => buildTabs(names), [names]);

    const context = useMemo<SubListingFetchContext>(() => ({
        subListingName: activeTab,
        analysisId,
        exposureId,
        timestep
    }), [activeTab, analysisId, exposureId, timestep]);

    const fetchData = useCallback(async (requestParams: {
        page: number;
        limit: number;
        subListingName: string;
        analysisId: string;
        exposureId: string;
        timestep: number;
    }): Promise<PaginatedResponse<SubListingRow>> => {
        const response: GetSubListingOutputDTO = await listingService.getSubListing({
            analysisId: requestParams.analysisId,
            exposureId: requestParams.exposureId,
            timestep: requestParams.timestep,
            subListingName: requestParams.subListingName,
            page: requestParams.page,
            limit: requestParams.limit
        });

        const rows = (response.rows ?? []) as SubListingRow[];

        if(response.page === 1){
            const snapshot = buildDocumentSubListingColumnSnapshot(response.columns ?? [], rows);
            setSnapshotsByTab((previous) => ({
                ...previous,
                [requestParams.subListingName]: snapshot
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

    const currentSnapshot = snapshotsByTab[activeTab];
    const columns = currentSnapshot?.columns ?? [];

    const handleTabChange = useCallback((tabId: string) => {
        setActiveTab(tabId);
    }, []);

    const handleItemClick = useCallback((item: SubListingRow) => {
        setSelectedRow((current) => {
            if(!current) return item;
            const currentId = resolveRowIdentifier(current, -1);
            const nextId = resolveRowIdentifier(item, -2);
            return currentId === nextId ? null : item;
        });
        return true;
    }, []);

    const handleDetailClose = useCallback(() => {
        setSelectedRow(null);
    }, []);

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

    const title = activeTab ? formatSnakeCaseToTitle(activeTab) : 'Sub-Listings';
    const description = Number.isFinite(timestep)
        ? `Timestep ${timestep}`
        : undefined;

    return (
        <div className='plugin-sub-listings-page'>
            <div className='plugin-sub-listings-page__listing'>
                <DocumentListing<SubListingRow, SubListingFetchContext>
                    title={title}
                    description={description}
                    queryKey={queryKey}
                    fetchData={fetchData}
                    context={context}
                    columns={columns}
                    tabs={tabs}
                    defaultTabId={activeTab || undefined}
                    onTabChange={handleTabChange}
                    onItemClick={handleItemClick}
                    enabled={isEnabled}
                    hideTabs={tabs.length <= 1}
                    emptyMessage='No rows to display for this sub-listing.'
                />
            </div>
            {selectedRow && (
                <div className='plugin-sub-listings-page__detail'>
                    <SubListingDetailPanel
                        row={selectedRow}
                        columns={columns}
                        onClose={handleDetailClose}
                    />
                </div>
            )}
        </div>
    );
};

export default SubListingsPage;
