export type OAuthProviderKey = 'github' | 'google' | 'microsoft';

export interface GetAvailableOAuthProvidersOutputDTO {
    providers: OAuthProviderKey[];
}
