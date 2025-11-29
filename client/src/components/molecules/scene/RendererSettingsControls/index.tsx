// src/components/organisms/controls/RendererSettingsControls.tsx
import React from 'react';
import Select from '@/components/atoms/form/Select';
import FormSchema from '@/components/atoms/form/FormSchema';
import FormField from '@/components/molecules/form/FormField';
import CollapsibleSection from '@/components/atoms/common/CollapsibleSection';
import useRendererSettings from '@/stores/editor/renderer-settings';
import { MdTune } from 'react-icons/md';

const RendererSettingsControls: React.FC = () => {
	const create = useRendererSettings((s) => s.create);
	const runtime = useRendererSettings((s) => s.runtime);
	const setCreate = useRendererSettings((s) => s.setCreate);
	const setRuntime = useRendererSettings((s) => s.setRuntime);
	const reset = useRendererSettings((s) => s.reset);

	const contextSection = {
		key: 'context',
		title: 'Context (GL Create)',
		enabled: true,
		onToggle: () => {},
		rows: [],
		extras: (
			<div style={{ display: 'grid', gap: 12 }}>
				<div>
					<FormField fieldKey="antialias" label="Antialias" fieldType="checkbox" fieldValue={create.antialias} onFieldChange={(_, v) => setCreate({ antialias: Boolean(v) })} />
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Smooth jagged edges on geometry (MSAA)</div>
				</div>
				<div>
					<FormField fieldKey="alpha" label="Alpha" fieldType="checkbox" fieldValue={create.alpha} onFieldChange={(_, v) => setCreate({ alpha: Boolean(v) })} />
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Enable transparency support (RGBA)</div>
				</div>
				<div>
					<FormField fieldKey="depth" label="Depth" fieldType="checkbox" fieldValue={create.depth} onFieldChange={(_, v) => setCreate({ depth: Boolean(v) })} />
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Enable depth testing for 3D rendering (Z-buffer)</div>
				</div>
				<div>
					<FormField fieldKey="stencil" label="Stencil" fieldType="checkbox" fieldValue={create.stencil} onFieldChange={(_, v) => setCreate({ stencil: Boolean(v) })} />
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Enable stencil buffer for masking effects</div>
				</div>
				<div>
					<FormField fieldKey="logDepth" label="Logarithmic Depth Buffer" fieldType="checkbox" fieldValue={create.logarithmicDepthBuffer} onFieldChange={(_, v) => setCreate({ logarithmicDepthBuffer: Boolean(v) })} />
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Improve depth precision for large scenes (Z-fighting fix)</div>
				</div>
				<div>
					<FormField fieldKey="preserve" label="Preserve Drawing Buffer" fieldType="checkbox" fieldValue={create.preserveDrawingBuffer} onFieldChange={(_, v) => setCreate({ preserveDrawingBuffer: Boolean(v) })} />
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Keep frame buffer between renders (screenshots)</div>
				</div>
				<button type="button" onClick={() => reset()} style={{ justifySelf: 'start' }}>Reset Renderer</button>
			</div>
		)
	};

	const toneSection = {
		key: 'tone',
		title: 'Tone Mapping & Color',
		enabled: true,
		onToggle: () => {},
		rows: [],
		extras: (
			<div style={{ display: 'grid', gap: 12 }}>
				<div>
					<div className='form-control-row'>
						<label className='labeled-input-label'>Exposure</label>
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
							<span className='form-control-value'>{runtime.toneMappingExposure.toFixed(2)}</span>
						</div>
					</div>
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Overall brightness multiplier</div>
				</div>
				<div>
					<Select
						value={runtime.toneMapping}
						onChange={(value) => setRuntime({ toneMapping: value as any })}
						placeholder="Tone Mapping"
						options={[
							{ title: 'None', value: 'None', description: 'No tone mapping applied' },
							{ title: 'Linear', value: 'Linear', description: 'Simple linear scaling' },
							{ title: 'Reinhard', value: 'Reinhard', description: 'Reinhard tone mapping operator' },
							{ title: 'Cineon', value: 'Cineon', description: 'Cineon film stock emulation' },
							{ title: 'ACES Filmic', value: 'ACESFilmic', description: 'ACES filmic tone mapping' }
						]}
					/>
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Color grading algorithm for HDR to LDR conversion</div>
				</div>
				<div>
					<Select
						value={runtime.outputColorSpace}
						onChange={(value) => setRuntime({ outputColorSpace: value as any })}
						placeholder="Output Color Space"
						options={[
							{ title: 'sRGB', value: 'SRGB', description: 'Standard RGB color space' },
							{ title: 'Linear sRGB', value: 'LinearSRGB', description: 'Linear sRGB for HDR workflows' }
						]}
					/>
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Color space for final output</div>
				</div>
			</div>
		)
	};

	const lightingSection = {
		key: 'lighting',
		title: 'Lighting & Clipping',
		enabled: true,
		onToggle: () => {},
		rows: [],
		extras: (
			<div style={{ display: 'grid', gap: 12 }}>
				<div>
					<FormField fieldKey="pcl" label="Physically Correct Lights" fieldType="checkbox" fieldValue={runtime.physicallyCorrectLights} onFieldChange={(_, v) => setRuntime({ physicallyCorrectLights: Boolean(v) })} />
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Use realistic light falloff calculations (1/r²)</div>
				</div>
				<div>
					<FormField fieldKey="localClip" label="Local Clipping" fieldType="checkbox" fieldValue={runtime.localClippingEnabled} onFieldChange={(_, v) => setRuntime({ localClippingEnabled: Boolean(v) })} />
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Enable local clipping planes (cutting geometry)</div>
				</div>
				<div>
					<FormField fieldKey="autoClear" label="Auto Clear" fieldType="checkbox" fieldValue={runtime.autoClear} onFieldChange={(_, v) => setRuntime({ autoClear: Boolean(v) })} />
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Clear canvas before each frame (prevents artifacts)</div>
				</div>
			</div>
		)
	};

	const shadowSection = {
		key: 'shadows',
		title: 'Shadows',
		enabled: true,
		onToggle: () => {},
		rows: [],
		extras: (
			<div style={{ display: 'grid', gap: 12 }}>
				<div>
					<FormField fieldKey="shadowEnabled" label="Enabled" fieldType="checkbox" fieldValue={runtime.shadowEnabled} onFieldChange={(_, v) => setRuntime({ shadowEnabled: Boolean(v) })} />
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Enable shadow rendering (performance impact)</div>
				</div>
				<div>
					<Select
						value={runtime.shadowType}
						onChange={(value) => setRuntime({ shadowType: value as any })}
						placeholder="Shadow Type"
						options={[
							{ title: 'Basic', value: 'Basic', description: 'Hard-edged shadows, fastest' },
							{ title: 'PCF', value: 'PCF', description: 'Percentage Closer Filtering' },
							{ title: 'PCF Soft', value: 'PCFSoft', description: 'Soft PCF with better quality' },
							{ title: 'VSM', value: 'VSM', description: 'Variance Shadow Maps, highest quality' }
						]}
					/>
					<div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Shadow filtering algorithm (PCF = softer edges)</div>
				</div>
			</div>
		)
	};

	return (
		<CollapsibleSection 
			title="Renderer Settings" 
			icon={<MdTune size={16} />}
		>
			<FormSchema sections={[contextSection, toneSection, lightingSection, shadowSection]} />
		</CollapsibleSection>
	);
};

export default RendererSettingsControls;
