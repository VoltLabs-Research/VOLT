import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Container from '@/shared/presentation/components/Container';
import useGetSimulationCells from '@/modules/simulation-cell/presentation/hooks/use-get-simulation-cells';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import ApiError from '@/shared/errors/ApiError';
import type { SimulationCell } from '@/modules/simulation-cell/domain/entities';
import type { Trajectory } from '@/modules/trajectory/domain/entities/Trajectory';

interface SimulationCellViewProps {
    trajectory: Trajectory | null | undefined;
    currentTimestep: number | undefined;
}

const SimulationCellView = ({ trajectory, currentTimestep }: SimulationCellViewProps) => {
    const getSimulationCells = useGetSimulationCells();
    const [cell, setCell] = useState<SimulationCell | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [rbacDenied, setRbacDenied] = useState(false);
    const [rbacMessage, setRbacMessage] = useState<string>();

    useEffect(() => {
        if (!trajectory?._id) return;

        const teamId = typeof trajectory.team === 'object' ? trajectory.team._id : trajectory.team;
        if (!teamId) return;

        let cancelled = false;
        setIsLoading(true);

        getSimulationCells({ page: 1, limit: 100 }).then((response) => {
            if (cancelled) return;
            const cells = response?.data;
            const match = cells.find((c: SimulationCell) => {
                const trajId = typeof c.trajectory === 'object' ? c.trajectory._id : c.trajectory;
                return trajId === trajectory._id && (currentTimestep === undefined || c.timestep === currentTimestep);
            }) ?? cells.find((c: SimulationCell) => {
                const trajId = typeof c.trajectory === 'object' ? c.trajectory._id : c.trajectory;
                return trajId === trajectory._id;
            });
            setCell(match);
        }).catch((error) => {
            if (!cancelled) {
                if(ApiError.isRBACError(error)){
                    setRbacDenied(true);
                    if(error instanceof ApiError) setRbacMessage(error.getFriendlyMessage());
                }else{
                    setCell(null);
                }
            }
        }).finally(() => {
            if (!cancelled) setIsLoading(false);
        });

        return () => { cancelled = true; };
    }, [trajectory?._id, currentTimestep, getSimulationCells]);

    if (rbacDenied) {
        return <AccessDenied description={rbacMessage} showBack={false} />;
    }

    if (isLoading || !cell) {
        return (
            <Container className="d-flex items-center content-center p-1">
                <span className="color-muted font-size-1">
                    {isLoading ? 'Loading simulation cell...' : 'No simulation cell data available'}
                </span>
            </Container>
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
        <Container className="p-1">
            <Container className="d-flex items-start gap-1-5">
                {columns.filter((col) => col.visible !== false).map((col) => (
                    <Container key={col.title} className="d-flex column" style={{ minWidth: 140 }}>
                        <span className="font-size-05 color-muted">{col.title}</span>
                        {col.rows.map(([label, value, valueClass]) => (
                            <Container key={label} className="d-flex items-center content-between font-size-1 color-secondary gap-1">
                                <span className="color-muted">{label}</span>
                                <span className={valueClass}>{value}</span>
                            </Container>
                        ))}
                    </Container>
                ))}
            </Container>
        </Container>
    );
};

export default SimulationCellView;
