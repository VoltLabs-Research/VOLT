import { useEffect, useState } from 'react';
import useSimulationCell from '@/modules/simulation-cell/hooks/use-simulation-cell';
import AccessDenied from '@/shared/ui/components/AccessDenied';
import { Button, Checkbox, Label, NumberField } from '@heroui/react';
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

/**
 * bravais's `Checkbox` took an inline `label` and a native change event; HeroUI's is
 * compositional and reports the next boolean directly.
 */
interface CellCheckboxProps {
    isSelected: boolean;
    label: string;
    onChange: (isSelected: boolean) => void;
}

const CellCheckbox = ({ isSelected, label, onChange }: CellCheckboxProps) => (
    <Checkbox isSelected={isSelected} onChange={onChange}>
        <Checkbox.Content>
            <Checkbox.Control>
                <Checkbox.Indicator />
            </Checkbox.Control>
            <Label>{label}</Label>
        </Checkbox.Content>
    </Checkbox>
);

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
    const [draftPbc, setDraftPbc] = useState<CellPbc>({
        x: true,
        y: true,
        z: true
    });

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
            <div className='flex flex-row items-center justify-center p-4'>
                <span className='text-xs text-muted'>
                    {isLoading ? 'Loading simulation cell...' : 'No simulation cell data available'}
                </span>
            </div>
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
        {
            title: 'Bounding Box',
            rows: boundingBoxRows
        },
        {
            title: 'Boundary Conditions',
            rows: boundaryRows
        },
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
        <div className='p-4'>
            <div className='flex flex-row items-start justify-between gap-4'>
                <div className='flex flex-row items-start gap-6'>
                    {columns.filter((col) => col.visible !== false).map((col) => (
                        <div className='flex flex-col' key={col.title} style={{ minWidth: 140 }}>
                            <span className='text-xs text-muted'>{col.title}</span>
                            {col.rows.map(([label, value, valueClass]) => (
                                <div className='flex flex-row items-center justify-between gap-4 text-xs text-muted' key={label}>
                                    <span className='text-muted'>{label}</span>
                                    <span className={valueClass}>{value}</span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
                <div className='flex flex-col gap-2' style={{ minWidth: 150 }}>
                    <CellCheckbox
                        isSelected={showPbcImages}
                        label='Show PBC images'
                        onChange={setShowPbcImages}
                    />
                    {canEdit && !isEditing && (
                        <Button variant='ghost' size='sm' onPress={() => setIsEditing(true)}>
                            Edit Cell
                        </Button>
                    )}
                    {cellOverride && !isEditing && (
                        <Button variant='ghost' size='sm' onPress={resetEdit}>
                            Reset Cell
                        </Button>
                    )}
                </div>
            </div>

            {isEditing && (
                <div className='flex flex-col gap-4' style={{ marginTop: 12 }}>
                    <span className='text-xs text-muted'>Edit a/b/c edge vectors (Ångströms)</span>
                    {draftVectors.map((vector, vectorIndex) => (
                        <div className='flex flex-row items-center gap-2' key={AXIS_LABELS[vectorIndex] ?? vectorIndex}>
                            <span className='text-xs' style={{ width: 16 }}>{AXIS_LABELS[vectorIndex] ?? `v${vectorIndex + 1}`}</span>
                            {vector.map((component, componentIndex) => (
                                <NumberField
                                    key={componentIndex}
                                    value={component}
                                    step={0.1}
                                    onChange={(next) => updateDraftComponent(vectorIndex, componentIndex, next)}
                                    aria-label={`${AXIS_LABELS[vectorIndex] ?? vectorIndex} component ${componentIndex + 1}`}
                                >
                                    <NumberField.Group>
                                        <NumberField.DecrementButton />
                                        <NumberField.Input />
                                        <NumberField.IncrementButton />
                                    </NumberField.Group>
                                </NumberField>
                            ))}
                        </div>
                    ))}
                    <span className='text-xs text-muted'>Periodic boundary conditions</span>
                    <div className='flex flex-row items-center gap-4'>
                        {PBC_AXES.map((axis) => (
                            <CellCheckbox
                                key={axis}
                                isSelected={draftPbc[axis]}
                                label={axis.toUpperCase()}
                                onChange={(isSelected) => setDraftPbc((previous) => ({
                                    ...previous,
                                    [axis]: isSelected
                                }))}
                            />
                        ))}
                    </div>
                    <div className='flex flex-row items-center gap-2'>
                        <Button variant='secondary' size='sm' onPress={applyEdit}>Apply</Button>
                        <Button size='sm' variant='ghost' onPress={() => setIsEditing(false)}>Cancel</Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SimulationCellView;
