import { useEffect, useState } from 'react';
import useSimulationCell from '@/modules/simulation-cell/hooks/use-simulation-cell';
import AccessDenied from '@/shared/ui/components/AccessDenied';
import { Box, Button, Checkbox, NumberInput, Row, Stack, Text } from '@voltstack/bravais';
import { useCellDisplayStore } from '@/modules/fractal/store/cell-display-store';
import type { CellPbc } from '@/modules/fractal/utils/cell-wireframe';
import { hasValidCellVectors } from '@/modules/fractal/utils/cell-wireframe';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';
import type { ReactNode } from 'react';

interface SimulationCellViewProps {
    trajectory: Trajectory | null | undefined;
    currentTimestep: number | undefined;
}

const AXIS_LABELS = ['a', 'b', 'c'] as const;
const PBC_AXES = ['x', 'y', 'z'] as const;

const cloneVectors = (vectors: number[][]): number[][] => vectors.map((v) => [...v]);

const SimulationCellView = ({ trajectory, currentTimestep }: SimulationCellViewProps) => {
    const teamId = typeof trajectory?.team === 'object' ? trajectory.team._id : trajectory?.team;
    const trajectoryId = trajectory?._id;
    const {
        simulationCell: cell,
        isLoading,
        accessDenied: accessDeniedState,
        accessDeniedMessage: accessDeniedMessage
    } = useSimulationCell({
        trajectoryId,
        timestep: currentTimestep,
        enabled: !!trajectoryId && !!teamId
    });

    const showPbcImages = useCellDisplayStore((state) => state.showPbcImages);
    const setShowPbcImages = useCellDisplayStore((state) => state.setShowPbcImages);
    const setCellOverride = useCellDisplayStore((state) => state.setCellOverride);
    const clearCellOverride = useCellDisplayStore((state) => state.clearCellOverride);
    const cellOverride = useCellDisplayStore((state) =>
        (trajectoryId ? state.cellOverrides[trajectoryId] : undefined)
    );

    const [isEditing, setIsEditing] = useState(false);
    const [draftVectors, setDraftVectors] = useState<number[][]>([]);
    const [draftPbc, setDraftPbc] = useState<CellPbc>({ x: true, y: true, z: true });

    const fetchedVectors = cell?.geometry?.cell_vectors;
    const fetchedPbc = cell?.geometry?.periodic_boundary_conditions;
    useEffect(() => {
        if (isEditing) return;
        const baseVectors = cellOverride?.cellVectors ?? fetchedVectors;
        const basePbc = cellOverride?.pbc ?? fetchedPbc;
        if (baseVectors) setDraftVectors(cloneVectors(baseVectors));
        if (basePbc) setDraftPbc({ ...basePbc });
    }, [isEditing, cellOverride, fetchedVectors, fetchedPbc]);

    if (accessDeniedState) {
        return <AccessDenied description={accessDeniedMessage} showBack={false} />;
    }

    if (isLoading || !cell) {
        return (
            <Row justify='center' p='1'>
                <Text size='sm' tone='muted'>
                    {isLoading ? 'Loading simulation cell...' : 'No simulation cell data available'}
                </Text>
            </Row>
        );
    }

    const pbc = cellOverride?.pbc ?? cell.geometry?.periodic_boundary_conditions;
    const pbcStr = pbc ? [pbc.x && 'X', pbc.y && 'Y', pbc.z && 'Z'].filter(Boolean).join(', ') : undefined;
    const vectors = cellOverride?.cellVectors ?? cell.geometry?.cell_vectors;
    const origin = cellOverride?.cellOrigin ?? cell.geometry?.cell_origin;
    const canEdit = !!trajectoryId && hasValidCellVectors(vectors);

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
            rows: (vectors ?? []).map((v, i) => [`V${i + 1}`, `[${v.map((n) => n.toFixed(3)).join(', ')}]`, 'font-mono'])
        },
        {
            title: 'Cell Origin',
            visible: !!origin,
            rows: origin ? [['Origin', `[${origin.map((n) => n.toFixed(3)).join(', ')}]`, 'font-mono']] : []
        }
    ];

    const updateDraftComponent = (vectorIndex: number, componentIndex: number, value: number) => {
        setDraftVectors((previous) => {
            const next = cloneVectors(previous);
            if (!next[vectorIndex]) next[vectorIndex] = [0, 0, 0];
            next[vectorIndex][componentIndex] = Number.isFinite(value) ? value : 0;
            return next;
        });
    };

    const applyEdit = () => {
        if (!trajectoryId) return;
        setCellOverride(trajectoryId, {
            cellVectors: cloneVectors(draftVectors),
            cellOrigin: origin ? [...origin] : [0, 0, 0],
            pbc: { ...draftPbc }
        });
        setIsEditing(false);
    };

    const resetEdit = () => {
        if (trajectoryId) clearCellOverride(trajectoryId);
        setIsEditing(false);
    };

    return (
        <Box p='1'>
            <Row align='start' justify='between' gap='1'>
                <Row align='start' gap='1-5'>
                    {columns.filter((col) => col.visible !== false).map((col) => (
                        <Stack key={col.title} style={{ minWidth: 140 }}>
                            <Text size='xs' tone='muted'>{col.title}</Text>
                            {col.rows.map(([label, value, valueClass]) => (
                                <Row key={label} justify='between' gap='1' className="font-size-1 color-secondary">
                                    <Text tone='muted'>{label}</Text>
                                    <span className={valueClass}>{value}</span>
                                </Row>
                            ))}
                        </Stack>
                    ))}
                </Row>
                <Stack gap='05' style={{ minWidth: 150 }}>
                    <Checkbox
                        checked={showPbcImages}
                        label='Show PBC images'
                        onChange={(event) => setShowPbcImages(event.target.checked)}
                    />
                    {canEdit && !isEditing && (
                        <Button variant='ghost' size='sm' onClick={() => setIsEditing(true)}>
                            Edit Cell
                        </Button>
                    )}
                    {cellOverride && !isEditing && (
                        <Button variant='ghost' size='sm' intent='neutral' onClick={resetEdit}>
                            Reset Cell
                        </Button>
                    )}
                </Stack>
            </Row>

            {isEditing && (
                <Stack gap='1' style={{ marginTop: 12 }}>
                    <Text size='xs' tone='muted'>Edit a/b/c edge vectors (Ångströms)</Text>
                    {draftVectors.map((vector, vectorIndex) => (
                        <Row key={AXIS_LABELS[vectorIndex] ?? vectorIndex} align='center' gap='05'>
                            <Text size='sm' style={{ width: 16 }}>{AXIS_LABELS[vectorIndex] ?? `v${vectorIndex + 1}`}</Text>
                            {vector.map((component, componentIndex) => (
                                <NumberInput
                                    key={componentIndex}
                                    value={component}
                                    step={0.1}
                                    onValueChange={(next) => updateDraftComponent(vectorIndex, componentIndex, next)}
                                    aria-label={`${AXIS_LABELS[vectorIndex] ?? vectorIndex} component ${componentIndex + 1}`}
                                />
                            ))}
                        </Row>
                    ))}
                    <Text size='xs' tone='muted'>Periodic boundary conditions</Text>
                    <Row gap='1'>
                        {PBC_AXES.map((axis) => (
                            <Checkbox
                                key={axis}
                                checked={draftPbc[axis]}
                                label={axis.toUpperCase()}
                                onChange={(event) => setDraftPbc((previous) => ({ ...previous, [axis]: event.target.checked }))}
                            />
                        ))}
                    </Row>
                    <Row gap='05'>
                        <Button size='sm' onClick={applyEdit}>Apply</Button>
                        <Button size='sm' variant='ghost' intent='neutral' onClick={() => setIsEditing(false)}>Cancel</Button>
                    </Row>
                </Stack>
            )}
        </Box>
    );
};

export default SimulationCellView;
