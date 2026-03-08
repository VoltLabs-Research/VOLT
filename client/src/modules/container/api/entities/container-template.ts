export interface ContainerTemplate {
    id: string;
    name: string;
    image: string;
    logo: string;
    description: string;
    category?: string;
    defaultPort?: number;
    defaultEnv?: { key: string; value: string }[];
    defaultCmd?: string[];
    useImageCmd?: boolean;
};
