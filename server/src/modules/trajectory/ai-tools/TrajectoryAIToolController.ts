import typia from 'typia';
import AIToolController from '@shared/ai/AIToolController';
import { AITool } from '@shared/ai/tool';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import TrajectoryService from '@modules/trajectory/services/TrajectoryService';
import type {
    CloneTrajectoryInput,
    DeleteTrajectoryFolderInput,
    DeleteTrajectoryInput,
    GetTrajectoryInput,
    GetTrajectoryTeamMetricsInput,
    ListPublicTrajectoriesInput,
    ListSampleSimulationsInput,
    ListTrajectoriesInput,
    MoveTrajectoryInput,
    UpdateTrajectoryInput
} from '@volt/contracts/modules/trajectory/ai-tools';

export default class TrajectoryAIToolController extends AIToolController {
    #service = new TrajectoryService();

    @AITool({
        name: 'list_trajectories',
        description: 'List trajectories in the team, optionally filtered by folder or search.',
        parameters: typia.llm.parameters<ListTrajectoriesInput>(),
        validate: typia.createValidate<ListTrajectoriesInput>()
    })
    async listTrajectories(input: ListTrajectoriesInput & AIToolScope) {
        const { total, data } = await this.#service.getByTeamId(input);
        return {
            summary: `Found ${total} trajectories.`,
            data
        };
    }

    @AITool({
        name: 'list_public_trajectories',
        description: 'List the publicly shared trajectories for the team.',
        parameters: typia.llm.parameters<ListPublicTrajectoriesInput>(),
        validate: typia.createValidate<ListPublicTrajectoriesInput>()
    })
    async listPublicTrajectories(input: ListPublicTrajectoriesInput & AIToolScope) {
        const { total, data } = await this.#service.listPublicTeamTrajectories(input);
        return {
            summary: `Found ${total} public trajectories.`,
            data
        };
    }

    @AITool({
        name: 'list_sample_simulations',
        description: 'List the bundled sample simulations available to import.',
        parameters: typia.llm.parameters<ListSampleSimulationsInput>(),
        validate: typia.createValidate<ListSampleSimulationsInput>()
    })
    async listSampleSimulations() {
        const samples = await this.#service.listSamples();
        return {
            summary: `Found ${samples.length} sample simulations.`,
            data: samples
        };
    }

    @AITool({
        name: 'get_trajectory',
        description: 'Get detailed information about a specific trajectory.',
        parameters: typia.llm.parameters<GetTrajectoryInput>(),
        validate: typia.createValidate<GetTrajectoryInput>()
    })
    async getTrajectory(input: GetTrajectoryInput) {
        const trajectory = await this.#service.getById(input);
        return {
            summary: `Trajectory "${trajectory.name}" (${trajectory.status}).`,
            data: trajectory
        };
    }

    @AITool({
        name: 'get_trajectory_team_metrics',
        description: 'Get aggregate trajectory and storage metrics for the team.',
        parameters: typia.llm.parameters<GetTrajectoryTeamMetricsInput>(),
        validate: typia.createValidate<GetTrajectoryTeamMetricsInput>()
    })
    async getTeamMetrics(input: GetTrajectoryTeamMetricsInput & AIToolScope) {
        const metrics = await this.#service.getTeamMetrics(input);
        return {
            summary: 'Retrieved team trajectory metrics.',
            data: metrics
        };
    }

    @AITool({
        name: 'update_trajectory',
        description: 'Rename a trajectory or change its public visibility.',
        parameters: typia.llm.parameters<UpdateTrajectoryInput>(),
        validate: typia.createValidate<UpdateTrajectoryInput>()
    })
    updateTrajectory(input: UpdateTrajectoryInput & AIToolScope) {
        return this.#service.updateById(input);
    }

    @AITool({
        name: 'clone_trajectory',
        description: 'Clone an existing trajectory, optionally onto a target cluster.',
        parameters: typia.llm.parameters<CloneTrajectoryInput>(),
        validate: typia.createValidate<CloneTrajectoryInput>()
    })
    cloneTrajectory(input: CloneTrajectoryInput & AIToolScope) {
        return this.#service.cloneTrajectory(input);
    }

    @AITool({
        name: 'move_trajectory',
        description: 'Move a trajectory into a folder, or to the root when folderId is null.',
        parameters: typia.llm.parameters<MoveTrajectoryInput>(),
        validate: typia.createValidate<MoveTrajectoryInput>()
    })
    moveTrajectory(input: MoveTrajectoryInput & AIToolScope) {
        return this.#service.move(input);
    }

    @AITool({
        name: 'delete_trajectory',
        description: 'Delete a trajectory and its analyses.',
        parameters: typia.llm.parameters<DeleteTrajectoryInput>(),
        validate: typia.createValidate<DeleteTrajectoryInput>()
    })
    deleteTrajectory(input: DeleteTrajectoryInput & AIToolScope) {
        return this.#service.deleteById(input);
    }

    @AITool({
        name: 'delete_trajectory_folder',
        description: 'Delete a trajectory folder and all trajectories within it.',
        parameters: typia.llm.parameters<DeleteTrajectoryFolderInput>(),
        validate: typia.createValidate<DeleteTrajectoryFolderInput>()
    })
    deleteTrajectoryFolder(input: DeleteTrajectoryFolderInput & AIToolScope) {
        return this.#service.deleteFolder(input.teamId, input.folderId);
    }
}
