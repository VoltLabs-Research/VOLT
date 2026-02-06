import { container } from 'tsyringe';
import { SIMULATION_CELL_TOKENS } from './tokens';
import SimulationCellRepository from '../repositories/SimulationCellRepository';
import type ISimulationCellRepository from '../../domain/ports/ISimulationCellRepository';

export const ensureSimulationCellDI = (): void => {
    container.register<ISimulationCellRepository>(
        SIMULATION_CELL_TOKENS.SimulationCellRepository,
        SimulationCellRepository
    );
};
