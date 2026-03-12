import { AITool } from '@shared/application/ai/AITool';
import { injectable } from 'tsyringe';
import { z } from 'zod';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';

/**
 * Generates LaTeX table code from a description or structured data.
 *
 * This is a pure generation tool — it constructs LaTeX markup without
 * any database interaction.
 */
@injectable()
export class GenerateLatexTableAITool extends AITool {
    readonly name = 'generate_latex_table';
    readonly description = 'Generate LaTeX table code from a description or structured data. Returns the LaTeX code string ready to be inserted into a document.';
    readonly parameters = z.object({
        description: z.string().describe('Description of the table content and structure.'),
        columns: z.array(z.string()).optional().describe('Column header names.'),
        rows: z.array(z.array(z.string())).optional().describe('Row data as arrays of cell values.'),
        caption: z.string().optional().describe('Table caption.'),
        label: z.string().optional().describe('LaTeX label for cross-referencing, e.g. "tab:results".')
    });

    async execute(params: z.infer<typeof this.parameters>, _scope: AIToolScope) {
        const columns = params.columns ?? [];
        const rows = params.rows ?? [];

        if (columns.length === 0 && rows.length === 0) {
            return {
                summary: `No columns or rows provided. Use the description to create the table manually: "${params.description}"`,
                latex: ''
            };
        }

        const colCount = columns.length > 0
            ? columns.length
            : (rows[0]?.length ?? 1);

        const alignment = Array(colCount).fill('l').join(' ');
        const lines: string[] = [];

        lines.push('\\begin{table}[ht]');
        lines.push('    \\centering');
        lines.push(`    \\begin{tabular}{${alignment}}`);
        lines.push('        \\hline');

        if (columns.length > 0) {
            const headerRow = columns.map((col) => `\\textbf{${col}}`).join(' & ');
            lines.push(`        ${headerRow} \\\\`);
            lines.push('        \\hline');
        }

        for (const row of rows) {
            const paddedRow = row.concat(
                Array(Math.max(0, colCount - row.length)).fill('')
            );
            lines.push(`        ${paddedRow.join(' & ')} \\\\`);
        }

        lines.push('        \\hline');
        lines.push('    \\end{tabular}');

        if (params.caption) {
            lines.push(`    \\caption{${params.caption}}`);
        }

        if (params.label) {
            lines.push(`    \\label{${params.label}}`);
        }

        lines.push('\\end{table}');

        const latex = lines.join('\n');

        return {
            summary: `Generated a LaTeX table with ${colCount} columns and ${rows.length} rows.`,
            latex
        };
    }
}
