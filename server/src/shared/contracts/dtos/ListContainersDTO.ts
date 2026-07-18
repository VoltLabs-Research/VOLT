
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';

export interface ListContainersOutputDTO<TContainer = unknown> extends PaginatedResult<TContainer> {}
