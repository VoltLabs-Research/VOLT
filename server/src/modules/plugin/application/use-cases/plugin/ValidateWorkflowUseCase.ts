import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { ValidateWorkflowInputDTO, ValidateWorkflowOutputDTO } from '@modules/plugin/application/dtos/plugin/ValidateWorkflowDTO';

export interface IWorkflowValidatorService {
    validate(workflow: any): { isValid: boolean; errors?: string[]; modifier?: any };
}

import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';

@injectable()
export class ValidateWorkflowUseCase implements IUseCase<ValidateWorkflowInputDTO, ValidateWorkflowOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.WorkflowValidatorService) private validatorService: IWorkflowValidatorService
    ){}

    async execute(input: ValidateWorkflowInputDTO): Promise<Result<ValidateWorkflowOutputDTO>> {
        const validation = this.validatorService.validate(input.workflow);

        return Result.ok({
            validated: validation.isValid,
            errors: validation.errors,
            modifier: validation.modifier
        });
    }
}
