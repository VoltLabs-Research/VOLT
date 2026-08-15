import {
    useInfiniteQuery,
    useQuery,
    type UseQueryOptions
} from '@tanstack/react-query';
import queryClient from '@/shared/query/query-client';
import { createMutation } from '@/shared/query/create-mutation';
import { buildKeys } from '@/shared/query/query-keys';
import { buildCanvasDataAccess } from '@/modules/canvas/api/access/build-canvas-data-access';
import { DEFAULT_CANVAS_ACCESS_STATE } from '@/modules/canvas/contracts/data-access';
import { useCanvasAccessMode, useCanvasAccessStore, useCanvasDataAccess, withAccessMode } from '@/modules/canvas/api/access/use-canvas-access-store';
import listingService from '../../api/services/listing-service';
import type {
    ExportListingByAnalysisInput,
    ExportPluginListingInput,
    GetPluginListingInput,
    GetPluginListingResponse,
    GetSubListingInput,
    GetSubListingResponse
} from '../../api/services/listing-service';

const listingKeys = buildKeys<{
    detail: GetPluginListingInput;
}>(['plugins', 'listing']);

const listingInfiniteKeys = buildKeys<{
    detail: Omit<GetPluginListingInput, 'page'> & { limit: number };
}>(['plugins', 'listing', 'infinite']);

const subListingKeys = buildKeys<Record<string, never>>(['plugins', 'subListing']);

const subListingInfiniteKeys = buildKeys<{
    detail: Omit<GetSubListingInput, 'page'> & { limit: number };
}>(['plugins', 'subListing', 'infinite']);

export const LISTING_QUERY_KEYS = {
    listing: listingKeys.prefix,
    listingInfinite: listingInfiniteKeys.prefix,
    listingDetail: listingKeys.detail,
    listingInfiniteDetail: listingInfiniteKeys.detail,
    subListing: subListingKeys.prefix,
    subListingInfinite: subListingInfiniteKeys.prefix,
    subListingDetail: subListingInfiniteKeys.detail
};

const useListingAccess = (trajectoryId?: string) => {
    const mode = useCanvasAccessMode();
    const dataAccess = useCanvasDataAccess();
    const storeTrajectoryId = useCanvasAccessStore((state) => state.trajectoryId);

    return {
        mode,
        dataAccess,
        trajectoryId: trajectoryId ?? storeTrajectoryId ?? ''
    };
};

export const fetchPluginListing = (params: GetPluginListingInput) => {
    const accessState = useCanvasAccessStore.getState();
    const dataAccess = buildCanvasDataAccess({
        ...DEFAULT_CANVAS_ACCESS_STATE,
        mode: accessState.mode
    });

    return queryClient.fetchQuery({
        queryKey: withAccessMode(accessState.mode, LISTING_QUERY_KEYS.listingDetail(params)),
        queryFn: () => dataAccess.getPluginListing({
            ...params,
            trajectoryId: params.trajectoryId ?? accessState.trajectoryId ?? ''
        })
    });
};

export const usePluginListingQuery = (
    params: GetPluginListingInput,
    options?: Partial<UseQueryOptions<GetPluginListingResponse, Error>>
) => {
    const { mode, dataAccess, trajectoryId } = useListingAccess(params.trajectoryId);

    return useQuery({
        ...options,
        queryKey: withAccessMode(mode, LISTING_QUERY_KEYS.listingDetail(params)),
        queryFn: () => dataAccess.getPluginListing({
            ...params,
            trajectoryId
        })
    });
};

export const usePluginListingInfiniteQuery = (
    params: Omit<GetPluginListingInput, 'page'> & { limit: number },
    options: { getNextPageParam: (lastPage: GetPluginListingResponse) => number | undefined; enabled?: boolean }
) => {
    const { mode, dataAccess, trajectoryId } = useListingAccess(params.trajectoryId);

    return useInfiniteQuery({
        queryKey: withAccessMode(mode, LISTING_QUERY_KEYS.listingInfiniteDetail(params)),
        queryFn: ({ pageParam }) => dataAccess.getPluginListing({
            pluginId: params.pluginId,
            exposureName: params.exposureName,
            exposureId: params.exposureId,
            trajectoryId,
            analysisId: params.analysisId,
            page: pageParam as number,
            limit: params.limit
        }),
        initialPageParam: 1,
        getNextPageParam: options.getNextPageParam,
        enabled: options.enabled
    });
};

export const useSubListingInfiniteQuery = (
    params: Omit<GetSubListingInput, 'page'> & { limit: number },
    options: { getNextPageParam: (lastPage: GetSubListingResponse) => number | undefined; enabled?: boolean }
) => {
    const { mode, dataAccess, trajectoryId } = useListingAccess();

    return useInfiniteQuery({
        queryKey: withAccessMode(mode, LISTING_QUERY_KEYS.subListingDetail(params)),
        queryFn: ({ pageParam }) => dataAccess.getSubListing({
            trajectoryId,
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

export const useExportListingMutation = createMutation<Blob, ExportPluginListingInput>(listingService.exportListing);

export const useExportListingByAnalysisMutation = createMutation<Blob, ExportListingByAnalysisInput>(listingService.exportListingByAnalysis);

export const fetchSubListing = (params: GetSubListingInput): Promise<GetSubListingResponse> => {
    return listingService.getSubListing(params);
};
