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
