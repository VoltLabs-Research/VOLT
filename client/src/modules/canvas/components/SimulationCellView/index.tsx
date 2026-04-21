import useSimulationCell from '@/modules/simulation-cell/hooks/use-simulation-cell';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';
import type { ReactNode } from 'react';

interface SimulationCellViewProps {
    trajectory: Trajectory | null | undefined;
    currentTimestep: number | undefined;
};

const SimulationCellView = ({ trajectory, currentTimestep }: SimulationCellViewProps) => {
    const teamId = typeof trajectory?.team === 'object' ? trajectory.team._id : trajectory?.team;
    const {
        simulationCell: cell,
        isLoading,
        accessDenied: accessDeniedState,
        accessDeniedMessage: accessDeniedMessage
    } = useSimulationCell({
        trajectoryId: trajectory?._id,
        timestep: currentTimestep,
        enabled: !!trajectory?._id && !!teamId
    });

    if (accessDeniedState) {
        return <AccessDenied description={accessDeniedMessage} showBack={false} />;
    }

    if (isLoading || !cell) {
        return (
            <div className="volt-container d-flex items-center content-center p-1">
                <span className="color-muted font-size-1">
                    {isLoading ? 'Loading simulation cell...' : 'No simulation cell data available'}
                </span>
            </div>
        );
    }

    const pbc = cell.geometry?.periodic_boundary_conditions;
    const pbcStr = pbc ? [pbc.x && 'X', pbc.y && 'Y', pbc.z && 'Z'].filter(Boolean).join(', ') : undefined;
    const vectors = cell.geometry?.cell_vectors;
    const origin = cell.geometry?.cell_origin;

    const boundingBoxRows: [string, ReactNode][] = [
        ['Width', cell.boundingBox?.width?.toFixed(4)],
        ['Height', cell.boundingBox?.height?.toFixed(4)],
        ['Length', cell.boundingBox?.length?.toFixed(4)]
    ];

    const boundaryRows: [string, ReactNode][] = [
        ['Periodic', pbcStr],
        ['Timestep', cell.timestep]
    ];

    const columns: { title: string; visible?: boolean; rows: [string, ReactNode, string?][] }[] = [
        { title: 'Bounding Box', rows: boundingBoxRows },
        { title: 'Boundary Conditions', rows: boundaryRows },
        {
            title: 'Cell Vectors',
            visible: !!vectors && vectors.length > 0,
            rows: (vectors ?? []).map((v, i) => [`V${i + 1}`, `[${v.map((n) => n.toFixed(3)).join(', ')}]`, 'canvas-simcell-value--mono'])
        },
        {
            title: 'Cell Origin',
            visible: !!origin,
            rows: origin ? [['Origin', `[${origin.map((n) => n.toFixed(3)).join(', ')}]`, 'canvas-simcell-value--mono']] : []
        }
    ];

    return (
        <div className="volt-container p-1">
            <div className="volt-container d-flex items-start gap-1-5">
                {columns.filter((col) => col.visible !== false).map((col) => (
                    <div key={col.title} className="volt-container d-flex column" style={{ minWidth: 140 }}>
                        <span className="font-size-05 color-muted">{col.title}</span>
                        {col.rows.map(([label, value, valueClass]) => (
                            <div key={label} className="volt-container d-flex items-center content-between font-size-1 color-secondary gap-1">
                                <span className="color-muted">{label}</span>
                                <span className={valueClass}>{value}</span>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SimulationCellView;
