import type { Kind, Source } from './providers/parse.ts';

// R7.3b: one small theme per platform: a name, a plain generic icon (our own drawing, not
// the brand's logo) and an accent colour that reads on black (>= 4.5:1, checked in the spec).
export type PlatformKey = 'youtube' | 'shorts' | 'tiktok' | 'reels' | 'instagram' | 'file';
export type PlatformIcon = 'p-youtube' | 'p-shorts' | 'p-tiktok' | 'p-instagram' | 'p-file';

export interface Platform {
	key: PlatformKey;
	label: string;
	icon: PlatformIcon;
	color: string;
}

const THEMES: Record<PlatformKey, Platform> = {
	youtube: { key: 'youtube', label: 'YouTube', icon: 'p-youtube', color: '#FF5A4F' },
	shorts: { key: 'shorts', label: 'Shorts', icon: 'p-shorts', color: '#FF5A4F' },
	tiktok: { key: 'tiktok', label: 'TikTok', icon: 'p-tiktok', color: '#25F4EE' },
	reels: { key: 'reels', label: 'Reels', icon: 'p-instagram', color: '#FF6FAE' },
	instagram: { key: 'instagram', label: 'Instagram', icon: 'p-instagram', color: '#FF6FAE' },
	file: { key: 'file', label: 'Arquivo', icon: 'p-file', color: '#C9C9C9' }
};

export function platformOf(v: { source: Source; kind: Kind }): Platform {
	if (v.source === 'tiktok') return THEMES.tiktok;
	if (v.source === 'instagram') return v.kind === 'reel' ? THEMES.reels : THEMES.instagram;
	if (v.source === 'youtube') return v.kind === 'short' ? THEMES.shorts : THEMES.youtube;
	return THEMES.file;
}
