export type LammpsUnits =
    'lj' | 'real' | 'metal' | 'si' | 'cgs' | 'electron' | 'micro' | 'nano';

export interface UnitsConvention {

    units: LammpsUnits;

    length: string;

    mass: string;

    time: string;

    energy: string;

    velocity: string;

    force: string;

    temperature: string;

    charge: string;

    lengthToAngstrom: number;
}

export const UNITS_CONVENTIONS: Readonly<Record<LammpsUnits, UnitsConvention>> = {
    lj: {
        units: 'lj',
        length: 'sigma',
        mass: 'mass',
        time: 'tau',
        energy: 'epsilon',
        velocity: 'sigma/tau',
        force: 'epsilon/sigma',
        temperature: 'reduced',
        charge: 'reduced',
        lengthToAngstrom: 1
    },
    real: {
        units: 'real',
        length: 'Angstrom',
        mass: 'gram/mole',
        time: 'femtosecond',
        energy: 'Kcal/mole',
        velocity: 'Angstrom/femtosecond',
        force: 'Kcal/mole/Angstrom',
        temperature: 'Kelvin',
        charge: 'e',
        lengthToAngstrom: 1
    },
    metal: {
        units: 'metal',
        length: 'Angstrom',
        mass: 'gram/mole',
        time: 'picosecond',
        energy: 'eV',
        velocity: 'Angstrom/picosecond',
        force: 'eV/Angstrom',
        temperature: 'Kelvin',
        charge: 'e',
        lengthToAngstrom: 1
    },
    si: {
        units: 'si',
        length: 'meter',
        mass: 'kilogram',
        time: 'second',
        energy: 'Joule',
        velocity: 'meter/second',
        force: 'Newton',
        temperature: 'Kelvin',
        charge: 'Coulomb',
        lengthToAngstrom: 1e10
    },
    cgs: {
        units: 'cgs',
        length: 'centimeter',
        mass: 'gram',
        time: 'second',
        energy: 'erg',
        velocity: 'centimeter/second',
        force: 'dyne',
        temperature: 'Kelvin',
        charge: 'statcoulomb',
        lengthToAngstrom: 1e8
    },
    electron: {
        units: 'electron',
        length: 'Bohr',
        mass: 'amu',
        time: 'femtosecond',
        energy: 'Hartree',
        velocity: 'Bohr/atomic-time-unit',
        force: 'Hartree/Bohr',
        temperature: 'Kelvin',
        charge: 'e',
        lengthToAngstrom: 0.52917721067
    },
    micro: {
        units: 'micro',
        length: 'micrometer',
        mass: 'picogram',
        time: 'microsecond',
        energy: 'picogram-micrometer^2/microsecond^2',
        velocity: 'micrometer/microsecond',
        force: 'picogram-micrometer/microsecond^2',
        temperature: 'Kelvin',
        charge: 'picocoulomb',
        lengthToAngstrom: 1e4
    },
    nano: {
        units: 'nano',
        length: 'nanometer',
        mass: 'attogram',
        time: 'nanosecond',
        energy: 'attogram-nanometer^2/nanosecond^2',
        velocity: 'nanometer/nanosecond',
        force: 'attogram-nanometer/nanosecond^2',
        temperature: 'Kelvin',
        charge: 'e',
        lengthToAngstrom: 10
    }
};

export const LAMMPS_UNITS: readonly LammpsUnits[] = Object.keys(
    UNITS_CONVENTIONS
) as LammpsUnits[];

export const DEFAULT_UNITS: LammpsUnits = 'metal';

const LAMMPS_UNITS_SET = new Set<string>(LAMMPS_UNITS);

export const asLammpsUnits = (value: string | null | undefined): LammpsUnits | null => {
    if (!value) return null;
    const lowered = value.trim().toLowerCase();
    return LAMMPS_UNITS_SET.has(lowered) ? (lowered as LammpsUnits) : null;
};
