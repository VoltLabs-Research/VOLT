import type { AtomContext, ColumnView } from '@voltstack/expressions';
import type { AtomColumnView, GetAtomsResponse } from '@/modules/trajectory/api/services/trajectory-service';

// OVITO's names for the properties a LAMMPS dump stores under its own column names, so a formula
// written for OVITO, such as Position.X > 10, reads the frame as it does there. A column that
// already carries the OVITO name wins.
const OVITO_ALIASES: Readonly<Record<string, string>> = {
    'Position.X': 'x',
    'Position.Y': 'y',
    'Position.Z': 'z',
    'Velocity.X': 'vx',
    'Velocity.Y': 'vy',
    'Velocity.Z': 'vz',
    'Force.X': 'fx',
    'Force.Y': 'fy',
    'Force.Z': 'fz',
    ParticleType: 'type',
    ParticleIdentifier: 'id',
    Mass: 'mass',
    Charge: 'q'
};

const toColumnView = (column: AtomColumnView): ColumnView => ({
    values: column.values,
    dtype: column.dtype
});

const resolveColumn = (atoms: GetAtomsResponse, name: string): AtomColumnView | undefined => {
    const column = atoms.getColumn(name);
    if (column || !Object.hasOwn(OVITO_ALIASES, name)) {
        return column;
    }
    return atoms.getColumn(OVITO_ALIASES[name]);
};

export const createExpressionAtomContext = (
    atoms: GetAtomsResponse,
    frame: number,
    cellVolume = 0
): AtomContext => ({
    N: atoms.count,
    Frame: frame,
    CellVolume: cellVolume,
    getColumn: (name: string) => {
        const column = resolveColumn(atoms, name);
        return column ? toColumnView(column) : undefined;
    }
});
