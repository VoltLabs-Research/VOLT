export default function formatAtomValue(value: unknown, decimals: number): string {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value.toFixed(decimals) : String(value);
    }

    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }

    if (value === null || value === undefined) {
        return '-';
    }

    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }

    return String(value);
}
