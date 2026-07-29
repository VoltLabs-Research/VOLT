import { ILike, In } from 'typeorm';
import type { FindOptionsRelations, FindOptionsSelect, FindOptionsWhere } from 'typeorm';
import AnalysisEntity from '@modules/analysis/models/Analysis';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { isEntityId } from '@shared/infrastructure/persistence/entity-id';
import { paginate, readPageRequest, skipFor } from '@shared/infrastructure/persistence/paginate';
import { AnalysisRelation } from '@modules/analysis/contracts/domain/analysis';
import type { AnalysisRelationName } from '@modules/analysis/contracts/domain/analysis';
import type { Analysis, AnalysisProps } from '@shared/contracts/types/AnalysisProps';
import type { PaginatedResult } from '@shared/domain/port/persistence';

const SEARCH_DEFAULT_LIMIT = 20;

const NAME_SELECTION = {
    id: true,
    name: true
} as const;

const USER_SELECTION = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    avatar: true
} as const;

interface AnalysisRelationBinding{
    relations: FindOptionsRelations<AnalysisEntity>;
    select?: FindOptionsSelect<AnalysisEntity>;
}

interface AnalysisRelationOptions{
    relations?: FindOptionsRelations<AnalysisEntity>;
    select?: FindOptionsSelect<AnalysisEntity>;
}

const RELATION_BINDINGS: Record<AnalysisRelationName, AnalysisRelationBinding> = {
    [AnalysisRelation.Plugin]: { relations: { pluginRef: true } },
    [AnalysisRelation.Trajectory]: {
        relations: { trajectoryRef: true },
        select: { trajectoryRef: NAME_SELECTION }
    },
    [AnalysisRelation.CreatedBy]: {
        relations: { createdByRef: true },
        select: { createdByRef: USER_SELECTION }
    },
    [AnalysisRelation.Team]: { relations: { teamRef: true } },
    [AnalysisRelation.ComputeCluster]: {
        relations: { computeClusterIdRef: true },
        select: { computeClusterIdRef: NAME_SELECTION }
    },
    [AnalysisRelation.StorageCluster]: {
        relations: { storageClusterIdRef: true },
        select: { storageClusterIdRef: NAME_SELECTION }
    }
};

const RELATION_WIRE_KEYS = [
    AnalysisRelation.Plugin,
    AnalysisRelation.Trajectory,
    AnalysisRelation.CreatedBy,
    AnalysisRelation.Team,
    AnalysisRelation.ComputeCluster,
    AnalysisRelation.StorageCluster
] as const;

export const escapeLikePattern = (value: string): string => value.replace(/[\\%_]/g, '\\$&');

export const buildAnalysisRelationOptions = (relations: readonly AnalysisRelationName[] = []): AnalysisRelationOptions => {
    if(relations.length === 0){
        return {};
    }

    const loadedRelations: FindOptionsRelations<AnalysisEntity> = {};
    const narrowedSelect: FindOptionsSelect<AnalysisEntity> = {};
    let hasSelect = false;

    for(const relation of relations){
        const binding = RELATION_BINDINGS[relation];
        Object.assign(loadedRelations, binding.relations);

        if(binding.select){
            Object.assign(narrowedSelect, binding.select);
            hasSelect = true;
        }
    }

    return {
        relations: loadedRelations,
        ...(hasSelect ? { select: narrowedSelect } : {})
    };
};

export const toAnalysisLike = (analysis: AnalysisEntity): Analysis => {
    const { _id, ...props } = analysis.toJSON();

    for(const key of RELATION_WIRE_KEYS){
        const value = props[key];
        if(value instanceof BaseModel){
            props[key] = value.toJSON();
        }
    }

    return {
        _id: String(_id),
        props: props as unknown as AnalysisProps
    };
};

interface AnalysisRuntimeTarget{
    analysisId: string;
    computeClusterId: string | undefined;
}

export const findRuntimeTargetsByTrajectoryId = async (trajectoryId: string): Promise<AnalysisRuntimeTarget[]> => {
    const analyses = await AnalysisEntity.find({
        where: { trajectory: trajectoryId },
        select: {
            id: true,
            computeClusterId: true
        }
    });

    return analyses.map((analysis) => ({
        analysisId: analysis.id,
        computeClusterId: analysis.computeClusterId || undefined
    }));
};

interface FindByTeamAndSearchOptions{
    teamId: string;
    search: string;
    trajectoryIds?: string[];
    page?: number;
    limit?: number;
    relations?: readonly AnalysisRelationName[];
}

export const findByTeamAndSearch = async ({
    teamId,
    search,
    trajectoryIds = [],
    page,
    limit,
    relations
}: FindByTeamAndSearchOptions): Promise<PaginatedResult<Analysis>> => {
    const normalizedSearch = search.trim();
    const where: FindOptionsWhere<AnalysisEntity>[] = [{
        team: teamId,
        pluginDisplayName: ILike(`%${escapeLikePattern(normalizedSearch)}%`)
    }];

    if(trajectoryIds.length > 0){
        where.push({
            team: teamId,
            trajectory: In(trajectoryIds)
        });
    }

    if(isEntityId(normalizedSearch)){
        where.push({
            team: teamId,
            id: normalizedSearch
        });
    }

    const pageRequest = readPageRequest(page, limit, { defaultLimit: SEARCH_DEFAULT_LIMIT });
    const [analyses, total] = await AnalysisEntity.findAndCount({
        where,
        ...buildAnalysisRelationOptions(relations),
        order: { createdAt: 'DESC' },
        skip: skipFor(pageRequest),
        take: pageRequest.limit
    });

    return paginate([analyses.map((analysis) => toAnalysisLike(analysis)), total], pageRequest);
};
