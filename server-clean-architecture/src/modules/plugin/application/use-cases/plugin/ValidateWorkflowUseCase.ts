import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import { ValidateWorkflowInputDTO, ValidateWorkflowOutputDTO } from '../../dtos/plugin/ValidateWorkflowDTO';

export interface IWorkflowValidatorService {
    validate(workflow: any): { isValid: boolean; errors?: string[]; modifier?: any };
}

import { PLUGIN_TOKENS } from '../../../infrastructure/di/PluginTokens';

@injectable()
export class ValidateWorkflowUseCase implements IUseCase<ValidateWorkflowInputDTO, ValidateWorkflowOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.WorkflowValidatorService) private validatorService: IWorkflowValidatorService
    ) { }

    async execute(input: ValidateWorkflowInputDTO): Promise<Result<ValidateWorkflowOutputDTO>> {
        const validation = this.validatorService.validate(input.workflow);

        return Result.ok({
            validated: validation.isValid,
            errors: validation.errors,
            modifier: validation.modifier
        });
    }
}
