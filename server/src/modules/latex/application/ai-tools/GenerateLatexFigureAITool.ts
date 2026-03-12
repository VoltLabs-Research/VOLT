import { AITool } from '@shared/application/ai/AITool';
import { injectable } from 'tsyringe';
import { z } from 'zod';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';

/**
 * Generates a LaTeX figure environment block.
 *
 * This is a pure generation tool — it constructs the `\begin{figure}...\end{figure}`
 * markup without any database interaction.
 */
@injectable()
export class GenerateLatexFigureAITool extends AITool {
    readonly name = 'generate_latex_figure';
    readonly description = 'Generate a LaTeX figure environment block for including an image. Returns the LaTeX code string ready to be inserted into a document.';
    readonly parameters = z.object({
        assetFilename: z.string().describe('The filename of the image asset, e.g. "diagram.png".'),
        caption: z.string().describe('Figure caption text.'),
        label: z.string().optional().describe('LaTeX label for cross-referencing, e.g. "fig:diagram".'),
        width: z.string().optional().default('0.8\\textwidth').describe('Width specification, e.g. "0.8\\textwidth".'),
        position: z.string().optional().default('ht').describe('Float placement specifier, e.g. "ht", "htbp".')
    });

    async execute(params: z.infer<typeof this.parameters>, _scope: AIToolScope) {
        const lines: string[] = [];

        lines.push(`\\begin{figure}[${params.position}]`);
        lines.push('    \\centering');
        lines.push(`    \\includegraphics[width=${params.width}]{${params.assetFilename}}`);
        lines.push(`    \\caption{${params.caption}}`);

        if (params.label) {
            lines.push(`    \\label{${params.label}}`);
        }

        lines.push('\\end{figure}');

        const latex = lines.join('\n');

        return {
            summary: `Generated a LaTeX figure environment for "${params.assetFilename}".`,
            latex
        };
    }
}
