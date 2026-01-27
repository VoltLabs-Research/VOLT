import type { SearchResults } from '../entities';

export interface ISearchRepository {
    search(query: string): Promise<SearchResults>;
}
