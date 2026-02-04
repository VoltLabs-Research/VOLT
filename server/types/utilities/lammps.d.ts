export interface TimestepInfo {
    timestep: number;
    natoms: number;
}

export interface LammpsAtom {
    id: number;
    type: number;
    x: number;
    y: number;
    z: number;
    typeName?: string;
}
