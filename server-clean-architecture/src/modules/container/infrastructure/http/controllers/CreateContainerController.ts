import { injectable, inject } from 'tsyringe';
import { Response, NextFunction } from 'express';
import { CreateContainerUseCase } from '../../../application/use-cases/CreateContainerUseCase';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';

@injectable()
export class CreateContainerController {
    constructor(
        @inject(CreateContainerUseCase) private useCase: CreateContainerUseCase
    ) { }

    async handle(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.userId!;
            const { name, image, ports, teamId, env, cmd, mountDockerSocket, useImageCmd, memory, cpus } = req.body;

            const result = await this.useCase.execute({
                name,
                image,
                ports,
                teamId,
                userId,
                env,
                cmd,
                mountDockerSocket,
                useImageCmd,
                memory,
                cpus
            });

            if (result.success) {
                res.status(201).json({
                    status: 'success',
                    data: result.value
                });
            } else {
                next(result.error);
            }
        } catch (error) {
            next(error);
        }
    }
}
