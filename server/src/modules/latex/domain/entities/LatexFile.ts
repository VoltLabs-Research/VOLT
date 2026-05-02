export interface LatexFileProps {
    document: string;
    team: string;
    /** Filename, e.g. `main.tex` or `introduction.tex`. */
    name: string;
    /**
     * Directory prefix within the project tree (e.g. `""` for root,
     * `"chapters/"` for a subdirectory). Must end with `/` when non-empty.
     */
    path: string;
    content: string;
    /**
     * Exactly one file per document must have this flag set to `true`.
     * The entrypoint is the file passed to the LaTeX compiler.
     */
    isEntrypoint: boolean;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

export default class LatexFile {
    constructor(
        public readonly _id: string,
        public props: LatexFileProps
    ) {}

    get id(): string {
        return this._id;
    }

    /** Full relative path within the project, e.g. `"chapters/intro.tex"`. */
    get fullPath(): string {
        return this.props.path ? `${this.props.path}${this.props.name}` : this.props.name;
    }
}
