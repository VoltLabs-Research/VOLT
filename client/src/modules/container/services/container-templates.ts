import { ContainerTemplateCustomFieldType } from '../api/entities/container-template';
import type { ContainerTemplate, ContainerTemplateCustomField } from '../api/entities/container-template';

const UBUNTU_REMOTE_DESKTOP_LOGO = 'https://assets.ubuntu.com/v1/29985a98-ubuntu-logo32.png';

const UBUNTU_REMOTE_DESKTOP_CUSTOM_FIELDS: ContainerTemplateCustomField[] = [
    {
        id: 'containerUsername',
        label: 'Linux username',
        description: 'Creates this Linux user inside the container. noVNC still opens with the shared password only.',
        placeholder: 'e.g. ubuntu, analyst, devuser',
        required: true,
        pattern: '^[a-z_][a-z0-9_-]{0,31}$',
        patternError: 'Use 1-32 lowercase letters, numbers, underscores, or hyphens, and start with a letter or underscore.',
        type: ContainerTemplateCustomFieldType.Text,
        env: {
            key: 'CONTAINER_USERNAME'
        }
    },
    {
        id: 'vncPassword',
        label: 'Shared Linux + VNC password',
        description: 'This same password is used for the Linux user created in the container and for VNC remote desktop access.',
        placeholder: 'Enter one shared password',
        required: true,
        type: ContainerTemplateCustomFieldType.Password,
        env: {
            key: 'VNC_PW'
        }
    }
];

export const CONTAINER_TEMPLATES: ContainerTemplate[] = [
    {
        id: 'ubuntu-vnc',
        name: 'Ubuntu Remote Desktop',
        image: 'ghcr.io/voltlabs-research/volt-ubuntu-remote-desktop:main',
        logo: UBUNTU_REMOTE_DESKTOP_LOGO,
        description: 'Ubuntu XFCE desktop with VNC on port 5901. Create a Linux username and one shared password for the container user and VNC access.',
        category: 'runtime',
        defaultPort: 5901,
        useImageCmd: true,
        customFields: UBUNTU_REMOTE_DESKTOP_CUSTOM_FIELDS,
        capabilities: {
            vnc: true
        }
    },
    {
        id: 'ubuntu-vnc-full',
        name: 'Ubuntu Remote Desktop Full',
        image: 'ghcr.io/voltlabs-research/volt-ubuntu-remote-desktop-full:main',
        logo: UBUNTU_REMOTE_DESKTOP_LOGO,
        description: 'Ubuntu XFCE desktop with VNC on port 5901 plus Google Chrome, desktop utilities, fonts, a file manager, and a lightweight editor preinstalled.',
        category: 'runtime',
        defaultPort: 5901,
        useImageCmd: true,
        customFields: UBUNTU_REMOTE_DESKTOP_CUSTOM_FIELDS,
        capabilities: {
            vnc: true
        }
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
    },
    {
        id: 'lammps',
        name: 'LAMMPS',
        image: 'lammps/lammps:stable_29Sep2021_ubuntu20.04_openmpi_py3',
        logo: 'https://avatars.githubusercontent.com/u/5199009?s=200&v=4',
        description: 'Classical molecular dynamics simulation software.',
        category: 'runtime',
        defaultEnv: [
            { key: 'OMP_NUM_THREADS', value: '1' }
        ]
    },
    {
        id: 'node',
        name: 'Node.js',
        image: 'node:18-alpine',
        logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg',
        description: 'JavaScript runtime built on Chrome\'s V8 engine.',
        category: 'runtime',
        defaultPort: 3000,
        defaultEnv: [
            { key: 'NODE_ENV', value: 'production' }
        ]
    },
    {
        id: 'python',
        name: 'Python',
        image: 'python:3.11-slim',
        logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg',
        description: 'High-level programming language for general-purpose programming.',
        category: 'runtime',
        defaultPort: 8000,
        defaultEnv: [
            { key: 'PYTHONUNBUFFERED', value: '1' }
        ]
    },
    {
        id: 'mongo',
        name: 'MongoDB',
        image: 'mongo:latest',
        logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-original.svg',
        description: 'The most popular database for modern apps.',
        category: 'database',
        defaultPort: 27017,
        defaultEnv: [
            { key: 'MONGO_INITDB_ROOT_USERNAME', value: 'admin' },
            { key: 'MONGO_INITDB_ROOT_PASSWORD', value: 'changeme' }
        ]
    },
    {
        id: 'redis',
        name: 'Redis',
        image: 'redis:alpine',
        logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/redis/redis-original.svg',
        description: 'In-memory data structure store, used as a database, cache and broker.',
        category: 'database',
        defaultPort: 6379,
        defaultEnv: [
            { key: 'REDIS_PASSWORD', value: 'changeme' }
        ]
    },
    {
        id: 'alpine',
        name: 'Alpine',
        image: 'alpine:latest',
        logo: 'https://hub.docker.com/api/media/repos_logo/v1/library%2Falpine?type=logo',
        description: 'A security-oriented, lightweight Linux distribution.',
        category: 'system'
    }
];
