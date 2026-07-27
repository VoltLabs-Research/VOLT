
import type { PaginatedResult } from '@shared/domain/port/persistence';

export interface ListContainersOutput<TContainer = unknown> extends PaginatedResult<TContainer> {}
