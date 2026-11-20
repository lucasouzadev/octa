// The browser side of export/import: write the file, read the file. The rules are in backup.ts.
import { backupFileName, parseBackup, type BackupError, type ImportSummary } from '#lib/backup.ts';
import { library } from '#lib/db/index.ts';

export const BACKUP_ERROR_TEXT: Record<BackupError, string> = {
	not_json: 'Esse arquivo não é válido',
	not_octa: 'Esse arquivo não é do octa',
	newer_schema: 'Arquivo de uma versão mais nova do octa',
	too_big: 'Arquivo grande demais'
};

/** Saves the whole library as a JSON file (the share sheet on phones, a download elsewhere). */
export async function exportLibrary(): Promise<void> {
	const backup = await (await library()).exportAll();
	const name = backupFileName();
	const file = new File([JSON.stringify(backup, null, 2)], name, { type: 'application/json' });
	const phone = matchMedia('(pointer: coarse)').matches;
	if (phone && navigator.canShare?.({ files: [file] })) {
		try {
			await navigator.share({ files: [file] });
			return;
		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') return; // closed the sheet: not an error
			// Anything else: fall through to a plain download.
		}
	}
	const url = URL.createObjectURL(file);
	const a = document.createElement('a');
	a.href = url;
	a.download = name;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export type ImportResult = { ok: true; summary: ImportSummary; dropped: number } | { ok: false; error: BackupError };

export async function importLibrary(file: File): Promise<ImportResult> {
	const parsed = parseBackup(await file.text());
	if (!parsed.ok) return parsed;
	const summary = await (await library()).importBackup(parsed.backup);
	return { ok: true, summary, dropped: parsed.dropped };
}

export function importMessage(summary: ImportSummary, dropped: number): string {
	const n = summary.addedVideos;
	if (n === 0 && summary.addedCollections === 0) return 'Nada novo para importar';
	const text = `${n} ${n === 1 ? 'vídeo importado' : 'vídeos importados'}`;
	return dropped > 0 ? `${text}, ${dropped} ignorado${dropped === 1 ? '' : 's'}` : text;
}
