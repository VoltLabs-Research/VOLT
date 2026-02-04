import { LammpsAtom, TimestepInfo } from '@/types/utilities/lammps';

export interface ParsedFrame{
    timestepInfo: TimestepInfo;
    atoms: LammpsAtom[];
}

export interface OAtom{
    id: number;
    pos: [number, number, number];
    ptm_quaternion?: [number, number, number, number],
}

export interface AtomsGroupedByType {
    [typeName: string]: OAtom[];
}
