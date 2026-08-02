import typia from 'typia';
import AIToolController from '@shared/ai/AIToolController';
import { AIToolProvider } from '@shared/ai/provider-registry';
import { AITool } from '@shared/ai/tool';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import SimulationCellService from '@modules/simulation-cell/services/SimulationCellService';
import type { GetSimulationCellInput } from '@volt/contracts/modules/simulation-cell/ai-tools';

@AIToolProvider()
export default class SimulationCellAIToolController extends AIToolController {
    #service = new SimulationCellService();

    @AITool({
        name: 'get_simulation_cell',
        description: 'Get the simulation cell for a trajectory.',
        parameters: typia.llm.parameters<GetSimulationCellInput>(),
        validate: typia.createValidate<GetSimulationCellInput>()
    })
    async getSimulationCell(input: GetSimulationCellInput & AIToolScope) {
        const value = await this.#service.getByTrajectory(input);
        return {
            summary: value
                ? `Found simulation cell for trajectory ${input.trajectoryId}.`
                : `No simulation cell found for trajectory ${input.trajectoryId}.`,
            data: value
        };
    }
}
