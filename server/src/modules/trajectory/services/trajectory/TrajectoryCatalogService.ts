import { ErrorCodes } from '@core/constants/error-codes';

import Trajectory from '@modules/trajectory/models/Trajectory';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import CatalogFolderService from '@shared/domain/catalog/CatalogFolderService';

import {
    escapeLikePattern,
    findRuntimeTargetsByTrajectoryId
} from '@modules/analysis/services/AnalysisQueries';
import { getTrajectoryFrames } from '@modules/trajectory/services/trajectory/TrajectoryReader';
import {
    LISTING_RELATIONS,
    PUBLIC_LISTING_SELECTION,
    toTrajectoryRecord,
    withFrameSummaries
} from '@modules/trajectory/services/trajectory/trajectory-record';

import ApplicationError from '@shared/application/errors/ApplicationError';
import eventBus from '@shared/infrastructure/events/PostgresEventBus';
import { paginate, readPageRequest, skipFor } from '@shared/infrastructure/persistence/paginate';

import { ILike, IsNull } from 'typeorm';
import type { FindOptionsWhere } from 'typeorm';
import type { PaginatedResult } from '@shared/domain/port/persistence';
import type {
    GetTrajectoriesByTeamIdInput,
    ListPublicTeamTrajectoriesInput,
    ListPublicTeamTrajectoriesOutput,
    MoveTrajectoryInput,
    PublicTeamDiscoveryView,
    TrajectoryRecord,
    UpdateTrajectoryByIdInput
} from '@modules/trajectory/services/TrajectoryServiceTypes';

/**
 * Every catalog kind shares one folder tree, so these are the shared shapes
 * derived from the owning service rather than a copy that can drift out of sync.
 */
export type TrajectoryFolderView = Awaited<ReturnType<CatalogFolderService['get']>>;
export type TrajectoryFolderQuery = NonNullable<Parameters<CatalogFolderService['list']>[1]>;

const LIST_DEFAULT_LIMIT = 20;

const requireTrajectoryWithTeam = async (trajectoryId: string): Promise<Trajectory> => {
    const trajectory = await Trajectory.findOne({
        where: { id: trajectoryId },
        relations: { teamRef: true }
    });
    if (!trajectory) {
        throw ApplicationError.notFound(ErrorCodes.TRAJECTORY_NOT_FOUND, 'Trajectory not found');
    }

    return trajectory;
};

/**
 * The trajectory catalog: the records themselves plus the folder tree that
 * organizes them. Deleting a folder cascades into the trajectories it holds,
 * which is why both live behind one service.
 */
class TrajectoryCatalogService {
    #folders = new CatalogFolderService(CatalogFolderKind.Trajectory);

    async getById(trajectoryId: string): Promise<TrajectoryRecord> {
        const view = toTrajectoryRecord(await requireTrajectoryWithTeam(trajectoryId));
        view.frames = await getTrajectoryFrames(trajectoryId);
        return view;
    }

    async getByTeamId(input: GetTrajectoriesByTeamIdInput): Promise<PaginatedResult<TrajectoryRecord>> {
        const pageRequest = readPageRequest(input.page, input.limit, { defaultLimit: LIST_DEFAULT_LIMIT });

        const where: FindOptionsWhere<Trajectory> = { team: input.teamId };
        if (input.folderId === 'root') {
            where.folder = IsNull();
        } else if (input.folderId) {
            where.folder = input.folderId;
        }
        if (input.search) {
            where.name = ILike(`%${escapeLikePattern(input.search)}%`);
        }

        const [trajectories, total] = await Trajectory.findAndCount({
            where,
            ...LISTING_RELATIONS,
            order: { updatedAt: 'DESC' },
            skip: skipFor(pageRequest),
            take: pageRequest.limit
        });

        return paginate([await withFrameSummaries(trajectories), total], pageRequest);
    }

    async listPublicByTeamId(input: ListPublicTeamTrajectoriesInput): Promise<ListPublicTeamTrajectoriesOutput> {
        const pageRequest = readPageRequest(input.page, input.limit, { defaultLimit: LIST_DEFAULT_LIMIT });
        const team = await Team.findOneBy({ id: input.teamId });
        if (!team) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_NOT_FOUND, 'Team not found');
        }

        const where: FindOptionsWhere<Trajectory> = {
            team: input.teamId,
            isPublic: true
        };
        const search = input.search?.trim();
        if (search) {
            where.name = ILike(`%${escapeLikePattern(search)}%`);
        }

        const [trajectories, total] = await Trajectory.findAndCount({
            where,
            select: PUBLIC_LISTING_SELECTION,
            order: { updatedAt: 'DESC' },
            skip: skipFor(pageRequest),
            take: pageRequest.limit
        });

        const teamDiscovery: PublicTeamDiscoveryView = {
            _id: team.id,
            name: team.name
        };

        return paginate(
            [await withFrameSummaries(trajectories), total],
            pageRequest,
            { team: teamDiscovery }
        ) as ListPublicTeamTrajectoriesOutput;
    }

    async updateById(input: UpdateTrajectoryByIdInput): Promise<TrajectoryRecord> {
        const trajectory = await requireTrajectoryWithTeam(input.trajectoryId);
        const updated = await Object.assign(trajectory, {
            name: input.name,
            isPublic: input.isPublic
        }).save();

        return toTrajectoryRecord(updated);
    }

    async move(input: MoveTrajectoryInput): Promise<null> {
        const trajectory = await Trajectory.findOneBy({
            id: input.trajectoryId,
            team: input.teamId
        });
        if (!trajectory) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Trajectory not found');
        }

        if (input.folderId !== null) {
            const folder = await CatalogFolder.findOneBy({
                id: input.folderId,
                team: input.teamId,
                kind: CatalogFolderKind.Trajectory
            });
            if (!folder) {
                throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Target Trajectory folder not found');
            }
        }

        trajectory.folder = input.folderId;
        await trajectory.save();
        return null;
    }

    /**
     * Removal is announced with the analyses that were running on it so each
     * compute cluster can drop its own runtime state.
     */
    async deleteById(input: { trajectoryId: string; teamId?: string; userId?: string }): Promise<{ success: boolean }> {
        const trajectory = await Trajectory.findOneBy({ id: input.trajectoryId });
        if (!trajectory) {
            throw ApplicationError.notFound(ErrorCodes.TRAJECTORY_NOT_FOUND, 'Trajectory not found');
        }

        const analysisRuntimeTargets = await findRuntimeTargetsByTrajectoryId(input.trajectoryId);
        await trajectory.remove();

        await eventBus.emit('trajectory.deleted', {
            trajectoryId: input.trajectoryId,
            teamId: input.teamId ?? trajectory.team,
            storageClusterId: trajectory.storageClusterId,
            userId: input.userId ?? '',
            trajectoryName: trajectory.name,
            analysisIds: analysisRuntimeTargets.map((target) => target.analysisId),
            analysisComputeClusterIds: [
                ...new Set(
                    analysisRuntimeTargets
                        .map((target) => target.computeClusterId)
                        .filter((value): value is string => Boolean(value))
                )
            ]
        });

        return { success: true };
    }

    listFolders(teamId: string, query: TrajectoryFolderQuery): Promise<PaginatedResult<TrajectoryFolderView>> {
        return this.#folders.list(teamId, query);
    }

    getFolder(teamId: string, folderId: string): Promise<TrajectoryFolderView> {
        return this.#folders.get(teamId, folderId, 'Trajectory folder not found');
    }

    createFolder(
        teamId: string,
        userId: string,
        input: { title: string; parentId?: string | null }
    ): Promise<TrajectoryFolderView> {
        return this.#folders.create(teamId, userId, input);
    }

    async updateFolder(teamId: string, folderId: string, title: string): Promise<TrajectoryFolderView> {
        await this.#folders.require(teamId, folderId, 'Trajectory folder not found');
        return this.#folders.update(teamId, folderId, title);
    }

    async deleteFolder(teamId: string, folderId: string): Promise<null> {
        await this.#folders.require(teamId, folderId, 'Trajectory folder not found');
        await this.#folders.removeTree(teamId, folderId, (id) => this.#deleteTrajectoriesInFolder(teamId, id));
        return null;
    }

    async #deleteTrajectoriesInFolder(teamId: string, folderId: string): Promise<void> {
        const trajectories = await Trajectory.find({
            where: {
                team: teamId,
                folder: folderId
            },
            select: { id: true }
        });

        for (const trajectory of trajectories) {
            await this.deleteById({
                trajectoryId: trajectory.id,
                teamId
            });
        }
    }
}

export default new TrajectoryCatalogService();
