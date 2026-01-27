/**
 * Service for formatting cell values in plugin data tables.
 * Pure domain logic - formatting rules without external dependencies.
 */
export class CellValueFormatterService {
    /**
     * Formats a cell value for display.
     *
     * @param value - Value to format
     * @param path - Column path (used for type hints)
     * @param formatDate - Optional date formatter function
     * @returns Formatted string
     */
    formatCellValue(
        value: any,
        path: string,
        formatDate?: (date: Date) => string
    ): string {
        if (value === null || value === undefined) {
            return '-';
        }

        if (typeof value === 'number') {
            return this.formatNumber(value);
        }

        if (typeof value === 'string') {
            if (this.isDatePath(path) && formatDate) {
                try {
                    return formatDate(new Date(value));
                } catch {
                    return value;
                }
            }
            return value;
        }

        if (Array.isArray(value)) {
            return value.map(v => this.formatCellValue(v, path, formatDate)).join(', ');
        }

        if (typeof value === 'object') {
            if ('name' in value && typeof value.name === 'string') {
                return String(value.name);
            }
            return JSON.stringify(value);
        }

        return String(value);
    }

    /**
     * Formats a number for display.
     */
    formatNumber(value: number): string {
        if (Number.isInteger(value)) {
            return value.toLocaleString();
        }
        return Number(value).toFixed(4).replace(/\.?0+$/, '');
    }

    /**
     * Checks if a path indicates a date field.
     */
    isDatePath(path: string): boolean {
        const lowerPath = path.toLowerCase();
        return lowerPath.includes('createdat') || lowerPath.endsWith('date');
    }
}
