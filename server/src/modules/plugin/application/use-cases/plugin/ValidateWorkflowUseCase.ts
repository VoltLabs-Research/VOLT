import { ValidateWorkflowInputDTO, ValidateWorkflowOutputDTO } from '@modules/plugin/application/dtos/plugin/ValidateWorkflowDTO';
import type { IWorkflowValidatorService } from '@modules/plugin/domain/port/plugin/IWorkflowValidatorService';
import { WorkflowValidationMode } from '@modules/plugin/domain/port/plugin/IWorkflowValidatorService';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';

import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject } from 'tsyringe';

@Singleton()
export class ValidateWorkflowUseCase implements IUseCase<ValidateWorkflowInputDTO, ValidateWorkflowOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.WorkflowValidatorService) private readonly validatorService: IWorkflowValidatorService
    ) {}

    async execute(input: ValidateWorkflowInputDTO): Promise<Result<ValidateWorkflowOutputDTO>> {
        const validation = await this.validatorService.validate(input.workflow, input.pluginId, WorkflowValidationMode.Strict);

        return Result.ok({
            validated: validation.isValid,
            errors: validation.errors,
            modifier: validation.modifier
        });
    }
}
