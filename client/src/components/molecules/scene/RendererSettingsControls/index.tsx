// src/components/organisms/controls/RendererSettingsControls.tsx
import React from 'react';
import Select from '@/components/atoms/form/Select';
import FormSchema from '@/components/atoms/form/FormSchema';
import FormField from '@/components/molecules/FormField';
import useRendererSettings from '@/stores/editor/renderer-settings';

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
			<div style={{ display: 'grid', gap: 8 }}>
				<FormField fieldKey="antialias" label="Antialias" fieldType="checkbox" fieldValue={create.antialias} onFieldChange={(_, v) => setCreate({ antialias: Boolean(v) })} />
				<FormField fieldKey="alpha" label="Alpha" fieldType="checkbox" fieldValue={create.alpha} onFieldChange={(_, v) => setCreate({ alpha: Boolean(v) })} />
				<FormField fieldKey="depth" label="Depth" fieldType="checkbox" fieldValue={create.depth} onFieldChange={(_, v) => setCreate({ depth: Boolean(v) })} />
				<FormField fieldKey="stencil" label="Stencil" fieldType="checkbox" fieldValue={create.stencil} onFieldChange={(_, v) => setCreate({ stencil: Boolean(v) })} />
				<FormField fieldKey="logDepth" label="Logarithmic Depth Buffer" fieldType="checkbox" fieldValue={create.logarithmicDepthBuffer} onFieldChange={(_, v) => setCreate({ logarithmicDepthBuffer: Boolean(v) })} />
				<FormField fieldKey="preserve" label="Preserve Drawing Buffer" fieldType="checkbox" fieldValue={create.preserveDrawingBuffer} onFieldChange={(_, v) => setCreate({ preserveDrawingBuffer: Boolean(v) })} />
				<button type="button" onClick={() => reset()} style={{ justifySelf: 'start' }}>Reset Renderer</button>
			</div>
		)
	};

	const toneSection = {
		key: 'tone',
		title: 'Tone Mapping & Color',
		enabled: true,
		onToggle: () => {},
		rows: [
			{ label: 'Exposure', min: 0, max: 10, step: 0.01, get: () => runtime.toneMappingExposure, set: (v: number) => setRuntime({ toneMappingExposure: v }), format: (v: number) => v.toFixed(2) }
		],
		extras: (
			<div style={{ display: 'grid', gap: 8 }}>
				<Select
					value={runtime.toneMapping}
					onChange={(value) => setRuntime({ toneMapping: value as any })}
					placeholder="Tone Mapping"
					options={[
						{ title: 'None', value: 'None' },
						{ title: 'Linear', value: 'Linear' },
						{ title: 'Reinhard', value: 'Reinhard' },
						{ title: 'Cineon', value: 'Cineon' },
						{ title: 'ACES Filmic', value: 'ACESFilmic' }
					]}
				/>
				<Select
					value={runtime.outputColorSpace}
					onChange={(value) => setRuntime({ outputColorSpace: value as any })}
					placeholder="Output Color Space"
					options={[
						{ title: 'sRGB', value: 'SRGB' },
						{ title: 'Linear sRGB', value: 'LinearSRGB' }
					]}
				/>
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
			<div style={{ display: 'grid', gap: 8 }}>
				<FormField fieldKey="pcl" label="Physically Correct Lights" fieldType="checkbox" fieldValue={runtime.physicallyCorrectLights} onFieldChange={(_, v) => setRuntime({ physicallyCorrectLights: Boolean(v) })} />
				<FormField fieldKey="localClip" label="Local Clipping" fieldType="checkbox" fieldValue={runtime.localClippingEnabled} onFieldChange={(_, v) => setRuntime({ localClippingEnabled: Boolean(v) })} />
				<FormField fieldKey="autoClear" label="Auto Clear" fieldType="checkbox" fieldValue={runtime.autoClear} onFieldChange={(_, v) => setRuntime({ autoClear: Boolean(v) })} />
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
			<div style={{ display: 'grid', gap: 8 }}>
				<FormField fieldKey="shadowEnabled" label="Enabled" fieldType="checkbox" fieldValue={runtime.shadowEnabled} onFieldChange={(_, v) => setRuntime({ shadowEnabled: Boolean(v) })} />
				<Select
					value={runtime.shadowType}
					onChange={(value) => setRuntime({ shadowType: value as any })}
					placeholder="Shadow Type"
					options={[
						{ title: 'Basic', value: 'Basic' },
						{ title: 'PCF', value: 'PCF' },
						{ title: 'PCF Soft', value: 'PCFSoft' },
						{ title: 'VSM', value: 'VSM' }
					]}
				/>
			</div>
		)
	};

	return (
		<div className="editor-sidebar-item-container">
			<div className="editor-sidebar-item-header-container">
				<h3 className="editor-sidebar-item-header-title">Renderer Settings</h3>
			</div>
			<FormSchema sections={[contextSection, toneSection, lightingSection, shadowSection]} className="editor-sidebar-item-body-container" />
		</div>
	);
};

export default RendererSettingsControls;
