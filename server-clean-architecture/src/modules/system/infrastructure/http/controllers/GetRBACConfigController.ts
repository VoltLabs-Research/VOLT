import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { GetRBACConfigUseCase } from '@/src/modules/system/application/use-cases/GetRBACConfigUseCase';

@injectable()
export class GetRBACConfigController {
    constructor(
        @inject(GetRBACConfigUseCase) private useCase: GetRBACConfigUseCase
    ) { }

    async handle(_req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const result = await this.useCase.execute();

            if (result.success) {
                res.status(200).json({
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
