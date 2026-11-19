export interface Env {
	webgl: boolean;
	reducedMotion: boolean;
	saveData: boolean;
	/** `navigator.hardwareConcurrency`; undefined when the browser hides it. */
	cores: number | undefined;
	/** `navigator.deviceMemory` in GB; undefined when the browser hides it (Safari). */
	memoryGb: number | undefined;
}

/**
 * Whether the WebGL (Threlte) renderer may run (DESIGN §6). Anything else gets the
 * CSS-3D composition. A browser that hides cores or memory is not penalised.
 */
export function canUseWebGL3D(env: Env): boolean {
	if (!env.webgl || env.reducedMotion || env.saveData) return false;
	if (env.cores !== undefined && env.cores <= 4) return false;
	if (env.memoryGb !== undefined && env.memoryGb <= 4) return false;
	return true;
}

/** The CSS tilt is cheap, so only an explicit reduced-motion request turns it off. */
export function mayTilt(env: Env): boolean {
	return !env.reducedMotion;
}

let webglProbe: boolean | undefined;

function hasWebGL(): boolean {
	if (webglProbe === undefined) {
		try {
			const canvas = document.createElement('canvas');
			const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
			webglProbe = gl !== null;
			(gl as WebGLRenderingContext | null)?.getExtension('WEBGL_lose_context')?.loseContext();
		} catch {
			webglProbe = false;
		}
	}
	return webglProbe;
}

/** Read the live browser environment. Only call in the browser. */
export function readEnv(): Env {
	const nav = navigator as Navigator & {
		deviceMemory?: number;
		connection?: { saveData?: boolean };
	};
	return {
		webgl: hasWebGL(),
		reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
		saveData: nav.connection?.saveData === true,
		cores: nav.hardwareConcurrency || undefined,
		memoryGb: nav.deviceMemory
	};
}
