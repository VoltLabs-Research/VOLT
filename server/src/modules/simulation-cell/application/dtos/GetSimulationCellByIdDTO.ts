import type { SimulationCellProps } from '@modules/simulation-cell/domain/entities/SimulationCell';
import type { EntityIdInputDTO } from '@modules/team/application/dtos/common';

export type GetSimulationCellByIdInputDTO = EntityIdInputDTO<'simulationCellId'>;

export interface GetSimulationCellByIdOutputDTO extends SimulationCellProps {
    _id: string;
};
