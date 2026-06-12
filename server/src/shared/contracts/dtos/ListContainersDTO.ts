/**
 * Neutral, cross-module output DTO contract for listing containers.
 * Extracted from `@modules/container/application/dtos/ListContainersDTO` during
 * the detachable-modules migration: the dashboard global-search consumes
 * `ListContainersOutputDTO['data']` and must not import `@modules/container`.
 *
 * The container entity is not part of the neutral contracts layer, so this is
 * GENERIC over it. The owner module re-exports a bound alias so existing
 * importers compile unchanged. Pure type — no `@modules/*` import.
 */
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';

export interface ListContainersOutputDTO<TContainer = unknown> extends PaginatedResult<TContainer> {}
