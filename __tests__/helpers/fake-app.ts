import type { App } from 'obsidian';

interface FakeFile {
	path: string;
	name: string;
	basename: string;
	extension: string;
}

function makeFile(path: string): FakeFile {
	const name = path.split('/').pop() ?? path;
	return {
		path,
		name,
		basename: name.replace(/\.md$/, ''),
		extension: 'md',
	};
}

export interface FakeAppHandle {
	app: App;
	createdFiles: { path: string; content: string }[];
	createdFolders: string[];
}

/**
 * Build an in-memory fake `App` whose vault tracks created files and folders.
 * Only the vault methods used by `createStandaloneNote` are implemented.
 */
export function createFakeApp(options?: {
	existingFiles?: string[];
	existingFolders?: string[];
}): FakeAppHandle {
	const files = new Set(options?.existingFiles ?? []);
	const folders = new Set(options?.existingFolders ?? []);
	const createdFiles: { path: string; content: string }[] = [];
	const createdFolders: string[] = [];

	const vault = {
		getFileByPath(path: string): FakeFile | null {
			return files.has(path) ? makeFile(path) : null;
		},
		getFolderByPath(path: string): unknown {
			return folders.has(path) ? { path } : null;
		},
		createFolder(path: string): Promise<unknown> {
			folders.add(path);
			createdFolders.push(path);
			return Promise.resolve({ path });
		},
		create(path: string, content: string): Promise<FakeFile> {
			files.add(path);
			createdFiles.push({ path, content });
			return Promise.resolve(makeFile(path));
		},
	};

	const app = { vault } as unknown as App;
	return { app, createdFiles, createdFolders };
}
