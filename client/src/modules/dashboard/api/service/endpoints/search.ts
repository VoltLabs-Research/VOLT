import { EMPTY_GLOBAL_SEARCH_RESULTS } from '../../dtos/global-search';
import { custom } from '@/app/core/http/utilities/create-service';
import type { GlobalSearchInputDTO, GlobalSearchOutputDTO } from '../../dtos/global-search';

interface ApiResponse<T> {
    status: string;
    data: T;
};

interface SearchQueryParams extends Record<string, unknown> {
    query: string;
    limit: number;
};

const MIN_SEARCH_QUERY_LENGTH = 2;

export default {
    search: custom<GlobalSearchInputDTO, GlobalSearchOutputDTO>(
        async ({ getClient }, { query, limit = 5 }) => {
            if (query.trim().length < MIN_SEARCH_QUERY_LENGTH) {
                return EMPTY_GLOBAL_SEARCH_RESULTS;
            }

            const params: SearchQueryParams = {
                query,
                limit
            };

            const response = await getClient('dashboard').get<ApiResponse<GlobalSearchOutputDTO>>('/search', params);
            return response.data;
        }
    )
};
