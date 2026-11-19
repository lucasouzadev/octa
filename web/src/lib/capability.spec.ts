import { describe, expect, it } from 'vitest';
import { canUseWebGL3D, mayTilt, type Env } from './capability.ts';

const capable: Env = { webgl: true, reducedMotion: false, saveData: false, cores: 8, memoryGb: 8 };
const with_ = (over: Partial<Env>): Env => ({ ...capable, ...over });

describe('canUseWebGL3D', () => {
	it('is true on a capable device', () => {
		expect(canUseWebGL3D(capable)).toBe(true);
	});

	it('is false without WebGL', () => {
		expect(canUseWebGL3D(with_({ webgl: false }))).toBe(false);
	});

	it('is false with reduced motion', () => {
		expect(canUseWebGL3D(with_({ reducedMotion: true }))).toBe(false);
	});

	it('is false with Save-Data', () => {
		expect(canUseWebGL3D(with_({ saveData: true }))).toBe(false);
	});

	it('is false on 4 cores or fewer, true on 5+', () => {
		expect(canUseWebGL3D(with_({ cores: 4 }))).toBe(false);
		expect(canUseWebGL3D(with_({ cores: 2 }))).toBe(false);
		expect(canUseWebGL3D(with_({ cores: 5 }))).toBe(true);
	});

	it('is false on 4 GB of memory or less, true above', () => {
		expect(canUseWebGL3D(with_({ memoryGb: 4 }))).toBe(false);
		expect(canUseWebGL3D(with_({ memoryGb: 8 }))).toBe(true);
	});

	it('does not penalise a browser that hides cores or memory (Safari)', () => {
		expect(canUseWebGL3D(with_({ cores: undefined, memoryGb: undefined }))).toBe(true);
	});
});

describe('mayTilt', () => {
	it('allows the tilt unless the user asked for reduced motion', () => {
		expect(mayTilt(capable)).toBe(true);
		expect(mayTilt(with_({ reducedMotion: true }))).toBe(false);
	});

	it('does not depend on how strong the device is (CSS tilt is cheap)', () => {
		expect(mayTilt(with_({ webgl: false, cores: 2, saveData: true }))).toBe(true);
	});
});
