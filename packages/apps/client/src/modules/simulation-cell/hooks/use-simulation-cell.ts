import { simulationCellByTrajectoryQuery } from './queries';
import type { SimulationCell } from '@volt/contracts/modules/simulation-cell/domain';
import { ErrorSurface } from '@/shared/contracts/errors';
import { isAccessDeniedError, reportError } from '@/shared/errors/core/report-error';
import { isWasmLocalTrajectoryId } from '@/modules/canvas-wasm/constants';
import { useWasmCanvasStore } from '@/modules/canvas-wasm/store';

interface UseSimulationCellParams {
    trajectoryId?: string;
    timestep?: number;
    enabled?: boolean;
};

interface UseSimulationCellResult {
    simulationCell: SimulationCell | null;
    isLoading: boolean;
    accessDenied: boolean;
    accessDeniedMessage: string | undefined;
};

const useSimulationCell = ({
    trajectoryId,
    timestep,
    enabled = true
}: UseSimulationCellParams = {}): UseSimulationCellResult => {
    const isWasm = isWasmLocalTrajectoryId(trajectoryId);
    const wasmCell = useWasmCanvasStore((state) => {
        if (!isWasm || timestep === undefined) {
            return null;
        }
        return state.simulationCells[timestep] ?? Object.values(state.simulationCells)[0] ?? null;
    });
    const {
        data,
        isLoading,
        error: queryError
    } = simulationCellByTrajectoryQuery(
        {
            trajectoryId: trajectoryId || '',
            timestep
        },
        {
            enabled: enabled && Boolean(trajectoryId) && !isWasm,
            retry: (failureCount, error) => {
                if (isAccessDeniedError(error)) {
                    return false;
                }

                return failureCount < 2;
            }
        }
    );

    const accessDenied = isAccessDeniedError(queryError);

    return {
        simulationCell: isWasm ? wasmCell : (data ?? null),
        isLoading: isWasm ? false : isLoading,
        accessDenied: isWasm ? false : accessDenied,
        accessDeniedMessage: accessDenied
            ? reportError(queryError, { surface: ErrorSurface.Silent }).title
            : undefined
    };
};

export default useSimulationCell;
