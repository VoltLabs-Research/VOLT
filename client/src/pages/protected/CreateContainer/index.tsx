import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Box,
    Cpu,
    HardDrive,
    Layers,
    Server,
    Terminal,
    Globe,
    Database,
    Code,
    Plus,
    Trash2,
    Check,
    AlertCircle,
    X
} from 'lucide-react';
import useToast from '@/hooks/ui/use-toast';
import Slider from '@/components/atoms/form/Slider';
import Input from '@/components/atoms/form/Input';
import Button from '@/components/primitives/Button';
import Select from '@/components/atoms/form/Select';
import systemApi from '@/services/api/system';
import teamApi from '@/services/api/team';
import containerApi from '@/services/api/container';
import Title from '@/components/primitives/Title';
import Paragraph from '@/components/primitives/Paragraph';
import './CreateContainer.css';

interface Template {
    id: string;
    name: string;
    image: string;
    icon: React.ReactNode;
    description: string;
    category: 'runtime' | 'database' | 'system';
    defaultPort?: number;
}

const TEMPLATES: Template[] = [
    {
        id: 'node',
        name: 'Node.js',
        image: 'node:18-alpine',
        icon: <Globe size={32} color="#68a063" />,
        description: 'JavaScript runtime built on Chrome\'s V8 engine.',
        category: 'runtime',
        defaultPort: 3000
    },
    {
        id: 'python',
        name: 'Python',
        image: 'python:3.11-slim',
        icon: <Code size={32} color="#3776ab" />,
        description: 'High-level programming language for general-purpose programming.',
        category: 'runtime',
        defaultPort: 8000
    },
    {
        id: 'mongo',
        name: 'MongoDB',
        image: 'mongo:latest',
        icon: <Database size={32} color="#47a248" />,
        description: 'The most popular database for modern apps.',
        category: 'database',
        defaultPort: 27017
    },
    {
        id: 'redis',
        name: 'Redis',
        image: 'redis:alpine',
        icon: <Layers size={32} color="#dc382d" />,
        description: 'In-memory data structure store, used as a database, cache and broker.',
        category: 'database',
        defaultPort: 6379
    },
    {
        id: 'ubuntu',
        name: 'Ubuntu',
        image: 'ubuntu:latest',
        icon: <Terminal size={32} color="#e95420" />,
        description: 'The modern, open source operating system on Linux.',
        category: 'system'
    },
    {
        id: 'alpine',
        name: 'Alpine',
        image: 'alpine:latest',
        icon: <Box size={32} color="#0d597f" />,
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
        env: [] as { key: string; value: string }[]
    });

    useEffect(() => {
        const fetchSystemStats = async () => {
            try {
                const stats = await systemApi.getStats();
                setSystemStats(stats);
            } catch (error) {
                console.error('Failed to fetch system stats:', error);
            }
        };

        const fetchTeams = async () => {
            try {
                const teamsList = await teamApi.getAll();
                setTeams(teamsList);
                if (teamsList.length > 0) {
                    setSelectedTeamId(teamsList[0]._id);
                }
            } catch (error) {
                console.error('Failed to fetch teams:', error);
            }
        };

        fetchSystemStats();
        fetchTeams();
    }, []);

    const handleTemplateSelect = (templateId: string) => {
        const template = TEMPLATES.find(t => t.id === templateId);
        if (template) {
            setSelectedTemplate(templateId);
            setCustomImage('');
            setConfig(prev => ({
                ...prev,
                name: `${template.id}-${Math.floor(Math.random() * 1000)}`,
                ports: template.defaultPort ? [{ private: template.defaultPort, public: 0 }] : []
            }));
            setStep(2);
        }
    };

    const handleCustomImageClick = () => {
        setTempCustomImage(customImage);
        setShowCustomImageModal(true);
    };

    const confirmCustomImage = () => {
        if (!tempCustomImage.trim()) {
            showError('Please enter a valid image name');
            return;
        }
        setCustomImage(tempCustomImage);
        setSelectedTemplate(null);
        setShowCustomImageModal(false);
        setStep(2);
    };

    const handleCreate = async () => {
        setLoading(true);
        try {
            const image = selectedTemplate
                ? TEMPLATES.find(t => t.id === selectedTemplate)?.image
                : customImage;

            if (!image) {
                showError('Please select a template or specify an image');
                return;
            }

            if (!config.name) {
                showError('Please give your container a name');
                return;
            }

            if (!selectedTeamId) {
                showError('Please select a team for this container');
                return;
            }

            const payload = {
                name: config.name,
                image,
                teamId: selectedTeamId,
                memory: config.memory,
                cpus: config.cpus,
                ports: config.ports.filter(p => p.private > 0),
                env: config.env.filter(e => e.key && e.value)
            };

            await containerApi.create(payload);
            showSuccess('Container created successfully');
            navigate('/dashboard/containers');
        } catch (error: any) {
            showError(error.response?.data?.message || 'Failed to create container');
        } finally {
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
        <div className="d-flex column create-container-page">
            <div className="d-flex items-center gap-1-5 create-header">
                <Button
                    variant='ghost'
                    intent='neutral'
                    iconOnly
                    onClick={() => navigate('/dashboard/containers')}
                >
                    <ArrowLeft size={20} />
                </Button>
                <div className="header-text">
                    <Title className="font-size-5 font-weight-6">Create New Container</Title>
                    <Paragraph className="color-muted">Deploy a new containerized application in seconds.</Paragraph>
                </div>
            </div>

            <div className="d-flex create-layout">
                <div className="d-flex column gap-05 steps-sidebar">
                    <div className={`d-flex items-center gap-1 step-item ${step >= 1 ? 'active' : ''}`} onClick={() => setStep(1)}>
                        <div className="d-flex flex-center step-number">1</div>
                        <div className="d-flex column step-label">
                            <span>Image</span>
                            <small>Select template</small>
                        </div>
                    </div>
                    <div className={`step-line ${step >= 2 ? 'active' : ''}`}></div>
                    <div className={`d-flex items-center gap-1 step-item ${step >= 2 ? 'active' : ''}`} onClick={() => (selectedTemplate || customImage) && setStep(2)}>
                        <div className="d-flex flex-center step-number">2</div>
                        <div className="d-flex column step-label">
                            <span>Configuration</span>
                            <small>Resources & Network</small>
                        </div>
                    </div>
                    <div className={`step-line ${step >= 3 ? 'active' : ''}`}></div>
                    <div className={`d-flex items-center gap-1 step-item ${step >= 3 ? 'active' : ''}`} onClick={() => (selectedTemplate || customImage) && setStep(3)}>
                        <div className="d-flex flex-center step-number">3</div>
                        <div className="d-flex column step-label">
                            <span>Review</span>
                            <small>Deploy container</small>
                        </div>
                    </div>
                </div>

                <div className="step-content">
                    {step === 1 && (
                        <div className="fade-in">
                            <Title className="font-size-5 font-weight-6">Select a Template</Title>
                            <div className="templates-grid">
                                {TEMPLATES.map(template => (
                                    <div
                                        key={template.id}
                                        className={`d-flex column items-center gap-1 template-card ${selectedTemplate === template.id ? 'selected' : ''}`}
                                        onClick={() => handleTemplateSelect(template.id)}
                                    >
                                        <div className="d-flex flex-center template-icon">
                                            {template.icon}
                                        </div>
                                        <div className="template-info">
                                            <Title className="font-size-3 font-weight-6">{template.name}</Title>
                                            <Paragraph className="color-muted font-size-2">{template.description}</Paragraph>
                                        </div>
                                        {selectedTemplate === template.id && (
                                            <div className="d-flex flex-center selected-check">
                                                <Check size={16} />
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <div
                                    className={`d-flex column items-center gap-1 template-card custom ${!selectedTemplate && customImage ? 'selected' : ''}`}
                                    onClick={handleCustomImageClick}
                                >
                                    <div className="template-icon">
                                        <Server size={32} color="#666" />
                                    </div>
                                    <div className="template-info">
                                        <Title className="font-size-3 font-weight-6">Custom Image</Title>
                                        <Paragraph className="color-muted font-size-2">Pull any image from Docker Hub.</Paragraph>
                                    </div>
                                    {!selectedTemplate && customImage && (
                                        <div className="d-flex flex-center selected-check">
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
                            <div className="d-flex column gap-2 config-form">
                                <div className="form-group">
                                    <label>Container Name</label>
                                    <Input
                                        type="text"
                                        placeholder="my-container-app"
                                        value={config.name}
                                        onChange={(val) => setConfig(prev => ({ ...prev, name: val as string }))}
                                        className="full-width-input"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Team</label>
                                    <Select
                                        options={teams.map(team => ({
                                            value: team._id,
                                            title: team.name
                                        }))}
                                        value={selectedTeamId}
                                        onChange={(val) => setSelectedTeamId(val)}
                                        placeholder="Select a team"
                                        className="full-width-input"
                                    />
                                </div>

                                <div className="resources-section">
                                    <Title className="font-size-4 font-weight-6">Resources</Title>
                                    <div className="resource-slider-wrapper">
                                        <div className="d-flex content-between slider-header">
                                            <label><Cpu size={16} /> CPU Cores</label>
                                            <span className="value-badge">{config.cpus} vCPU</span>
                                        </div>
                                        <Slider
                                            min={0.5}
                                            max={maxCpus}
                                            step={0.5}
                                            value={config.cpus}
                                            onChange={(val) => setConfig(prev => ({ ...prev, cpus: val }))}
                                        />
                                        <div className="d-flex content-between slider-limits">
                                            <span>0.5 vCPU</span>
                                            <span>{maxCpus} vCPU(Max)</span>
                                        </div>
                                    </div>

                                    <div className="resource-slider-wrapper">
                                        <div className="d-flex content-between slider-header">
                                            <label><HardDrive size={16} /> Memory</label>
                                            <span className="value-badge">{config.memory} MB</span>
                                        </div>
                                        <Slider
                                            min={128}
                                            max={maxMemory}
                                            step={128}
                                            value={config.memory}
                                            onChange={(val) => setConfig(prev => ({ ...prev, memory: val }))}
                                        />
                                        <div className="d-flex content-between slider-limits">
                                            <span>128 MB</span>
                                            <span>{maxMemory} MB(Max)</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="advanced-config">
                                    <div className="d-flex column config-group">
                                        <div className="d-flex content-between items-center group-header">
                                            <Title className="font-size-3 font-weight-6">Port Mapping</Title>
                                            <Button variant='ghost' intent='neutral' size='sm' leftIcon={<Plus size={14} />} onClick={addPort}>Add Port</Button>
                                        </div>
                                        {config.ports.map((port, i) => (
                                            <div key={i} className="d-flex gap-05 port-row">
                                                <div className="input-wrapper">
                                                    <label>Private</label>
                                                    <Input
                                                        type="number"
                                                        value={port.private}
                                                        onChange={(val) => updatePort(i, 'private', val as string)}
                                                        className="port-input"
                                                    />
                                                </div>
                                                <div className="input-wrapper">
                                                    <label>Public</label>
                                                    <Input
                                                        type="number"
                                                        placeholder="Auto"
                                                        value={port.public || ''}
                                                        onChange={(val) => updatePort(i, 'public', val as string)}
                                                        className="port-input"
                                                    />
                                                </div>
                                                <Button variant='ghost' intent='danger' iconOnly size='sm' onClick={() => removePort(i)}>
                                                    <Trash2 size={16} />
                                                </Button>
                                            </div>
                                        ))}
                                        {config.ports.length === 0 && (
                                            <div className="d-flex items-center gap-075 empty-state-small">
                                                <AlertCircle size={16} />
                                                <span>No ports exposed. Add a port to access your container.</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="d-flex column config-group">
                                        <div className="d-flex content-between items-center group-header">
                                            <Title className="font-size-3 font-weight-6">Environment Variables</Title>
                                            <Button variant='ghost' intent='neutral' size='sm' leftIcon={<Plus size={14} />} onClick={addEnv}>Add Variable</Button>
                                        </div>
                                        {config.env.map((env, i) => (
                                            <div key={i} className="d-flex gap-05 env-row">
                                                <Input
                                                    type="text"
                                                    placeholder="KEY"
                                                    value={env.key}
                                                    onChange={(val) => updateEnv(i, 'key', val as string)}
                                                    className="env-input"
                                                />
                                                <Input
                                                    type="text"
                                                    placeholder="VALUE"
                                                    value={env.value}
                                                    onChange={(val) => updateEnv(i, 'value', val as string)}
                                                    className="env-input"
                                                />
                                                <Button variant='ghost' intent='danger' iconOnly size='sm' onClick={() => removeEnv(i)}>
                                                    <Trash2 size={16} />
                                                </Button>
                                            </div>
                                        ))}
                                        {config.env.length === 0 && (
                                            <div className="d-flex items-center gap-075 empty-state-small">
                                                <AlertCircle size={16} />
                                                <span>No environment variables configured.</span>
                                            </div>
                                        )}
                                    </div>
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
                            <div className="d-flex content-end gap-1 step-actions">
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
                    <div className="modal-overlay">
                        <div className="modal-content custom-image-modal">
                            <div className="modal-header">
                                <Title className="font-size-4 font-weight-6">Custom Docker Image</Title>
                                <Button variant='ghost' intent='neutral' iconOnly onClick={() => setShowCustomImageModal(false)}>
                                    <X size={24} />
                                </Button>
                            </div>
                            <div className="modal-body">
                                <Paragraph className="color-muted">Enter the name of the Docker image you want to pull from Docker Hub.</Paragraph>
                                <Input
                                    type="text"
                                    placeholder="e.g., nginx:latest, mysql:8.0"
                                    value={tempCustomImage}
                                    onChange={(val) => setTempCustomImage(val as string)}
                                    className="full-width-input"
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
