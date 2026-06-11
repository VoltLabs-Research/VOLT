/**
 * Cluster object-gateway signed-access domain vocabulary.
 *
 * Describes the signed-access claims and signed-URL result that the
 * `IClusterObjectSignedUrlService` domain port mints and verifies. These are
 * domain concepts (the authorization payload for object access), not HTTP
 * transport shapes, so they live in the domain layer.
 */

export type ClusterObjectOperation = 'read' | 'write';

export interface ClusterObjectAccessClaims {
    kind: 'cluster-object';
    operation: ClusterObjectOperation;
    teamId: string;
    userId: string;
    ownerClusterId: string;
    bucket: string;
    objectKey: string;
    resourceKind: string;
    resourceId: string;
    contentLength?: number;
    contentType?: string;
    metadata?: Record<string, string>;
    sessionId?: string;
    partNumber?: number;
    iat: number;
    exp: number;
}

export interface ClusterObjectSignedUrl {
    url: string;
    expiresAt: string;
}
