import {
    useInfiniteQuery,
    useQueries,
    useQuery,
    type QueryKey,
    type UseQueryOptions
} from '@tanstack/react-query';
import queryClient from '@/shared/infrastructure/query/query-client';
import { createMutation, buildKeys } from '@/shared/infrastructure/query';
import listingService from '../../api/services/listing';
import type { ExportListingByAnalysisInputDTO } from '../../api/dtos/listing/export-listing-by-analysis';
import type { ExportPluginListingInputDTO } from '../../api/dtos/listing/export-plugin-listing';
import type {
    GetAnalysisListingExportOptionsInputDTO,
    GetAnalysisListingExportOptionsOutputDTO
} from '../../api/dtos/listing/get-analysis-listing-export-options';
import type { GetPluginListingInputDTO, GetPluginListingOutputDTO } from '../../api/dtos/listing/get-plugin-listing';
import type { GetSubListingInputDTO, GetSubListingOutputDTO } from '../../api/dtos/listing/get-sub-listing';

type QueryOptions<TQueryFnData, TData = TQueryFnData> = Partial<UseQueryOptions<TQueryFnData, Error, TData>>;

// ---------------------------------------------------------------------------
// buildKeys — hierarchical keys with prefix support
// ---------------------------------------------------------------------------

const listingKeys = buildKeys<{
    detail: GetPluginListingInputDTO;
}>(['plugins', 'listing']);

const listingInfiniteKeys = buildKeys<{
    detail: Omit<GetPluginListingInputDTO, 'page'> & { limit: number };
}>(['plugins', 'listing', 'infinite']);

const subListingKeys = buildKeys<Record<string, never>>(['plugins', 'subListing']);
const analysisExportOptionsKeys = buildKeys<{
    detail: GetAnalysisListingExportOptionsInputDTO;
}>(['plugins', 'analysis-export-options']);

const subListingInfiniteKeys = buildKeys<{
    detail: Omit<GetSubListingInputDTO, 'page'> & { limit: number };
}>(['plugins', 'subListing', 'infinite']);

// ---------------------------------------------------------------------------
// LISTING_QUERY_KEYS — public facade
// ---------------------------------------------------------------------------

export const LISTING_QUERY_KEYS = {
    listing: listingKeys.prefix,
    listingInfinite: listingInfiniteKeys.prefix,
    listingDetail: listingKeys.detail,
    listingInfiniteDetail: listingInfiniteKeys.detail,
    subListing: subListingKeys.prefix,
    subListingInfinite: subListingInfiniteKeys.prefix,
    subListingDetail: subListingInfiniteKeys.detail,
    analysisExportOptions: analysisExportOptionsKeys.prefix,
    analysisExportOptionsDetail: analysisExportOptionsKeys.detail
};

// ─── Listing queries ─────────────────────────────────────────────────────────

export const buildPluginListingQueryOptions = (params: GetPluginListingInputDTO) => ({
    queryKey: LISTING_QUERY_KEYS.listingDetail(params),
    queryFn: () => listingService.getListing(params)
});

export const fetchPluginListing = (params: GetPluginListingInputDTO) => {
    return queryClient.fetchQuery(buildPluginListingQueryOptions(params));
};

export const usePluginListingSubListingQueries = (paramsList: GetPluginListingInputDTO[]) => {
    return useQueries({
        queries: paramsList.map((params) => ({
            ...buildPluginListingQueryOptions(params),
            staleTime: 5 * 60 * 1000,
            enabled: Boolean(params.pluginId) && Boolean(params.trajectoryId),
            retry: false
        }))
    });
};

export const usePluginListingQuery = (
    params: GetPluginListingInputDTO,
    options?: QueryOptions<GetPluginListingOutputDTO, GetPluginListingOutputDTO>
) => {
    return useQuery<GetPluginListingOutputDTO, Error, GetPluginListingOutputDTO, QueryKey>({
        ...buildPluginListingQueryOptions(params),
        ...options
    });
};

export const usePluginListingInfiniteQuery = (
    params: Omit<GetPluginListingInputDTO, 'page'> & { limit: number },
    options: { getNextPageParam: (lastPage: GetPluginListingOutputDTO) => number | undefined; enabled?: boolean }
) => {
    return useInfiniteQuery({
        queryKey: LISTING_QUERY_KEYS.listingInfiniteDetail(params),
        queryFn: ({ pageParam }) => listingService.getListing({
            pluginId: params.pluginId,
            exposureName: params.exposureName,
            exposureId: params.exposureId,
            trajectoryId: params.trajectoryId,
            analysisId: params.analysisId,
            page: pageParam as number,
            limit: params.limit
        }),
        initialPageParam: 1,
        getNextPageParam: options.getNextPageParam,
        enabled: options.enabled
    });
};

// ─── Sub-listing queries ─────────────────────────────────────────────────────

export const useSubListingInfiniteQuery = (
    params: Omit<GetSubListingInputDTO, 'page'> & { limit: number },
    options: { getNextPageParam: (lastPage: GetSubListingOutputDTO) => number | undefined; enabled?: boolean }
) => {
    return useInfiniteQuery({
        queryKey: LISTING_QUERY_KEYS.subListingDetail(params),
        queryFn: ({ pageParam }) => listingService.getSubListing({
            analysisId: params.analysisId,
            exposureId: params.exposureId,
            timestep: params.timestep,
            subListingName: params.subListingName,
            page: pageParam as number,
            limit: params.limit
        }),
        initialPageParam: 1,
        getNextPageParam: options.getNextPageParam,
        enabled: options.enabled
    });
};

export const useAnalysisListingExportOptionsQuery = (
    params: GetAnalysisListingExportOptionsInputDTO,
    options?: QueryOptions<GetAnalysisListingExportOptionsOutputDTO, GetAnalysisListingExportOptionsOutputDTO>
) => {
    return useQuery<GetAnalysisListingExportOptionsOutputDTO, Error, GetAnalysisListingExportOptionsOutputDTO, QueryKey>({
        queryKey: LISTING_QUERY_KEYS.analysisExportOptionsDetail(params),
        queryFn: () => listingService.getAnalysisListingExportOptions(params),
        ...options
    });
};

// ─── Mutation hooks ──────────────────────────────────────────────────────────

export const useExportListingMutation = createMutation<Blob, ExportPluginListingInputDTO>(listingService.exportListing);

export const useExportListingByAnalysisMutation = createMutation<Blob, ExportListingByAnalysisInputDTO>(listingService.exportListingByAnalysis);
