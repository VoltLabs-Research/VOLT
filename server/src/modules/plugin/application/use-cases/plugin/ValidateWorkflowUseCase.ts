import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { ValidateWorkflowInputDTO, ValidateWorkflowOutputDTO } from '@modules/plugin/application/dtos/plugin/ValidateWorkflowDTO';
import { IWorkflowValidatorService } from '@modules/plugin/domain/port/plugin/IWorkflowValidatorService';

import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

@injectable()
export class ValidateWorkflowUseCase implements IUseCase<ValidateWorkflowInputDTO, ValidateWorkflowOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.WorkflowValidatorService)
        private readonly validatorService: IWorkflowValidatorService
    ){}

    async execute(input: ValidateWorkflowInputDTO): Promise<Result<ValidateWorkflowOutputDTO>> {
        const validation = this.validatorService.validate(input.workflow);

        return Result.ok({
            validated: validation.isValid,
            errors: validation.errors,
            modifier: validation.modifier
        });
    }
};
