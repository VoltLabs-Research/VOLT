export const SIMULATION_CELL_TOKENS = {
    SimulationCellRepository: Symbol.for('simulation-cell.repository'),
    GetSimulationCellByIdUseCase: Symbol.for('simulation-cell.get-by-id.use-case'),
    GetSimulationCellByTrajectoryUseCase: Symbol.for('simulation-cell.get-by-trajectory.use-case'),
    ListSimulationCellsByTeamIdUseCase: Symbol.for('simulation-cell.list-by-team-id.use-case'),
    GetSimulationCellByIdController: Symbol.for('simulation-cell.get-by-id.controller'),
    GetSimulationCellByTrajectoryController: Symbol.for('simulation-cell.get-by-trajectory.controller'),
    ListSimulationCellsByTeamIdController: Symbol.for('simulation-cell.list-by-team-id.controller')
};
