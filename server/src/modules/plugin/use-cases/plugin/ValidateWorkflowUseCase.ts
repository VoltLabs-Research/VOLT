import { ValidateWorkflowInputDTO, ValidateWorkflowOutputDTO } from '@modules/plugin/dtos/plugin/ValidateWorkflowDTO';
import type { IWorkflowValidatorService } from '@modules/plugin/ports/plugin/IWorkflowValidatorService';
import { WorkflowValidationMode } from '@modules/plugin/ports/plugin/IWorkflowValidatorService';
import { PLUGIN_TOKENS } from '@modules/plugin/di/PluginTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';

import { IUseCase } from '@shared/application/IUseCase';
import { inject } from 'tsyringe';

@Singleton()
export class ValidateWorkflowUseCase implements IUseCase<ValidateWorkflowInputDTO, ValidateWorkflowOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.WorkflowValidatorService) private readonly validatorService: IWorkflowValidatorService
    ) {}

    async execute(input: ValidateWorkflowInputDTO): Promise<ValidateWorkflowOutputDTO> {
        const validation = await this.validatorService.validate(input.workflow, input.pluginId, WorkflowValidationMode.Strict);

        return {
            validated: validation.isValid,
            errors: validation.errors,
            modifier: validation.modifier
        };
    }
}
