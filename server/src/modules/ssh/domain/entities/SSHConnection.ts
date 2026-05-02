export interface SSHConnectionProps{
    name: string;
    team: string;
    host: string;
    port: number;
    username: string;
    encryptedPassword: string;
    user: string;
}

export default class SSHConnection{
    constructor(
        public _id: string,
        public props: SSHConnectionProps
    ){}

    public static create(
        _id: string,
        input: {
            name: string;
            host: string;
            port: number;
            username: string;
            encryptedPassword: string;
            teamId: string;
            userId: string;
        }
    ): SSHConnection | null{
        if (!input.encryptedPassword || input.encryptedPassword.trim().length === 0) {
            return null;
        }

        return new SSHConnection(_id, {
            name: input.name,
            host: input.host,
            port: input.port,
            username: input.username,
            team: input.teamId,
            user: input.userId,
            encryptedPassword: input.encryptedPassword
        });
    }
}
