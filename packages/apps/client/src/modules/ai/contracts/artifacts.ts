export interface AITableArtifact {
    id: string;
    messageId: string;
    title: string;
    summary?: string;
    columns: string[];
    rows: Record<string, unknown>[];
}
