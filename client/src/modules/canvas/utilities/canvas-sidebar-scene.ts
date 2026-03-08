import type { Analysis } from '@/modules/analysis/api/entities/analysis';

const flattenConfig = (analysis: Analysis): Record<string, unknown> => {
    return (analysis as any).config;
};

export const computeDifferingConfigFields = (analyses: Analysis[]) => {
    const map = new Map<string, [string, unknown][]>();
    if (!analyses.length) return map;

    const allKeys = new Set<string>();
    const configs = analyses.map((analysis) => {
        const config = flattenConfig(analysis);
        Object.keys(config).forEach((key) => allKeys.add(key));
        return config;
    });

    analyses.forEach((analysis, index) => {
        const diffs: [string, unknown][] = [];
        const config = configs[index];

        allKeys.forEach((key) => {
            const currentValue = (config as any)[key];
            const isDifferent = configs.some((other, otherIndex) => {
                if (otherIndex === index) return false;
                return (other as any)[key] !== currentValue;
            });
            if (isDifferent) diffs.push([key, currentValue]);
        });

        map.set((analysis as any)._id, diffs);
    });

    return map;
};
