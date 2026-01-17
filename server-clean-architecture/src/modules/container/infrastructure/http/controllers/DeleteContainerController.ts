import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { DeleteContainerUseCase } from '../../../application/use-cases/DeleteContainerUseCase';

@injectable()
export class DeleteContainerController {
    constructor(
        @inject(DeleteContainerUseCase) private useCase: DeleteContainerUseCase
    ) { }

    async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            // Assuming 'path' is also expected from req.params or another source if it's being added.
            // For now, assuming 'path' is not defined and removing it to maintain syntactical correctness
            // as per the instruction to "make sure to incorporate the change in a way so that the resulting file is syntactically correct."
            // The instruction "Cast req.params.id to string." is already handled by String(id).
            const result = await this.useCase.execute({ id: String(id) });

            if (result.success) {
                res.status(200).json({
                    status: 'success',
                    id: String(id),
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
