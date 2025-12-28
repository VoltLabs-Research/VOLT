import React from 'react';
import FormSchema from '@/components/atoms/form/FormSchema';
import FormField from '@/components/molecules/form/FormField';
import CollapsibleSection from '@/components/atoms/common/CollapsibleSection';
import { useEditorStore } from '@/stores/slices/editor';
import Button from '@/components/primitives/Button';
import { MdRotateLeft } from 'react-icons/md';

const OrbitControls: React.FC = () => {
	const enabled = useEditorStore((s) => s.orbitControls.enabled);
	const enableDamping = useEditorStore((s) => s.orbitControls.enableDamping);
	const dampingFactor = useEditorStore((s) => s.orbitControls.dampingFactor);
	const enableZoom = useEditorStore((s) => s.orbitControls.enableZoom);
	const zoomSpeed = useEditorStore((s) => s.orbitControls.zoomSpeed);
	const enableRotate = useEditorStore((s) => s.orbitControls.enableRotate);
	const rotateSpeed = useEditorStore((s) => s.orbitControls.rotateSpeed);
	const enablePan = useEditorStore((s) => s.orbitControls.enablePan);
	const panSpeed = useEditorStore((s) => s.orbitControls.panSpeed);
	const screenSpacePanning = useEditorStore((s) => s.orbitControls.screenSpacePanning);
	const autoRotate = useEditorStore((s) => s.orbitControls.autoRotate);
	const autoRotateSpeed = useEditorStore((s) => s.orbitControls.autoRotateSpeed);
	const minDistance = useEditorStore((s) => s.orbitControls.minDistance);
	const maxDistance = useEditorStore((s) => s.orbitControls.maxDistance);
	const minPolarAngle = useEditorStore((s) => s.orbitControls.minPolarAngle);
	const maxPolarAngle = useEditorStore((s) => s.orbitControls.maxPolarAngle);
	const minAzimuthAngle = useEditorStore((s) => s.orbitControls.minAzimuthAngle);
	const maxAzimuthAngle = useEditorStore((s) => s.orbitControls.maxAzimuthAngle);
	const target = useEditorStore((s) => s.orbitControls.target);
	const set = useEditorStore((s) => s.orbitControls.set);
	const setTarget = useEditorStore((s) => s.orbitControls.setTarget);
	const reset = useEditorStore((s) => s.orbitControls.reset);

	const general = {
		key: 'general',
		title: 'OrbitControls',
		enabled: true,
		onToggle: () => { },
		rows: [],
		extras: (
			<div style={{ display: 'grid', gap: 8 }}>
				<FormField fieldKey="enabled" label="Enabled" fieldType="checkbox" fieldValue={enabled} onFieldChange={(_, v) => set({ enabled: Boolean(v) })} />
				<FormField fieldKey="autoRotate" label="Auto Rotate" fieldType="checkbox" fieldValue={autoRotate} onFieldChange={(_, v) => set({ autoRotate: Boolean(v) })} />
				<FormField fieldKey="enableDamping" label="Enable Damping" fieldType="checkbox" fieldValue={enableDamping} onFieldChange={(_, v) => set({ enableDamping: Boolean(v) })} />
				<FormField fieldKey="enableZoom" label="Enable Zoom" fieldType="checkbox" fieldValue={enableZoom} onFieldChange={(_, v) => set({ enableZoom: Boolean(v) })} />
				<FormField fieldKey="enableRotate" label="Enable Rotate" fieldType="checkbox" fieldValue={enableRotate} onFieldChange={(_, v) => set({ enableRotate: Boolean(v) })} />
				<FormField fieldKey="enablePan" label="Enable Pan" fieldType="checkbox" fieldValue={enablePan} onFieldChange={(_, v) => set({ enablePan: Boolean(v) })} />
				<Button variant='ghost' intent='neutral' size='sm' onClick={() => reset()} style={{ justifySelf: 'start' }}>Reset Orbit</Button>
			</div>
		)
	};

	const speeds = {
		key: 'speeds',
		title: 'Speeds',
		enabled: true,
		onToggle: () => { },
		rows: [
			{ label: 'Rotate Speed', min: 0.01, max: 10, step: 0.01, get: () => rotateSpeed, set: (v: number) => set({ rotateSpeed: v }), format: (v: number) => v.toFixed(2) },
			{ label: 'Zoom Speed', min: 0.01, max: 10, step: 0.01, get: () => zoomSpeed, set: (v: number) => set({ zoomSpeed: v }), format: (v: number) => v.toFixed(2) },
			{ label: 'Pan Speed', min: 0.01, max: 10, step: 0.01, get: () => panSpeed, set: (v: number) => set({ panSpeed: v }), format: (v: number) => v.toFixed(2) },
			{ label: 'Auto Rotate Speed', min: 0, max: 20, step: 0.1, get: () => autoRotateSpeed, set: (v: number) => set({ autoRotateSpeed: v }), format: (v: number) => v.toFixed(1) },
			{ label: 'Damping Factor', min: 0, max: 1, step: 0.001, get: () => dampingFactor, set: (v: number) => set({ dampingFactor: v }), format: (v: number) => v.toFixed(3) }
		],
		extras: (
			<FormField fieldKey="screenSpacePanning" label="Screen Space Panning" fieldType="checkbox" fieldValue={screenSpacePanning} onFieldChange={(_, v) => set({ screenSpacePanning: Boolean(v) })} />
		)
	};

	const limits = {
		key: 'limits',
		title: 'Limits',
		enabled: true,
		onToggle: () => { },
		rows: [
			{ label: 'Min Distance', min: 0.001, max: Math.max(10, maxDistance), step: 0.001, get: () => minDistance, set: (v: number) => set({ minDistance: v }), format: (v: number) => v.toFixed(3) },
			{ label: 'Max Distance', min: Math.max(0.001, minDistance + 0.001), max: 100000, step: 0.1, get: () => maxDistance, set: (v: number) => set({ maxDistance: v }), format: (v: number) => v.toFixed(1) },
			{ label: 'Min Polar(rad)', min: 0, max: Math.PI, step: 0.001, get: () => minPolarAngle, set: (v: number) => set({ minPolarAngle: v }), format: (v: number) => v.toFixed(3) },
			{ label: 'Max Polar(rad)', min: 0, max: Math.PI, step: 0.001, get: () => maxPolarAngle, set: (v: number) => set({ maxPolarAngle: v }), format: (v: number) => v.toFixed(3) },
			{ label: 'Min Azimuth(rad)', min: -Math.PI * 1000, max: Math.PI * 1000, step: 0.001, get: () => minAzimuthAngle, set: (v: number) => set({ minAzimuthAngle: v }), format: (v: number) => v.toFixed(3) },
			{ label: 'Max Azimuth(rad)', min: -Math.PI * 1000, max: Math.PI * 1000, step: 0.001, get: () => maxAzimuthAngle, set: (v: number) => set({ maxAzimuthAngle: v }), format: (v: number) => v.toFixed(3) }
		],
		extras: null
	};

	const targetSection = {
		key: 'target',
		title: 'Target(Z-up)',
		enabled: true,
		onToggle: () => { },
		rows: [
			{ label: 'Target X', min: -100000, max: 100000, step: 0.1, get: () => target[0], set: (v: number) => setTarget([v, target[1], target[2]]), format: (v: number) => v.toFixed(2) },
			{ label: 'Target Y', min: -100000, max: 100000, step: 0.1, get: () => target[1], set: (v: number) => setTarget([target[0], v, target[2]]), format: (v: number) => v.toFixed(2) },
			{ label: 'Target Z', min: -100000, max: 100000, step: 0.1, get: () => target[2], set: (v: number) => setTarget([target[0], target[1], v]), format: (v: number) => v.toFixed(2) }
		],
		extras: null
	};

	return (
		<CollapsibleSection
			title="Orbit Controls"
			icon={<MdRotateLeft size={16} />}
		>
			<div style={{ display: 'grid', gap: 12 }}>
				<div>
					<div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', fontWeight: '500' }}>General Settings</div>
					<FormSchema sections={[general]} />
				</div>
				<div>
					<div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', fontWeight: '500' }}>Movement Speeds</div>
					<FormSchema sections={[speeds]} />
				</div>
				<div>
					<div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', fontWeight: '500' }}>Distance & Angle Limits</div>
					<FormSchema sections={[limits]} />
				</div>
				<div>
					<div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', fontWeight: '500' }}>Target Position</div>
					<FormSchema sections={[targetSection]} />
				</div>
			</div>
		</CollapsibleSection>
	);
};

export default OrbitControls;
