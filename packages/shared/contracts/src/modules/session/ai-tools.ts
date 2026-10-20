export interface ManageSessionsInput{
    action: 'list' | 'revoke' | 'revoke_others';
    sessionId?: string;
}
