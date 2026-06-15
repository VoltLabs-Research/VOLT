// LAMMPS units conventions. Source: the LAMMPS `units` command documentation
// (https://docs.lammps.org/units.html). Each convention fixes the physical unit of
// every quantity LAMMPS reports; VOLT records the trajectory's convention so the
// View stack can label axes and convert lengths to Angstrom (the engine's internal
// length unit).
//
// Pure data + a lookup helper. No I/O, no runtime validation (the table is literal
// and trusted per the no-redundant-validation rule).

export type LammpsUnits =
    'lj' | 'real' | 'metal' | 'si' | 'cgs' | 'electron' | 'micro' | 'nano';

export interface UnitsConvention {
    /** The LAMMPS `units` keyword this convention describes. */
    units: LammpsUnits;
    /** Length unit label (e.g. "Angstrom", "meter"). */
    length: string;
    /** Mass unit label (e.g. "gram/mole", "kilogram"). */
    mass: string;
    /** Time unit label (e.g. "femtosecond", "second"). */
    time: string;
    /** Energy unit label (e.g. "eV", "Kcal/mole"). */
    energy: string;
    /** Velocity unit label. */
    velocity: string;
    /** Force unit label. */
    force: string;
    /** Temperature unit label. */
    temperature: string;
    /** Charge unit label. */
    charge: string;
    /**
     * Multiplicative factor that converts a length expressed in this convention to
     * Angstrom (the engine's internal length unit). `metal`/`real` are already in
     * Angstrom (factor 1); `si` is in meters (1 m = 1e10 Angstrom); etc.
     * `lj` is dimensionless (reduced units) so the factor is 1 by convention.
     */
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

/** Default units convention when a trajectory declares none. `metal` is the
 *  atomistic-MD default and the one VOLT's element radii (Angstrom) align with. */
export const DEFAULT_UNITS: LammpsUnits = 'metal';

const LAMMPS_UNITS_SET = new Set<string>(LAMMPS_UNITS);

/** Narrow a free-form string to a known `LammpsUnits`, or null. */
export const asLammpsUnits = (value: string | null | undefined): LammpsUnits | null => {
    if (!value) return null;
    const lowered = value.trim().toLowerCase();
    return LAMMPS_UNITS_SET.has(lowered) ? (lowered as LammpsUnits) : null;
};
