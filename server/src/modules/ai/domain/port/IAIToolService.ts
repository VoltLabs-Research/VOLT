import type { ToolSet } from 'ai';

export interface IAIToolService {
    createToolsForContext(teamId: string, userId: string): ToolSet;
}
