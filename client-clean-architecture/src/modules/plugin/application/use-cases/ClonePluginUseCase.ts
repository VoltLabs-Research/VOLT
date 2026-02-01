import { inject, injectable } from 'tsyringe';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type IPluginRepository from '../../domain/ports/IPluginRepository';
import type { ClonePluginInputDTO, ClonePluginOutputDTO } from '../dtos';
import { PluginStatus } from '../../domain/entities';
import { PLUGIN_TOKENS } from '../../infrastructure/di/tokens';

@injectable()
export default class ClonePluginUseCase implements IUseCase<ClonePluginInputDTO, ClonePluginOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        private readonly pluginRepository: IPluginRepository
    ){}

    async execute({ pluginId, teamId }: ClonePluginInputDTO): Promise<ClonePluginOutputDTO> {
        const original = await this.pluginRepository.getById({ id: pluginId });

        const clonedNodes = original.workflow.nodes.map((node) => {
            if (node.type !== 'modifier') return node;
            
            return {
                ...node,
                data: {
                    ...node.data,
                    modifier: {
                        ...node.data.modifier,
                        name: `${node.data.modifier!.name} (Copy)`
                    }
                }
            };
        });

        return this.pluginRepository.create({
            slug: `${original.slug}-copy-${Date.now()}`,
            workflow: { ...original.workflow, nodes: clonedNodes },
            status: PluginStatus.DRAFT,
            team: teamId
        });
    }
};
