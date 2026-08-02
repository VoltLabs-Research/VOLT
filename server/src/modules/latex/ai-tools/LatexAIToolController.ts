import typia from 'typia';
import AIToolController from '@shared/ai/AIToolController';
import { AIToolProvider } from '@shared/ai/provider-registry';
import { AITool } from '@shared/ai/tool';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import LatexDocumentService from '@modules/latex/services/LatexDocumentService';
import LatexDownloadService from '@modules/latex/services/LatexDownloadService';
import LatexFileService from '@modules/latex/services/LatexFileService';
import type { LatexFile } from '@volt/contracts/modules/latex/domain';
import LatexAssetService from '@modules/latex/services/LatexAssetService';
import type {
    CreateLatexDocumentInput,
    CreateLatexFileInput,
    LatexDocumentRefInput,
    LatexFileRefInput,
    ListLatexDocumentsInput,
    ManageLatexAssetsInput,
    MoveLatexDocumentInput,
    UpdateLatexDocumentInput,
    UpdateLatexFileInput
} from '@volt/contracts/modules/latex/ai-tools';

@AIToolProvider()
export default class LatexAIToolController extends AIToolController {
    #documents = new LatexDocumentService();
    #files = new LatexFileService();
    #downloads = new LatexDownloadService();
    #assets = new LatexAssetService();

    @AITool({
        name: 'create_latex_document',
        description: 'Create a new LaTeX document.',
        parameters: typia.llm.parameters<CreateLatexDocumentInput>(),
        validate: typia.createValidate<CreateLatexDocumentInput>()
    })
    async createLatexDocument(input: CreateLatexDocumentInput & AIToolScope) {
        return this.#documents.createDocument(input);
    }

    @AITool({
        name: 'list_latex_documents',
        description: 'List LaTeX documents in the team.',
        parameters: typia.llm.parameters<ListLatexDocumentsInput>(),
        validate: typia.createValidate<ListLatexDocumentsInput>()
    })
    async listLatexDocuments(input: ListLatexDocumentsInput & AIToolScope) {
        // typia validates but does not transform, so the documented defaults are
        // applied here; an absent key does not override them on spread.
        const { total, data } = await this.#documents.listDocuments({
            page: 1,
            limit: 50,
            ...input
        });
        return {
            summary: `Found ${total} LaTeX documents.`,
            data
        };
    }

    @AITool({
        name: 'get_latex_document',
        description: 'Get detailed information about a specific LaTeX document.',
        parameters: typia.llm.parameters<LatexDocumentRefInput>(),
        validate: typia.createValidate<LatexDocumentRefInput>()
    })
    async getLatexDocument(input: LatexDocumentRefInput & AIToolScope) {
        const document = await this.#documents.getDocument(input);
        return {
            summary: `Retrieved LaTeX document "${document.title}".`,
            data: document
        };
    }

    @AITool({
        name: 'update_latex_document',
        description: 'Update a LaTeX document.',
        parameters: typia.llm.parameters<UpdateLatexDocumentInput>(),
        validate: typia.createValidate<UpdateLatexDocumentInput>()
    })
    async updateLatexDocument(input: UpdateLatexDocumentInput & AIToolScope) {
        return this.#documents.updateDocument(input);
    }

    @AITool({
        name: 'move_latex_document',
        description: 'Move a LaTeX document to a different folder.',
        parameters: typia.llm.parameters<MoveLatexDocumentInput>(),
        validate: typia.createValidate<MoveLatexDocumentInput>()
    })
    async moveLatexDocument(input: MoveLatexDocumentInput & AIToolScope) {
        return this.#documents.moveDocument(input);
    }

    @AITool({
        name: 'delete_latex_document',
        description: 'Delete a LaTeX document.',
        parameters: typia.llm.parameters<LatexDocumentRefInput>(),
        validate: typia.createValidate<LatexDocumentRefInput>()
    })
    async deleteLatexDocument(input: LatexDocumentRefInput & AIToolScope) {
        return this.#documents.deleteDocument(input);
    }

    @AITool({
        name: 'compile_latex_document',
        description: 'Compile a LaTeX document into a PDF.',
        parameters: typia.llm.parameters<LatexDocumentRefInput>(),
        validate: typia.createValidate<LatexDocumentRefInput>()
    })
    async compileLatexDocument(input: LatexDocumentRefInput & AIToolScope) {
        return this.#downloads.compileDocument(input);
    }

    @AITool({
        name: 'create_latex_file',
        description: 'Create a new source file inside a LaTeX document.',
        parameters: typia.llm.parameters<CreateLatexFileInput>(),
        validate: typia.createValidate<CreateLatexFileInput>()
    })
    async createLatexFile(input: CreateLatexFileInput & AIToolScope) {
        return this.#files.createFile(input);
    }

    @AITool({
        name: 'list_latex_files',
        description: 'List the source files inside a LaTeX document.',
        parameters: typia.llm.parameters<LatexDocumentRefInput>(),
        validate: typia.createValidate<LatexDocumentRefInput>()
    })
    async listLatexFiles(input: LatexDocumentRefInput & AIToolScope) {
        const files = await this.#files.listFiles(input);
        return {
            summary: `Found ${files.length} LaTeX files.`,
            data: files
        };
    }

    @AITool({
        name: 'get_latex_file_content',
        description: 'Read the full source content of a single file (e.g. a .tex file) inside a LaTeX document.',
        parameters: typia.llm.parameters<LatexFileRefInput>(),
        validate: typia.createValidate<LatexFileRefInput>()
    })
    async getLatexFileContent(input: LatexFileRefInput & AIToolScope) {
        const files = await this.#files.listFiles(input);
        const file = files.find((candidate) => candidate._id === input.fileId);
        if (!file) {
            throw new Error(`LaTeX file ${input.fileId} was not found in document ${input.documentId}.`);
        }
        return {
            summary: `Read ${file.content.length} characters from LaTeX file "${file.path}${file.name}".`,
            data: file
        };
    }

    @AITool({
        name: 'update_latex_file',
        description: 'Update a source file inside a LaTeX document.',
        parameters: typia.llm.parameters<UpdateLatexFileInput>(),
        validate: typia.createValidate<UpdateLatexFileInput>()
    })
    async updateLatexFile(input: UpdateLatexFileInput & AIToolScope): Promise<LatexFile> {
        return this.#files.updateFile({
            ...input,
            source: 'ai'
        });
    }

    @AITool({
        name: 'delete_latex_file',
        description: 'Delete a source file from a LaTeX document.',
        parameters: typia.llm.parameters<LatexFileRefInput>(),
        validate: typia.createValidate<LatexFileRefInput>()
    })
    async deleteLatexFile(input: LatexFileRefInput & AIToolScope) {
        return this.#files.deleteFile(input);
    }

    @AITool({
        name: 'set_latex_file_entrypoint',
        description: 'Set a source file as the compilation entrypoint of a LaTeX document.',
        parameters: typia.llm.parameters<LatexFileRefInput>(),
        validate: typia.createValidate<LatexFileRefInput>()
    })
    async setLatexFileEntrypoint(input: LatexFileRefInput & AIToolScope) {
        return this.#files.setFileEntrypoint(input);
    }

    @AITool({
        name: 'manage_latex_assets',
        description: "List the binary assets attached to a LaTeX document, or export the whole document as a downloadable file ('tex' for the entrypoint .tex, 'zip' for the full project including assets).",
        parameters: typia.llm.parameters<ManageLatexAssetsInput>(),
        validate: typia.createValidate<ManageLatexAssetsInput>()
    })
    async manageLatexAssets(input: ManageLatexAssetsInput & AIToolScope) {
        if (input.action === 'list') {
            const assets = await this.#assets.listAssets(input);
            return {
                summary: `Found ${assets.length} LaTeX assets.`,
                data: assets
            };
        }

        const format = input.format ?? 'zip';
        const { prepare, headers } = format === 'tex'
            ? await this.#downloads.exportDocumentTex(input)
            : await this.#downloads.exportDocumentZip(input);

        if (prepare) {
            await prepare();
        }

        const disposition = headers['Content-Disposition'] ?? '';
        const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `document.${format}`;

        return {
            summary: `Exported LaTeX document as "${filename}" (${format}).`,
            data: {
                format,
                filename,
                contentType: headers['Content-Type'],
                headers
            }
        };
    }
}
