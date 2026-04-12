import type { ContainerTemplate } from '../api/entities/container-template';

const UBUNTU_LOGO = 'https://assets.ubuntu.com/v1/29985a98-ubuntu-logo32.png';

export const CONTAINER_TEMPLATES: ContainerTemplate[] = [
    {
        id: 'alpine',
        name: 'Alpine',
        image: 'alpine:latest',
        logo: 'https://hub.docker.com/api/media/repos_logo/v1/library%2Falpine?type=logo',
        description: 'A security-oriented, lightweight Linux distribution.',
        category: 'system'
    },
    {
        id: 'ubuntu',
        name: 'Ubuntu',
        image: 'ubuntu:latest',
        logo: UBUNTU_LOGO,
        description: 'General-purpose Ubuntu base image for shell access and custom workloads.',
        category: 'system',
        defaultCmd: ['tail', '-f', '/dev/null']
    },
    {
        id: 'code-server',
        name: 'Code Server',
        image: 'codercom/code-server:latest',
        logo: 'https://raw.githubusercontent.com/coder/code-server/main/src/browser/media/favicon.svg',
        description: 'VS Code in the browser. Code anywhere on any device.',
        category: 'runtime',
        defaultPort: 8080,
        defaultEnv: [
            { key: 'PASSWORD', value: 'changeme' }
        ],
        defaultCmd: ['code-server', '--bind-addr', '0.0.0.0:8080', '--user-data-dir', '/home/coder', '/home/coder']
    },
    {
        id: 'n8n',
        name: 'n8n',
        image: 'docker.n8n.io/n8nio/n8n:latest',
        logo: 'https://n8n.io/favicon.ico',
        description: 'Workflow automation platform with a browser-based editor.',
        category: 'runtime',
        defaultPort: 5678,
        defaultEnv: [
            { key: 'N8N_HOST', value: '0.0.0.0' },
            { key: 'N8N_PORT', value: '5678' },
            { key: 'N8N_PROTOCOL', value: 'http' }
        ],
        useImageCmd: true
    },
    {
        id: 'coder',
        name: 'Coder',
        image: 'ghcr.io/coder/coder:latest',
        logo: 'https://avatars.githubusercontent.com/u/95932066?s=200&v=4',
        description: 'Self-hosted remote development platform for teams.',
        category: 'runtime',
        defaultPort: 7080,
        defaultEnv: [
            { key: 'CODER_ACCESS_URL', value: 'http://localhost:7080' },
            { key: 'CODER_HTTP_ADDRESS', value: '0.0.0.0:7080' }
        ],
        useImageCmd: true
    }
];
