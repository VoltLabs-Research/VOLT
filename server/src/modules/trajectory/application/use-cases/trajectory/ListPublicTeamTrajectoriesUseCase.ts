import {
    ListPublicTeamTrajectoriesInputDTO,
    ListPublicTeamTrajectoriesOutputDTO
} from '@modules/trajectory/application/dtos/trajectory/ListPublicTeamTrajectoriesDTO';
import { ErrorCodes } from '@core/constants/error-codes';
import TeamRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team/TeamRepository';
import TrajectoryFrameRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryFrameRepository';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { Result } from '@shared/domain/port/Result';

import { injectable } from 'tsyringe';

const escapeRegex = (value: string): string => (
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
);

@injectable()
export default class ListPublicTeamTrajectoriesUseCase implements IUseCase<
    ListPublicTeamTrajectoriesInputDTO,
    ListPublicTeamTrajectoriesOutputDTO,
    ApplicationError
> {
    constructor(
        private readonly teamRepository: TeamRepository,
        private readonly trajectoryRepository: TrajectoryRepository,
        private readonly trajectoryFrameRepository: TrajectoryFrameRepository
    ) {}

    async execute(input: ListPublicTeamTrajectoriesInputDTO): Promise<Result<ListPublicTeamTrajectoriesOutputDTO, ApplicationError>> {
        const { teamId, page = 1, limit = 20 } = input;
        const team = await this.teamRepository.findById(teamId);

        if (!team) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_NOT_FOUND,
                'Team not found'
            ));
        }

        const filter: Record<string, unknown> = {
            team: teamId,
            isPublic: true
        };
        const search = input.search?.trim();

        if (search) {
            filter.name = { $regex: escapeRegex(search), $options: 'i' };
        }

        const results = await this.trajectoryRepository.findAll({
            filter,
            select: [
                'name',
                'team',
                'status',
                'isPublic',
                'hasPreview',
                'stats',
                'createdAt',
                'updatedAt'
            ],
            sort: { updatedAt: -1 },
            page,
            limit
        });

        const summaries = await this.trajectoryFrameRepository.getListingSummariesByTrajectoryIds(
            results.data.map((trajectory) => trajectory.id)
        );

        const data = results.data.map((trajectory) => {
            const summary = summaries.get(trajectory.id);
            trajectory.props.framesCount = summary?.framesCount ?? 0;
            trajectory.props.atoms = summary?.atoms ?? 0;
            trajectory.props.firstTimestep = summary?.firstTimestep;

            return toPersistedOutput(trajectory);
        });

        return Result.ok({
            ...results,
            data,
            _meta: {
                team: {
                    _id: team.id,
                    name: team.props.name
                }
            }
        });
    }
}
