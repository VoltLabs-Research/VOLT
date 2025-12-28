// A subject is any type of entity that attempts to interact with the system.
export interface IAccessControlSubject{
    id: String;
    type: 'user';
};

// A strategy defines how to seek permissions for a given subject.
export interface IPermissionStrategy{
    /**
     * Given a subject and a context (Team ID),
     * returns the list of allowed permission strings.
     * Example: ["trajectory:read", "analysis:create"]
     */
    getPermissions(subject: IAccessControlSubject, teamId: string): Promise<string[]>;
};