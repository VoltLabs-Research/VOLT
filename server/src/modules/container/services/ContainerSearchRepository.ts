import { CONTAINER_CONTRACT_TOKENS } from '@shared/contracts/tokens/ContainerTokens';
import { ContainerModel } from '@modules/container/models/ContainerModel';
import { Singleton } from '@shared/infrastructure/di/decorators';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';

interface FindAllOptions {
    filter?: Record<string, unknown>;
    sort?: Record<string, 1 | -1>;
    page?: number;
    limit?: number;
}

const toId = (value: unknown): string | undefined => (value === undefined || value === null ? undefined : String(value));

/**
 * Cross-module read adapter registered under the neutral
 * `Symbol.for('ContainerRepository')` token so the dashboard global-search use
 * case can list containers without importing `@modules/container`. Model-backed
 * (no entity / mapper / domain repository); exposes only the `findAll` the one
 * consumer uses. The container module's own code talks to {@link ContainerModel}
 * directly via {@link ContainerService}.
 */
@Singleton(CONTAINER_CONTRACT_TOKENS.ContainerRepository)
export class ContainerSearchRepository {
    async findAll(options: FindAllOptions = {}): Promise<PaginatedResult<Record<string, unknown>>> {
        const page = options.page ?? 1;
        const limit = options.limit ?? 100;
        const filter = options.filter ?? {};

        let query = ContainerModel.find(filter).skip((page - 1) * limit).limit(limit);
        if (options.sort) {
            query = query.sort(options.sort);
        }

        const [docs, total] = await Promise.all([
            query.lean().exec(),
            ContainerModel.countDocuments(filter)
        ]);

        const data = docs.map((doc) => ({
            ...doc,
            _id: String(doc._id),
            folder: toId(doc.folder) ?? null,
            createdBy: toId(doc.createdBy),
            team: toId(doc.team),
            teamCluster: toId(doc.teamCluster)
        }));

        return {
            data,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        };
    }
}
