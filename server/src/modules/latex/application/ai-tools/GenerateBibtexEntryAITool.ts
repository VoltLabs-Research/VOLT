import { AITool } from '@shared/application/ai/AITool';
import { injectable } from 'tsyringe';
import { z } from 'zod';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';

/**
 * Generates a BibTeX bibliography entry.
 *
 * This is a pure generation tool — it constructs a `@type{key, ...}` block
 * without any database interaction.
 */
@injectable()
export class GenerateBibtexEntryAITool extends AITool {
    readonly name = 'generate_bibtex_entry';
    readonly description = 'Generate a BibTeX bibliography entry. Returns the BibTeX code string ready to be inserted into a .bib file.';
    readonly parameters = z.object({
        entryType: z.string().describe('BibTeX entry type, e.g. "article", "book", "inproceedings".'),
        citationKey: z.string().describe('Citation key for referencing, e.g. "smith2024deep".'),
        title: z.string(),
        author: z.string().describe('Author name(s), e.g. "Smith, John and Doe, Jane".'),
        year: z.string(),
        journal: z.string().optional(),
        volume: z.string().optional(),
        pages: z.string().optional(),
        doi: z.string().optional(),
        publisher: z.string().optional(),
        url: z.string().optional()
    });

    async execute(params: z.infer<typeof this.parameters>, _scope: AIToolScope) {
        const fields: string[] = [];

        fields.push(`    author = {${params.author}}`);
        fields.push(`    title = {${params.title}}`);
        fields.push(`    year = {${params.year}}`);

        if (params.journal) {
            fields.push(`    journal = {${params.journal}}`);
        }
        if (params.volume) {
            fields.push(`    volume = {${params.volume}}`);
        }
        if (params.pages) {
            fields.push(`    pages = {${params.pages}}`);
        }
        if (params.doi) {
            fields.push(`    doi = {${params.doi}}`);
        }
        if (params.publisher) {
            fields.push(`    publisher = {${params.publisher}}`);
        }
        if (params.url) {
            fields.push(`    url = {${params.url}}`);
        }

        const bibtex = `@${params.entryType}{${params.citationKey},\n${fields.join(',\n')}\n}`;

        return {
            summary: `Generated a @${params.entryType} BibTeX entry with key "${params.citationKey}".`,
            bibtex
        };
    }
}
