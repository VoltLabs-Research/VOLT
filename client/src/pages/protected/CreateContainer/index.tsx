import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FormField from '@/components/molecules/form/FormField';
import {
    ArrowLeft,
    Box,
    Cpu,
    HardDrive,
    Server,
    Plus,
    Trash2,
    Check,
    X
} from 'lucide-react';
import useToast from '@/hooks/ui/use-toast';
import Slider from '@/components/atoms/form/Slider';
import Input from '@/components/atoms/form/Input';
import Button from '@/components/primitives/Button';
import Select from '@/components/atoms/form/Select';
import systemApi from '@/services/api/system/system';
import teamApi from '@/services/api/team/team';
import containerApi from '@/services/api/container/container';
import Title from '@/components/primitives/Title';
import Paragraph from '@/components/primitives/Paragraph';
import './CreateContainer.css';

interface Template {
    id: string;
    name: string;
    image: string;
    logo: string;
    description: string;
    category: 'runtime' | 'database' | 'system';
    defaultPort?: number;
    defaultEnv?: { key: string; value: string }[];
    defaultCmd?: string[];
    useImageCmd?: boolean;
}

const TEMPLATES: Template[] = [
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
        id: 'ubuntu',
        name: 'Ubuntu',
        image: 'ubuntu:latest',
        logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/ubuntu/ubuntu-plain.svg',
        description: 'The modern, open source operating system on Linux.',
        category: 'system',
        defaultEnv: [
            { key: 'DEBIAN_FRONTEND', value: 'noninteractive' }
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

const CreateContainer: React.FC = () => {
    const navigate = useNavigate();
    const { showSuccess, showError } = useToast();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1);

    const [systemStats, setSystemStats] = useState<{
        cpu: { cores: number };
        memory: { total: number; free: number };
    } | null>(null);

    const [teams, setTeams] = useState<{ _id: string; name: string }[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [customImage, setCustomImage] = useState('');
    const [showCustomImageModal, setShowCustomImageModal] = useState(false);
    const [tempCustomImage, setTempCustomImage] = useState('');

    const [config, setConfig] = useState({
        name: '',
        memory: 512,
        cpus: 1,
        ports: [] as { private: number; public: number }[],
        env: [] as { key: string; value: string }[],
        mountDockerSocket: false
    });

    useEffect(() => {
        const fetchSystemStats = async() => {
            try{
                const stats = await systemApi.getStats();
                setSystemStats(stats);
            }catch(error){
                console.error('Failed to fetch system stats:', error);
            }
        };

        const fetchTeams = async() => {
            try{
                const teamsList = await teamApi.getAll();
                setTeams(teamsList);
                if(teamsList.length > 0){
                    setSelectedTeamId(teamsList[0]._id);
                }
            }catch(error){
                console.error('Failed to fetch teams:', error);
            }
        };

        fetchSystemStats();
        fetchTeams();
    }, []);

    const handleTemplateSelect = (templateId: string) => {
        const template = TEMPLATES.find(t => t.id === templateId);
        if(template){
            setSelectedTemplate(templateId);
            setCustomImage('');
            setConfig(prev => ({
                ...prev,
                name: `${template.id}-${Math.floor(Math.random() * 1000)}`,
                ports: template.defaultPort ? [{ private: template.defaultPort, public: 0 }] : [],
                env: template.defaultEnv ? [...template.defaultEnv] : [],
                mountDockerSocket: template.id === 'coder'
            }));
            setStep(2);
        }
    };

    const handleCustomImageClick = () => {
        setTempCustomImage(customImage);
        setShowCustomImageModal(true);
    };

    const confirmCustomImage = () => {
        if(!tempCustomImage.trim()) {
            showError('Please enter a valid image name');
            return;
        }
        setCustomImage(tempCustomImage);
        setSelectedTemplate(null);
        setShowCustomImageModal(false);
        setStep(2);
    };

    const handleCreate = async() => {
        setLoading(true);
        try{
            const image = selectedTemplate
                ? TEMPLATES.find(t => t.id === selectedTemplate)?.image
                : customImage;

            if(!image){
                showError('Please select a template or specify an image');
                return;
            }

            if(!config.name){
                showError('Please give your container a name');
                return;
            }

            if(!selectedTeamId){
                showError('Please select a team for this container');
                return;
            }

            const template = selectedTemplate ? TEMPLATES.find(t => t.id === selectedTemplate) : null;

            const payload: any = {
                name: config.name,
                image,
                teamId: selectedTeamId,
                memory: config.memory,
                cpus: config.cpus,
                ports: config.ports.filter(p => p.private > 0),
                env: config.env.filter(e => e.key && e.value),
                mountDockerSocket: config.mountDockerSocket,
                useImageCmd: template?.useImageCmd
            };

            // Add custom command if template specifies one
            if(template?.defaultCmd){
                payload.cmd = template.defaultCmd;
            }

            await containerApi.create(payload);
            showSuccess('Container created successfully');
            navigate('/dashboard/containers');
        }catch(error: any){
            showError(error.response?.data?.message || 'Failed to create container');
        }finally{
            setLoading(false);
        }
    };

    const addPort = () => {
        setConfig(prev => ({
            ...prev,
            ports: [...prev.ports, { private: 80, public: 0 }]
        }));
    };

    const removePort = (index: number) => {
        setConfig(prev => ({
            ...prev,
            ports: prev.ports.filter((_, i) => i !== index)
        }));
    };

    const updatePort = (index: number, field: 'private' | 'public', value: string) => {
        const numVal = parseInt(value) || 0;
        setConfig(prev => ({
            ...prev,
            ports: prev.ports.map((p, i) => i === index ? { ...p, [field]: numVal } : p)
        }));
    };

    const addEnv = () => {
        setConfig(prev => ({
            ...prev,
            env: [...prev.env, { key: '', value: '' }]
        }));
    };

    const removeEnv = (index: number) => {
        setConfig(prev => ({
            ...prev,
            env: prev.env.filter((_, i) => i !== index)
        }));
    };

    const updateEnv = (index: number, field: 'key' | 'value', value: string) => {
        setConfig(prev => ({
            ...prev,
            env: prev.env.map((e, i) => i === index ? { ...e, [field]: value } : e)
        }));
    };

    const maxMemory = systemStats?.memory?.total ? Math.floor(systemStats.memory.total * 1024) : 4096;
    const maxCpus = systemStats?.cpu?.cores ?? 4;

    return (
        <div className="d-flex column create-container-page h-max overflow-hidden">
            <div className="d-flex items-center gap-1-5 create-header f-shrink-0">
                <Button
                    variant='ghost'
                    intent='neutral'
                    iconOnly
                    onClick={() => navigate('/dashboard/containers')}
                >
                    <ArrowLeft size={20} />
                </Button>
                <div className="header-text d-flex column gap-02">
                    <Title className="font-size-5 font-weight-6">Create New Container</Title>
                    <Paragraph className="color-muted">Deploy a new containerized application in seconds.</Paragraph>
                </div>
            </div>

            <div className="d-flex create-layout overflow-hidden flex-1">
                <div className="d-flex column gap-05 steps-sidebar">
                    <div className={`d-flex items-center gap-1 step-item ${step >= 1 ? 'active' : ''} cursor-pointer`} onClick={() => setStep(1)}>
                        <div className="d-flex flex-center step-number font-weight-6 color-muted-foreground">1</div>
                        <div className="d-flex column gap-025 step-label">
                            <span>Image</span>
                            <small>Select template</small>
                        </div>
                    </div>
                    <div className={`step-line ${step >= 2 ? 'active' : ''}`}></div>
                    <div className={`d-flex items-center gap-1 step-item ${step >= 2 ? 'active' : ''} cursor-pointer`} onClick={() => (selectedTemplate || customImage) && setStep(2)}>
                        <div className="d-flex flex-center step-number font-weight-6 color-muted-foreground">2</div>
                        <div className="d-flex column gap-025 step-label">
                            <span>Configuration</span>
                            <small>Resources & Network</small>
                        </div>
                    </div>
                    <div className={`step-line ${step >= 3 ? 'active' : ''}`}></div>
                    <div className={`d-flex items-center gap-1 step-item ${step >= 3 ? 'active' : ''} cursor-pointer`} onClick={() => (selectedTemplate || customImage) && setStep(3)}>
                        <div className="d-flex flex-center step-number font-weight-6 color-muted-foreground">3</div>
                        <div className="d-flex column gap-025 step-label">
                            <span>Review</span>
                            <small>Deploy container</small>
                        </div>
                    </div>
                </div>

                <div className="step-content y-auto flex-1">
                    {step === 1 && (
                        <div className="fade-in d-flex column gap-2">
                            <Title className="font-size-5 font-weight-6">Select a Template</Title>
                            <div className="templates-grid gap-1-5">
                                {TEMPLATES.map(template => (
                                    <div
                                        key={template.id}
                                        className={`d-flex column items-center gap-1 template-card ${selectedTemplate === template.id ? 'selected' : ''} p-relative text-center cursor-pointer`}
                                        onClick={() => handleTemplateSelect(template.id)}
                                    >
                                        <div className="d-flex flex-center template-icon f-shrink-0">
                                            <img src={template.logo} alt={template.name} className="template-logo" />
                                        </div>
                                        <div className="template-info d-flex column gap-05">
                                            <Title className="font-size-3 font-weight-6">{template.name}</Title>
                                            <Paragraph className="color-muted font-size-2">{template.description}</Paragraph>
                                        </div>
                                        {selectedTemplate === template.id && (
                                            <div className="d-flex flex-center selected-check p-absolute">
                                                <Check size={16} />
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <div
                                    className={`d-flex column items-center gap-1 template-card custom ${!selectedTemplate && customImage ? 'selected' : ''} p-relative text-center cursor-pointer`}
                                    onClick={handleCustomImageClick}
                                >
                                    <div className="template-icon d-flex flex-center f-shrink-0">
                                        <Server size={32} color="#666" />
                                    </div>
                                    <div className="template-info d-flex column gap-05">
                                        <Title className="font-size-3 font-weight-6">Custom Image</Title>
                                        <Paragraph className="color-muted font-size-2">Pull any image from Docker Hub.</Paragraph>
                                    </div>
                                    {!selectedTemplate && customImage && (
                                        <div className="d-flex flex-center selected-check p-absolute">
                                            <Check size={16} />
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    )}

                    {step === 2 && (
                        <div className="fade-in">
                            <Title className="font-size-5 font-weight-6">Configure Container</Title>

                            <div className="config-grid">
                                {/* Basic Info */}
                                <div className="config-section">
                                    <div className="config-section-header">
                                        <h3>Basic Information</h3>
                                    </div>
                                    <div className="field">
                                        <label>Container Name</label>
                                        <Input
                                            type="text"
                                            placeholder="my-container-app"
                                            value={config.name}
                                            onChange={(val) => setConfig(prev => ({ ...prev, name: val as string }))}
                                            className="field-input w-max"
                                        />
                                    </div>
                                </div>

                                {/* Team Selection */}
                                <div className="config-section select">
                                    <div className="config-section-header">
                                        <h3>Team</h3>
                                    </div>
                                    <div className="field d-flex items-center content-between">
                                        <label>Assign to Team</label>
                                        <Select
                                            options={teams.map(team => ({
                                                value: team._id,
                                                title: team.name
                                            }))}
                                            style={{ width: '200px' }}
                                            value={selectedTeamId}
                                            onChange={(val) => setSelectedTeamId(val)}
                                            placeholder="Select a team"
                                            className="w-max"
                                        />
                                    </div>
                                </div>

                                {/* Resources */}
                                <div className="config-section full-width">
                                    <div className="config-section-header">
                                        <h3>Resources</h3>
                                    </div>
                                    <div className="resource-row">
                                        <div className="resource-header">
                                            <span className="resource-label"><Cpu size={16} /> CPU Cores</span>
                                            <span className="resource-value">{config.cpus} vCPU</span>
                                        </div>
                                        <Slider
                                            min={0.5}
                                            max={maxCpus}
                                            step={0.5}
                                            value={config.cpus}
                                            onChange={(val) => setConfig(prev => ({ ...prev, cpus: val }))}
                                        />
                                        <div className="resource-limits">
                                            <span>0.5 vCPU</span>
                                            <span>{maxCpus} vCPU(Max)</span>
                                        </div>
                                    </div>
                                    <div className="resource-row">
                                        <div className="resource-header">
                                            <span className="resource-label"><HardDrive size={16} /> Memory</span>
                                            <span className="resource-value">{config.memory} MB</span>
                                        </div>
                                        <Slider
                                            min={128}
                                            max={maxMemory}
                                            step={128}
                                            value={config.memory}
                                            onChange={(val) => setConfig(prev => ({ ...prev, memory: val }))}
                                        />
                                        <div className="resource-limits">
                                            <span>128 MB</span>
                                            <span>{maxMemory} MB(Max)</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Port Mapping */}
                                <div className="config-section">
                                    <div className="d-flex content-between items-center config-section-header">
                                        <h3>Port Mapping</h3>
                                        <Button variant='ghost' intent='neutral' size='sm' leftIcon={<Plus size={14} />} onClick={addPort}>Add</Button>
                                    </div>
                                    {config.ports.length > 0 ? (
                                        config.ports.map((port, i) => (
                                            <div key={i} className="mapping-row">
                                                <div className="mapping-input">
                                                    <label>Private</label>
                                                    <Input
                                                        type="number"
                                                        value={port.private}
                                                        onChange={(val) => updatePort(i, 'private', val as string)}
                                                        className="field-input"
                                                    />
                                                </div>
                                                <div className="mapping-input">
                                                    <label>Public</label>
                                                    <Input
                                                        type="number"
                                                        placeholder="Auto"
                                                        value={port.public || ''}
                                                        onChange={(val) => updatePort(i, 'public', val as string)}
                                                        className="field-input"
                                                    />
                                                </div>
                                                <Button variant='ghost' intent='danger' iconOnly size='sm' onClick={() => removePort(i)}>
                                                    <Trash2 size={16} />
                                                </Button>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="empty-state">No ports exposed</div>
                                    )}
                                </div>

                                {/* Environment Variables */}
                                <div className="config-section">
                                    <div className="d-flex content-between items-center config-section-header">
                                        <h3>Environment Variables</h3>
                                        <Button variant='ghost' intent='neutral' size='sm' leftIcon={<Plus size={14} />} onClick={addEnv}>Add</Button>
                                    </div>
                                    {config.env.length > 0 ? (
                                        config.env.map((env, i) => (
                                            <div key={i} className="mapping-row">
                                                <div className="mapping-input">
                                                    <label>Key</label>
                                                    <Input
                                                        type="text"
                                                        placeholder="KEY"
                                                        value={env.key}
                                                        onChange={(val) => updateEnv(i, 'key', val as string)}
                                                        className="field-input"
                                                    />
                                                </div>
                                                <div className="mapping-input">
                                                    <label>Value</label>
                                                    <Input
                                                        type="text"
                                                        placeholder="VALUE"
                                                        value={env.value}
                                                        onChange={(val) => updateEnv(i, 'value', val as string)}
                                                        className="field-input"
                                                    />
                                                </div>
                                                <Button variant='ghost' intent='danger' iconOnly size='sm' onClick={() => removeEnv(i)}>
                                                    <Trash2 size={16} />
                                                </Button>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="empty-state">No environment variables</div>
                                    )}
                                </div>

                                <div className="config-card d-flex column gap-05">
                                    <FormField
                                        label="Enable Docker Access"
                                        fieldKey="mountDockerSocket"
                                        fieldType="checkbox"
                                        fieldValue={config.mountDockerSocket}
                                        onFieldChange={(_, next) => setConfig(prev => ({ ...prev, mountDockerSocket: next }))}
                                    />
                                    <div className="font-size-2 color-muted">Mounts /var/run/docker.sock to allow container management</div>
                                </div>

                            </div>

                            <div className="d-flex content-end gap-1 step-actions">
                                <Button variant='outline' intent='neutral' onClick={() => setStep(1)}>Back</Button>
                                <Button variant='solid' intent='brand' onClick={() => setStep(3)}>Next: Review</Button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="fade-in review-step">
                            <Title className="font-size-5 font-weight-6">Review & Deploy</Title>
                            <div className="review-card">
                                <div className="review-item">
                                    <span className="label">Name</span>
                                    <span className="value">{config.name}</span>
                                </div>
                                <div className="d-flex content-between review-item">
                                    <span className="label">Team</span>
                                    <span className="value">{teams.find(t => t._id === selectedTeamId)?.name || 'None'}</span>
                                </div>
                                <div className="d-flex content-between review-item">
                                    <span className="label">Image</span>
                                    <span className="value monospace">{selectedTemplate ? TEMPLATES.find(t => t.id === selectedTemplate)?.image : customImage}</span>
                                </div>
                                <div className="d-flex content-between review-item">
                                    <span className="label">CPU</span>
                                    <span className="value">{config.cpus} vCPU</span>
                                </div>
                                <div className="d-flex content-between review-item">
                                    <span className="label">Memory</span>
                                    <span className="value">{config.memory} MB</span>
                                </div>
                                <div className="d-flex content-between review-item">
                                    <span className="label">Ports</span>
                                    <span className="value">{config.ports.length > 0 ? config.ports.map(p => `${p.private}:${p.public || 'Auto'}`).join(', ') : 'None'}</span>
                                </div>
                            </div>
                            <div className="d-flex content-end gap-1 step-actions mt-3">
                                <Button variant='outline' intent='neutral' onClick={() => setStep(2)}>Back</Button>
                                <Button variant='solid' intent='brand' onClick={handleCreate} isLoading={loading} leftIcon={!loading ? <Box size={18} /> : undefined}>
                                    {!loading && "Deploy Container"}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {
                showCustomImageModal && (
                    <div className="modal-overlay p-fixed d-flex items-center content-center">
                        <div className="modal-content custom-image-modal">
                            <div className="modal-header">
                                <Title className="font-size-4 font-weight-6">Custom Docker Image</Title>
                                <Button variant='ghost' intent='neutral' iconOnly onClick={() => setShowCustomImageModal(false)}>
                                    <X size={24} />
                                </Button>
                            </div>
                            <div className="modal-body y-auto">
                                <Paragraph className="color-muted">Enter the name of the Docker image you want to pull from Docker Hub.</Paragraph>
                                <Input
                                    type="text"
                                    placeholder="e.g., nginx:latest, mysql:8.0"
                                    value={tempCustomImage}
                                    onChange={(val) => setTempCustomImage(val as string)}
                                    className="full-width-input w-max"
                                    autoFocus
                                />
                            </div>
                            <div className="modal-actions">
                                <Button variant='outline' intent='neutral' onClick={() => setShowCustomImageModal(false)}>Cancel</Button>
                                <Button variant='solid' intent='brand' onClick={confirmCustomImage}>Confirm</Button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default CreateContainer;
