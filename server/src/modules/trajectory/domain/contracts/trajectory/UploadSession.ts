// Plain, persistence-agnostic vocabulary for the trajectory upload-session
// flow. These were defined inside the Mongoose model/repository
// (infrastructure), which forced the domain port
// `ITrajectoryUploadSessionRepository` to import from infrastructure and
// leaked a Mongoose `*Document` into the domain — both inversions of the
// dependency rule.
//
// NOTE: there is no `TrajectoryUploadSession` domain entity yet; the repository
// still hydrates a Mongoose document. A real entity (with its own mapper, like
// `Trajectory`) would be the proper home for this shape — see the module notes.
// To avoid inventing one, the port now speaks in terms of this plain data type.

// Persistence id surfaced to the domain without binding to the ODM's concrete
// `ObjectId`. Callers only ever stringify it; a hydrated Mongoose `ObjectId`
// and a plain `string` both satisfy this shape, so the repository keeps
// type-checking with no mapping change.
export type PersistenceId = { toString(): string };

export type TrajectoryUploadSessionStatus = 'pending' | 'committed' | 'cancelled' | 'failed';

export interface TrajectoryUploadSessionPartProps {
    partNumber: number;
    objectKey: string;
    offset: number;
    size: number;
}

export interface TrajectoryUploadSessionFileProps {
    index: number;
    originalName: string;
    contentType?: string;
    size: number;
    finalObjectKey: string;
    parts: TrajectoryUploadSessionPartProps[];
}

// Plain projection of a persisted upload session. Mirrors the document shape
// the repository returns, but stays free of Mongoose.
export interface TrajectoryUploadSession {
    id: string;
    team: PersistenceId;
    user: PersistenceId;
    ownerClusterId: PersistenceId;
    bucket: string;
    resourceKind: string;
    resourceId: PersistenceId;
    status: TrajectoryUploadSessionStatus;
    files: TrajectoryUploadSessionFileProps[];
    expiresAt: Date;
    committedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateTrajectoryUploadSessionInput {
    team: string;
    user: string;
    ownerClusterId: string;
    bucket: string;
    resourceKind: string;
    resourceId: string;
    files: TrajectoryUploadSessionFileProps[];
    expiresAt: Date;
}
