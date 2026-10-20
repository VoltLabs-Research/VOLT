import { DefineEventGroup, Event } from '@shared/events/EventGroup';
import SimulationCell from '@modules/simulation-cell/models/SimulationCell';

@DefineEventGroup('simulation-cell')
export default class SimulationCellEvents{
    @Event('team.deleted')
    async deleteTeamSimulationCells({ teamId }: EventMap['team.deleted']){
        await SimulationCell.delete({ team: teamId });
    }

    @Event('trajectory.deleted')
    async deleteTrajectorySimulationCells({ trajectoryId }: EventMap['trajectory.deleted']){
        await SimulationCell.delete({ trajectory: trajectoryId });
    }
}
