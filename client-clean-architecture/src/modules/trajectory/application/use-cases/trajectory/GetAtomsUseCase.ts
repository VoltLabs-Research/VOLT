import { inject, injectable } from 'tsyringe';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type ITrajectoryRepository from '../../../domain/ports/ITrajectoryRepository';
import type { GetAtomsInputDTO, GetAtomsOutputDTO } from '../../dtos/trajectory';
import { TRAJECTORY_TOKENS } from '../../../infrastructure/di/tokens';

@injectable()
export default class GetAtomsUseCase implements IUseCase<GetAtomsInputDTO, GetAtomsOutputDTO>{
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository
    ){}

    async execute(input: GetAtomsInputDTO): Promise<GetAtomsOutputDTO>{
        return this.trajectoryRepository.getAtoms(input);
    }
};
