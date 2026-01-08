// src/components/organisms/controls/RendererSettingsControls.tsx
import React from 'react';
import Select from '@/components/atoms/form/Select';
import FormSchema from '@/components/atoms/form/FormSchema';
import FormField from '@/components/molecules/form/FormField';
import CollapsibleSection from '@/components/atoms/common/CollapsibleSection';
import { useEditorStore } from '@/features/canvas/stores/editor';
import Button from '@/components/primitives/Button';
import { MdTune } from 'react-icons/md';

const RendererSettingsControls: React.FC = () => {
	const create = useEditorStore((s) => s.rendererSettings.create);
	const runtime = useEditorStore((s) => s.rendererSettings.runtime);
	const setCreate = useEditorStore((s) => s.rendererSettings.setCreate);
	const setRuntime = useEditorStore((s) => s.rendererSettings.setRuntime);
	const reset = useEditorStore((s) => s.rendererSettings.reset);

	// ============================================================================
	// WebGL Context Creation Settings (GL Create)
	// ============================================================================

	const contextSection = {
		key: 'context',
		title: 'WebGL Context (GL Create)',
		enabled: true,
		onToggle: () => { },
		rows: [],
		extras: (
			<div style={{ display: 'grid', gap: 12 }}>
				<div style={{ fontSize: '0.75rem', color: '#ffa500', marginBottom: '8px', padding: '8px', background: 'rgba(255, 165, 0, 0.1)', borderRadius: '4px' }}>
					⚠️ Changing these settings will recreate the renderer and reset the scene
				</div>

				{/* Anti-aliasing */}
				<div>
					<FormField fieldKey="antialias" label="Antialias" fieldType="checkbox" fieldValue={create.antialias} onFieldChange={(_, v) => setCreate({ antialias: Boolean(v) })} />
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Enable MSAA for smooth geometry edges</div>
				</div>

				{/* Alpha Channel */}
				<div>
					<FormField fieldKey="alpha" label="Alpha Channel" fieldType="checkbox" fieldValue={create.alpha} onFieldChange={(_, v) => setCreate({ alpha: Boolean(v) })} />
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Enable transparency support (RGBA canvas)</div>
				</div>

				{/* Depth Buffer */}
				<div>
					<FormField fieldKey="depth" label="Depth Buffer" fieldType="checkbox" fieldValue={create.depth} onFieldChange={(_, v) => setCreate({ depth: Boolean(v) })} />
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Enable Z-buffer for 3D depth testing</div>
				</div>

				{/* Stencil Buffer */}
				<div>
					<FormField fieldKey="stencil" label="Stencil Buffer" fieldType="checkbox" fieldValue={create.stencil} onFieldChange={(_, v) => setCreate({ stencil: Boolean(v) })} />
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Enable stencil operations for masking</div>
				</div>

				{/* Logarithmic Depth Buffer */}
				<div>
					<FormField fieldKey="logDepth" label="Logarithmic Depth" fieldType="checkbox" fieldValue={create.logarithmicDepthBuffer} onFieldChange={(_, v) => setCreate({ logarithmicDepthBuffer: Boolean(v) })} />
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Fix Z-fighting in large scenes with better depth precision</div>
				</div>

				{/* Preserve Drawing Buffer */}
				<div>
					<FormField fieldKey="preserve" label="Preserve Drawing Buffer" fieldType="checkbox" fieldValue={create.preserveDrawingBuffer} onFieldChange={(_, v) => setCreate({ preserveDrawingBuffer: Boolean(v) })} />
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Keep framebuffer between renders (for screenshots)</div>
				</div>

				{/* Premultiplied Alpha */}
				<div>
					<FormField fieldKey="premultAlpha" label="Premultiplied Alpha" fieldType="checkbox" fieldValue={create.premultipliedAlpha} onFieldChange={(_, v) => setCreate({ premultipliedAlpha: Boolean(v) })} />
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Use premultiplied alpha blending (recommended)</div>
				</div>

				{/* Fail If Major Performance Caveat */}
				<div>
					<FormField fieldKey="failPerf" label="Fail Without GPU" fieldType="checkbox" fieldValue={create.failIfMajorPerformanceCaveat} onFieldChange={(_, v) => setCreate({ failIfMajorPerformanceCaveat: Boolean(v) })} />
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Abort if GPU acceleration unavailable</div>
				</div>

				{/* Precision */}
				<div>
					<Select
						value={create.precision}
						onChange={(value) => setCreate({ precision: value as any })}
						placeholder="Shader Precision"
						options={[
							{ title: 'High Precision', value: 'highp', description: 'Best quality, may not work on all devices' },
							{ title: 'Medium Precision', value: 'mediump', description: 'Balanced quality and compatibility' },
							{ title: 'Low Precision', value: 'lowp', description: 'Lowest quality, maximum compatibility' }
						]}
					/>
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Shader floating-point precision</div>
				</div>

				<Button variant='ghost' intent='neutral' size='sm' onClick={() => reset()} style={{ justifySelf: 'start' }}>Reset All Settings</Button>
			</div>
		)
	};

	// ============================================================================
	// Tone Mapping & Color Space
	// ============================================================================

	const toneSection = {
		key: 'tone',
		title: 'Tone Mapping & Color',
		enabled: true,
		onToggle: () => { },
		rows: [],
		extras: (
			<div style={{ display: 'grid', gap: 12 }}>
				{/* Exposure */}
				<div>
					<div className='d-flex items-center content-between'>
						<label className='labeled-input-label font-weight-4'>Exposure</label>
						<div className='form-control-row-slider-container'>
							<input
								type="range"
								min="0"
								max="10"
								step="0.01"
								value={runtime.toneMappingExposure}
								onChange={(e) => setRuntime({ toneMappingExposure: parseFloat(e.target.value) })}
								style={{ width: '100%' }}
							/>
							<span className='form-control-value color-muted'>{runtime.toneMappingExposure.toFixed(2)}</span>
						</div>
					</div>
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Overall scene brightness multiplier</div>
				</div>

				{/* Tone Mapping */}
				<div>
					<Select
						value={runtime.toneMapping}
						onChange={(value) => setRuntime({ toneMapping: value as any })}
						placeholder="Tone Mapping"
						options={[
							{ title: 'None', value: 'None', description: 'No tone mapping (linear output)' },
							{ title: 'Linear', value: 'Linear', description: 'Simple linear scaling' },
							{ title: 'Reinhard', value: 'Reinhard', description: 'Classic Reinhard operator' },
							{ title: 'Cineon', value: 'Cineon', description: 'Film stock emulation' },
							{ title: 'ACES Filmic', value: 'ACESFilmic', description: 'Academy Color Encoding System' },
							{ title: 'AgX', value: 'AgX', description: 'Modern Blender-style tone mapping' },
							{ title: 'Neutral', value: 'Neutral', description: 'Neutral tone mapping for balanced look' }
						]}
					/>
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>HDR to LDR conversion algorithm</div>
				</div>

				{/* Output Color Space */}
				<div>
					<Select
						value={runtime.outputColorSpace}
						onChange={(value) => setRuntime({ outputColorSpace: value as any })}
						placeholder="Output Color Space"
						options={[
							{ title: 'sRGB', value: 'SRGB', description: 'Standard RGB (most common)' },
							{ title: 'Linear sRGB', value: 'LinearSRGB', description: 'Linear for HDR workflows' },
							{ title: 'Display P3', value: 'DisplayP3', description: 'Wide gamut (Apple displays)' },
							{ title: 'Linear Display P3', value: 'LinearDisplayP3', description: 'Linear P3 for HDR' }
						]}
					/>
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Output color space for display</div>
				</div>

				{/* Gamma Factor (Legacy) */}
				<div>
					<div className='d-flex items-center content-between'>
						<label className='labeled-input-label font-weight-4'>Gamma Factor (Legacy)</label>
						<div className='form-control-row-slider-container'>
							<input
								type="range"
								min="1.0"
								max="3.0"
								step="0.1"
								value={runtime.gammaFactor}
								onChange={(e) => setRuntime({ gammaFactor: parseFloat(e.target.value) })}
								style={{ width: '100%' }}
							/>
							<span className='form-control-value color-muted'>{runtime.gammaFactor.toFixed(1)}</span>
						</div>
					</div>
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Legacy gamma correction (prefer outputColorSpace)</div>
				</div>
			</div>
		)
	};

	// ============================================================================
	// Shadow Configuration
	// ============================================================================

	const shadowSection = {
		key: 'shadows',
		title: 'Shadow Configuration',
		enabled: true,
		onToggle: () => { },
		rows: [],
		extras: (
			<div style={{ display: 'grid', gap: 12 }}>
				{/* Shadow Enabled */}
				<div>
					<FormField fieldKey="shadowEnabled" label="Enable Shadows" fieldType="checkbox" fieldValue={runtime.shadowEnabled} onFieldChange={(_, v) => setRuntime({ shadowEnabled: Boolean(v) })} />
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Enable shadow rendering (performance impact)</div>
				</div>

				{/* Shadow Type */}
				<div>
					<Select
						value={runtime.shadowType}
						onChange={(value) => setRuntime({ shadowType: value as any })}
						placeholder="Shadow Type"
						options={[
							{ title: 'Basic', value: 'Basic', description: 'Hard shadows, fastest' },
							{ title: 'PCF', value: 'PCF', description: 'Percentage Closer Filtering' },
							{ title: 'PCF Soft', value: 'PCFSoft', description: 'Softer PCF shadows' },
							{ title: 'VSM', value: 'VSM', description: 'Variance Shadow Maps (highest quality)' }
						]}
					/>
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Shadow filtering algorithm</div>
				</div>

				{/* Shadow Auto Update */}
				<div>
					<FormField fieldKey="shadowAutoUpdate" label="Auto Update Shadows" fieldType="checkbox" fieldValue={runtime.shadowAutoUpdate} onFieldChange={(_, v) => setRuntime({ shadowAutoUpdate: Boolean(v) })} />
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Update shadows every frame automatically</div>
				</div>
			</div>
		)
	};

	// ============================================================================
	// Clipping & Culling
	// ============================================================================

	const clippingSection = {
		key: 'clipping',
		title: 'Clipping & Culling',
		enabled: true,
		onToggle: () => { },
		rows: [],
		extras: (
			<div style={{ display: 'grid', gap: 12 }}>
				{/* Local Clipping */}
				<div>
					<FormField fieldKey="localClip" label="Local Clipping Planes" fieldType="checkbox" fieldValue={runtime.localClippingEnabled} onFieldChange={(_, v) => setRuntime({ localClippingEnabled: Boolean(v) })} />
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Enable per-material clipping planes</div>
				</div>

				{/* Sort Objects */}
				<div>
					<FormField fieldKey="sortObj" label="Sort Objects" fieldType="checkbox" fieldValue={runtime.sortObjects} onFieldChange={(_, v) => setRuntime({ sortObjects: Boolean(v) })} />
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Sort objects by depth for proper transparency</div>
				</div>
			</div>
		)
	};

	// ============================================================================
	// Buffer Clearing
	// ============================================================================

	const bufferSection = {
		key: 'buffer',
		title: 'Buffer Clearing',
		enabled: true,
		onToggle: () => { },
		rows: [],
		extras: (
			<div style={{ display: 'grid', gap: 12 }}>
				{/* Auto Clear Master */}
				<div>
					<FormField fieldKey="autoClear" label="Auto Clear (Master)" fieldType="checkbox" fieldValue={runtime.autoClear} onFieldChange={(_, v) => setRuntime({ autoClear: Boolean(v) })} />
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Master switch: clear buffers before rendering</div>
				</div>

				{/* Auto Clear Color */}
				<div>
					<FormField fieldKey="autoClearColor" label="Auto Clear Color" fieldType="checkbox" fieldValue={runtime.autoClearColor} onFieldChange={(_, v) => setRuntime({ autoClearColor: Boolean(v) })} />
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Clear color buffer before rendering</div>
				</div>

				{/* Auto Clear Depth */}
				<div>
					<FormField fieldKey="autoClearDepth" label="Auto Clear Depth" fieldType="checkbox" fieldValue={runtime.autoClearDepth} onFieldChange={(_, v) => setRuntime({ autoClearDepth: Boolean(v) })} />
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Clear depth buffer before rendering</div>
				</div>

				{/* Auto Clear Stencil */}
				<div>
					<FormField fieldKey="autoClearStencil" label="Auto Clear Stencil" fieldType="checkbox" fieldValue={runtime.autoClearStencil} onFieldChange={(_, v) => setRuntime({ autoClearStencil: Boolean(v) })} />
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Clear stencil buffer before rendering</div>
				</div>
			</div>
		)
	};

	// ============================================================================
	// Advanced Settings
	// ============================================================================

	const advancedSection = {
		key: 'advanced',
		title: 'Advanced Settings',
		enabled: true,
		onToggle: () => { },
		rows: [],
		extras: (
			<div style={{ display: 'grid', gap: 12 }}>
				{/* Use Legacy Lights */}
				<div>
					<FormField fieldKey="legacyLights" label="Use Legacy Lights" fieldType="checkbox" fieldValue={runtime.useLegacyLights} onFieldChange={(_, v) => setRuntime({ useLegacyLights: Boolean(v) })} />
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Use pre-r155 lighting model (for compatibility)</div>
				</div>

				{/* Max Morph Targets */}
				<div>
					<div className='d-flex items-center content-between'>
						<label className='labeled-input-label font-weight-4'>Max Morph Targets</label>
						<div className='form-control-row-slider-container'>
							<input
								type="range"
								min="0"
								max="32"
								step="1"
								value={runtime.maxMorphTargets}
								onChange={(e) => setRuntime({ maxMorphTargets: parseInt(e.target.value) })}
								style={{ width: '100%' }}
							/>
							<span className='form-control-value color-muted'>{runtime.maxMorphTargets}</span>
						</div>
					</div>
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Maximum morph targets per mesh (animation)</div>
				</div>

				{/* Max Morph Normals */}
				<div>
					<div className='d-flex items-center content-between'>
						<label className='labeled-input-label font-weight-4'>Max Morph Normals</label>
						<div className='form-control-row-slider-container'>
							<input
								type="range"
								min="0"
								max="32"
								step="1"
								value={runtime.maxMorphNormals}
								onChange={(e) => setRuntime({ maxMorphNormals: parseInt(e.target.value) })}
								style={{ width: '100%' }}
							/>
							<span className='form-control-value color-muted'>{runtime.maxMorphNormals}</span>
						</div>
					</div>
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Maximum morph normals per mesh (lighting)</div>
				</div>
			</div>
		)
	};

	return (
		<CollapsibleSection
			title="Renderer Settings"
			icon={<MdTune size={16} />}
		>
			<FormSchema sections={[
				contextSection,
				toneSection,
				shadowSection,
				clippingSection,
				bufferSection,
				advancedSection
			]} />
		</CollapsibleSection>
	);
};

export default RendererSettingsControls;
