import type { IPluginRepository } from '@modules/plugin/domain/port/plugin/IPluginRepository';
import { inject } from 'tsyringe';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import {
    DescribePluginArgumentsInputDTO,
    DescribePluginArgumentsOutputDTO,
    DescribedPluginArgument
} from '@modules/plugin/application/dtos/plugin/DescribePluginArgumentsDTO';
import type { ArgumentDefinition } from '@modules/plugin/domain/entities/plugin/workflow/nodes/ArgumentNode';
import { ArgumentType } from '@modules/plugin/domain/entities/plugin/workflow/nodes/ArgumentNode';
import { Singleton } from '@shared/infrastructure/di/decorators';

import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';

/**
 * Distills a plugin's `arguments` node into a flat, LLM-friendly schema. The
 * raw workflow carries DAG noise (handles, positions, conditional visibility,
 * plugin-reference mappings) that an assistant doesn't need to build a `config`
 * object — this keeps only what's needed to fill each argument, summarizing the
 * rest into a human-readable `note`.
 */
@Singleton()
export class DescribePluginArgumentsUseCase implements IUseCase<DescribePluginArgumentsInputDTO, DescribePluginArgumentsOutputDTO, ApplicationError> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private readonly pluginRepository: IPluginRepository
    ) {}

    async execute(input: DescribePluginArgumentsInputDTO): Promise<Result<DescribePluginArgumentsOutputDTO, ApplicationError>> {
        const plugin = await this.pluginRepository.findById(input.pluginId);
        if (!plugin) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            ));
        }

        const definitions = plugin.props.arguments ?? [];

        return Result.ok({
            pluginId: plugin._id,
            name: plugin.props.modifier?.name ?? plugin._id,
            arguments: definitions.map((definition) => this.describeArgument(definition))
        });
    }

    private describeArgument(definition: ArgumentDefinition): DescribedPluginArgument {
        const described: DescribedPluginArgument = {
            key: definition.argument,
            type: definition.type,
            label: definition.label,
            required: definition.required ?? false
        };

        if (definition.default !== undefined) {
            described.default = definition.default;
        }
        if (typeof definition.min === 'number') {
            described.min = definition.min;
        }
        if (typeof definition.max === 'number') {
            described.max = definition.max;
        }
        if (typeof definition.step === 'number') {
            described.step = definition.step;
        }
        if (definition.options?.length) {
            described.options = definition.options.map((option) => ({ key: option.key, label: option.label }));
        }
        if (definition.multipleSelection) {
            described.multipleSelection = true;
        }

        const note = this.buildNote(definition);
        if (note) {
            described.note = note;
        }

        return described;
    }

    private buildNote(definition: ArgumentDefinition): string | undefined {
        const notes: string[] = [];

        if (definition.type === ArgumentType.List && definition.listArguments?.length) {
            const itemKeys = definition.listArguments.map((item) => item.argument).join(', ');
            notes.push(`List of items; each item has: ${itemKeys}.`);
        }
        if (definition.type === ArgumentType.PluginReference) {
            notes.push('References another plugin; pass that plugin\'s id/key as the value.');
        }
        if (definition.optionsFromArguments?.length || definition.optionsFromPluginReference) {
            notes.push('Available options depend on other arguments at runtime.');
        }
        if (definition.visibleWhen) {
            notes.push(`Only applies when "${definition.visibleWhen.argument}" ${definition.visibleWhen.operator} its configured value.`);
        }

        return notes.length ? notes.join(' ') : undefined;
    }
}
