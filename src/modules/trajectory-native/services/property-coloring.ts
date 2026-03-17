export enum GradientType {
    Viridis = 0,
    Plasma = 1,
    BlueRed = 2,
    Grayscale = 3
};

export const resolveGradientType = (gradientName: string): GradientType => {
    if (gradientName === 'Plasma') {
        return GradientType.Plasma;
    }

    if (gradientName === 'BlueRed') {
        return GradientType.BlueRed;
    }

    if (gradientName === 'GrayScale') {
        return GradientType.Grayscale;
    }

    return GradientType.Viridis;
};
