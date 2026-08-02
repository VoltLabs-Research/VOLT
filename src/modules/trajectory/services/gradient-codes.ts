/**
 * Colour-ramp identifiers understood by the native spatial assembler. The numeric
 * values are part of the native ABI and must not be reordered.
 */
export enum GradientCode {
    Viridis = 0,
    Plasma = 1,
    BlueRed = 2,
    Grayscale = 3,
    Magma = 4,
    Inferno = 5,
    Cividis = 6,
    RdBu = 7,
    Coolwarm = 8,
    Jet = 9
}

const GRADIENT_BY_NAME: Record<string, GradientCode> = {
    viridis: GradientCode.Viridis,
    plasma: GradientCode.Plasma,
    bluered: GradientCode.BlueRed,
    grayscale: GradientCode.Grayscale,
    magma: GradientCode.Magma,
    inferno: GradientCode.Inferno,
    cividis: GradientCode.Cividis,
    rdbu: GradientCode.RdBu,
    coolwarm: GradientCode.Coolwarm,
    jet: GradientCode.Jet,
    rainbow: GradientCode.Jet
};

export const resolveGradientCode = (gradient: string): GradientCode => (
    GRADIENT_BY_NAME[gradient.toLowerCase()] ?? GradientCode.Viridis
);
