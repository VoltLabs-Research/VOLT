
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';

export interface ListContainersOutput<TContainer = unknown> extends PaginatedResult<TContainer> {}
