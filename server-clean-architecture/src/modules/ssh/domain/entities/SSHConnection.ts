import { encrypt, decrypt } from '@/src/shared/infrastructure/utilities/crypto';

export interface SSHConnectionProps{
    name: string;
    team: string;
    host: string;
    port: number;
    username: string;
    encryptedPassword: string;
    user: string;
};

export default class SSHConnection{
    constructor(
        public id: string,
        public props: SSHConnectionProps
    ){}
    
    public static create(
        id: string,
        input: {
            name: string;
            host: string;
            port: number;
            username: string;
            password: string;
            teamId: string;
            userId: string;
        }
    ): SSHConnection{
        const instance = new SSHConnection(id, {
            name: input.name,
            host: input.host,
            port: input.port,
            username: input.username,
            team: input.teamId,
            user: input.userId,
            encryptedPassword: ''
        });

        instance.setPassword(input.password);
        return instance;
    }

    public setPassword(password: string): void{
        if(!password){
            throw new Error('Password cannot be empty');
        }
        this.props.encryptedPassword = encrypt(password);
    }

    public getPassword(): string{
        if(!this.props.encryptedPassword) return '';
        return decrypt(this.props.encryptedPassword);
    }
};