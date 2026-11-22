// The phone's tilt as shared state for the 3D objects (the touch counterpart of the mouse).
// One sensor listener for the whole app; consumers read `tilt.x` / `tilt.y` (-1..1) or the
// CSS variables --tilt-x / --tilt-y on <html>. Off unless the person turns it on (iOS asks
// for permission on that tap); never under reduced motion; paused while the page is hidden.
import { createTilt } from './tilt.ts';

const KEY = 'octa.tilt';

export const tilt = $state({ supported: false, enabled: false, denied: false, x: 0, y: 0 });

type IOSOrientation = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

const needsPermission = () => typeof (globalThis.DeviceOrientationEvent as IOSOrientation | undefined)?.requestPermission === 'function';

const math = createTilt();
let listening = false;

function publish(x: number, y: number) {
	tilt.x = x;
	tilt.y = y;
	const root = document.documentElement;
	root.style.setProperty('--tilt-x', x.toFixed(3));
	root.style.setProperty('--tilt-y', y.toFixed(3));
}

function onOrientation(e: DeviceOrientationEvent) {
	// Only upright portrait is mapped; in landscape the axes swap, so the objects rest.
	if (screen.orientation && screen.orientation.angle !== 0) return publish(0, 0);
	const p = math.feed(e.beta, e.gamma);
	publish(p.x, p.y);
}

function onVisibility() {
	if (document.hidden) {
		stopListening();
		publish(0, 0);
	} else if (tilt.enabled) startListening();
}

function startListening() {
	if (listening) return;
	listening = true;
	math.reset();
	window.addEventListener('deviceorientation', onOrientation);
}

function stopListening() {
	listening = false;
	window.removeEventListener('deviceorientation', onOrientation);
}

function turnOn() {
	tilt.enabled = true;
	document.documentElement.dataset.tilt = 'on';
	document.addEventListener('visibilitychange', onVisibility);
	startListening();
}

function save(on: boolean) {
	try {
		localStorage.setItem(KEY, on ? '1' : '0');
	} catch {
		// private mode: the choice just lasts until the page closes
	}
}

/** Turn it on. Must run inside a tap: iOS only shows its permission question from one. */
export async function enableTilt(): Promise<boolean> {
	if (!tilt.supported) return false;
	if (needsPermission()) {
		try {
			const answer = await (globalThis.DeviceOrientationEvent as IOSOrientation).requestPermission!();
			if (answer !== 'granted') {
				tilt.denied = true;
				save(false); // a "no" sticks: nothing asks again by surprise
				return false;
			}
		} catch {
			tilt.denied = true;
			save(false);
			return false;
		}
	}
	tilt.denied = false;
	turnOn();
	save(true);
	return true;
}

export function disableTilt() {
	tilt.enabled = false;
	stopListening();
	document.removeEventListener('visibilitychange', onVisibility);
	delete document.documentElement.dataset.tilt;
	publish(0, 0);
	save(false);
}

/** Call once on the client. Restores the person's choice; where no permission is needed it is on by default. */
export function initTilt() {
	const touch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
	const sensor = typeof globalThis.DeviceOrientationEvent !== 'undefined';
	const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
	tilt.supported = touch && sensor && !calm;
	if (!tilt.supported) return;
	let saved: string | null = null;
	try {
		saved = localStorage.getItem(KEY);
	} catch {
		// no storage
	}
	const wantsOn = saved === null ? !needsPermission() : saved === '1';
	if (!wantsOn) return;
	if (!needsPermission()) return turnOn();
	// R5.3: iOS may still hold the grant from the last launch. Listening costs no question: if a
	// reading arrives the grant is alive and the objects lean again; if none does, it stays off. The
	// question itself only ever comes from the "Organizar" switch (R4.3), never from here.
	const probe = () => {
		window.removeEventListener('deviceorientation', probe);
		if (!tilt.enabled) turnOn();
	};
	window.addEventListener('deviceorientation', probe);
}
