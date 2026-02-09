import type { App, TFile, CachedMetadata, HeadingCache } from 'obsidian';
import type { Moment } from '../types';
import { debug } from '../utils/debug';

/**
 * Information about a file used for relation matching.
 */
export interface FileRelationInfo {
	/** Full file path */
	filePath: string;
	/** File basename without extension */
	basename: string;
	/** Frontmatter aliases (lowercased for matching) */
	aliases: string[];
}

/**
 * Extract relation info from a file: basename and frontmatter aliases.
 */
export function getFileRelationInfo(app: App, file: TFile): FileRelationInfo {
	const cache = app.metadataCache.getFileCache(file);
	const aliases: string[] = [];

	if (cache?.frontmatter) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const rawAliases = cache.frontmatter['aliases'] ?? cache.frontmatter['alias'];
		if (Array.isArray(rawAliases)) {
			for (const a of rawAliases) {
				if (typeof a === 'string' && a.trim()) {
					aliases.push(a.trim().toLowerCase());
				}
			}
		} else if (typeof rawAliases === 'string' && rawAliases.trim()) {
			aliases.push(rawAliases.trim().toLowerCase());
		}
	}

	return {
		filePath: file.path,
		basename: file.basename,
		aliases,
	};
}

/**
 * Find the end line of a moment's content section.
 * For an inline moment at a given heading level, the section ends at the next
 * heading of the same or higher (lower number) level, or at the end of the file.
 *
 * @param headings - Array of HeadingCache from the file's metadata cache
 * @param startLine - The 0-based line number of the moment's heading
 * @param headingLevel - The heading level of the moment (1-6)
 * @param totalLines - Total number of lines in the file (used as fallback end)
 * @returns The end line (exclusive) of the moment's content section
 */
export function findMomentEndLine(
	headings: HeadingCache[],
	startLine: number,
	headingLevel: number,
	totalLines: number
): number {
	for (const heading of headings) {
		const line = heading.position.start.line;
		if (line > startLine && heading.level <= headingLevel) {
			return line;
		}
	}
	return totalLines;
}

/**
 * Check if a moment's section contains a link to the target file or a tag
 * matching one of its aliases, using metadata cache positions.
 */
export function isMomentRelatedToFile(
	app: App,
	moment: Moment,
	relationInfo: FileRelationInfo
): boolean {
	const cache = app.metadataCache.getCache(moment.filePath);
	if (!cache) {
		debug('Related check: no cache for file', { filePath: moment.filePath });
		return false;
	}

	if (moment.type === 'standalone') {
		// For standalone moments, check the entire file
		return hasMatchingLink(cache, relationInfo, app, moment.filePath) ||
			hasMatchingTag(cache, relationInfo);
	}

	// For inline moments, check only within the heading's section
	if (moment.headingLine === undefined || moment.headingLevel === undefined) {
		return false;
	}

	const headings = cache.headings ?? [];
	// Estimate total lines: use the max position we can find in cache
	const totalLines = estimateTotalLines(cache);
	const endLine = findMomentEndLine(headings, moment.headingLine, moment.headingLevel, totalLines);

	const links = cache.links ?? [];
	const linksInRange = links.filter(
		(l) => l.position.start.line >= moment.headingLine! && l.position.start.line < endLine
	);

	debug('Related check', {
		momentFile: moment.filePath,
		momentTitle: moment.title,
		headingLine: moment.headingLine,
		endLine,
		targetBasename: relationInfo.basename,
		targetPath: relationInfo.filePath,
		totalLinksInFile: links.length,
		linksInRange: linksInRange.map((l) => ({
			link: l.link,
			line: l.position.start.line,
		})),
		headingsInFile: headings.map((h) => ({
			heading: h.heading,
			line: h.position.start.line,
			level: h.level,
		})),
	});

	if (hasMatchingLinkInRange(cache, relationInfo, app, moment.filePath, moment.headingLine, endLine) ||
		hasMatchingTagInRange(cache, relationInfo, moment.headingLine, endLine)) {
		return true;
	}

	// Fallback: Obsidian's metadataCache may not include wikilinks embedded in
	// heading text in cache.links. The heading text has brackets stripped, so
	// [[Steve Cummings]] becomes "Steve Cummings". Check if the heading text
	// mentions the target AND the file has a confirmed resolved link to the target.
	return hasHeadingMentionWithResolvedLink(headings, moment.headingLine, relationInfo, app, moment.filePath);
}

/**
 * Filter an array of moments to only those related to the target file.
 * Excludes moments that are FROM the target file itself.
 */
export function findRelatedMoments(
	app: App,
	moments: Moment[],
	targetFile: TFile
): Moment[] {
	const relationInfo = getFileRelationInfo(app, targetFile);

	return moments.filter((moment) => {
		// Exclude moments from the target file itself
		if (moment.filePath === targetFile.path) {
			return false;
		}
		return isMomentRelatedToFile(app, moment, relationInfo);
	});
}

/**
 * Check if a file has links to or from the target file using resolvedLinks.
 * This is efficient for filtering implicit moments since it uses Obsidian's
 * pre-computed link index rather than scanning metadata cache per-file.
 */
export function isFileRelatedByLinks(
	app: App,
	filePath: string,
	targetFilePath: string
): boolean {
	const resolved = app.metadataCache.resolvedLinks;

	// Forward: file links to target
	const fileLinks = resolved[filePath];
	if (fileLinks && fileLinks[targetFilePath]) {
		return true;
	}

	// Backward: target links to file
	const targetLinks = resolved[targetFilePath];
	if (targetLinks && targetLinks[filePath]) {
		return true;
	}

	return false;
}

/**
 * Check if the file's cache contains a link to the target file (whole file).
 */
function hasMatchingLink(
	cache: CachedMetadata,
	relationInfo: FileRelationInfo,
	app: App,
	sourcePath: string
): boolean {
	const links = cache.links ?? [];
	for (const link of links) {
		if (isLinkToTarget(link.link, relationInfo, app, sourcePath)) {
			return true;
		}
	}

	const embeds = cache.embeds ?? [];
	for (const embed of embeds) {
		if (isLinkToTarget(embed.link, relationInfo, app, sourcePath)) {
			return true;
		}
	}

	return false;
}

/**
 * Check if the file's cache contains a link to the target file within a line range.
 */
function hasMatchingLinkInRange(
	cache: CachedMetadata,
	relationInfo: FileRelationInfo,
	app: App,
	sourcePath: string,
	startLine: number,
	endLine: number
): boolean {
	const links = cache.links ?? [];
	for (const link of links) {
		const line = link.position.start.line;
		if (line >= startLine && line < endLine) {
			if (isLinkToTarget(link.link, relationInfo, app, sourcePath)) {
				return true;
			}
		}
	}

	const embeds = cache.embeds ?? [];
	for (const embed of embeds) {
		const line = embed.position.start.line;
		if (line >= startLine && line < endLine) {
			if (isLinkToTarget(embed.link, relationInfo, app, sourcePath)) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Check if a link destination resolves to the target file.
 */
function isLinkToTarget(
	linkDest: string,
	relationInfo: FileRelationInfo,
	app: App,
	sourcePath: string
): boolean {
	// Strip any heading/block references from the link
	const cleanLink = linkDest.split('#')[0]!.split('|')[0]!;
	if (!cleanLink) return false;

	// Use Obsidian's resolver to find the actual target file
	const resolved = app.metadataCache.getFirstLinkpathDest(cleanLink, sourcePath);
	if (resolved && resolved.path === relationInfo.filePath) {
		return true;
	}

	return false;
}

/**
 * Check if the file's cache contains a tag matching an alias (whole file).
 */
function hasMatchingTag(
	cache: CachedMetadata,
	relationInfo: FileRelationInfo
): boolean {
	const tags = cache.tags ?? [];
	const basenameTag = relationInfo.basename.toLowerCase();

	for (const tagCache of tags) {
		// Tags in cache include the #, e.g. "#projects"
		const tagName = tagCache.tag.slice(1).toLowerCase();
		if (tagName === basenameTag || relationInfo.aliases.includes(tagName)) {
			return true;
		}
	}

	return false;
}

/**
 * Check if the file's cache contains a tag matching an alias within a line range.
 */
function hasMatchingTagInRange(
	cache: CachedMetadata,
	relationInfo: FileRelationInfo,
	startLine: number,
	endLine: number
): boolean {
	const tags = cache.tags ?? [];
	const basenameTag = relationInfo.basename.toLowerCase();

	for (const tagCache of tags) {
		const line = tagCache.position.start.line;
		if (line >= startLine && line < endLine) {
			const tagName = tagCache.tag.slice(1).toLowerCase();
			if (tagName === basenameTag || relationInfo.aliases.includes(tagName)) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Fallback for detecting related wikilinks in heading text.
 *
 * Obsidian's metadataCache strips [[]] brackets from heading text and may not
 * include heading-embedded wikilinks in cache.links. This checks whether:
 * 1. The heading text contains the target's basename or alias
 * 2. The file has a confirmed resolved link to the target file
 *
 * Both conditions must be true, ensuring we only match actual wikilinks.
 */
function hasHeadingMentionWithResolvedLink(
	headings: HeadingCache[],
	headingLine: number,
	relationInfo: FileRelationInfo,
	app: App,
	sourcePath: string
): boolean {
	// Verify the file has a resolved link to the target
	const resolved = app.metadataCache.resolvedLinks;
	const fileLinks = resolved[sourcePath];
	if (!fileLinks || !fileLinks[relationInfo.filePath]) {
		return false;
	}

	// Find the heading on this line
	const heading = headings.find((h) => h.position.start.line === headingLine);
	if (!heading) {
		return false;
	}

	const headingText = heading.heading.toLowerCase();
	const basename = relationInfo.basename.toLowerCase();

	if (headingText.includes(basename)) {
		debug('Related: heading text fallback matched basename', {
			heading: heading.heading,
			basename: relationInfo.basename,
		});
		return true;
	}

	for (const alias of relationInfo.aliases) {
		if (headingText.includes(alias)) {
			debug('Related: heading text fallback matched alias', {
				heading: heading.heading,
				alias,
			});
			return true;
		}
	}

	return false;
}

/**
 * Buffer added to the furthest known cache position when estimating total lines.
 * Content may exist beyond the last cached metadata item (e.g. plain text at the
 * end of a file with no headings, links, or tags). 1000 lines is a generous upper
 * bound that avoids prematurely cutting off inline moment sections.
 */
const END_OF_FILE_BUFFER = 1000;

/**
 * Estimate the total number of lines in a file from its metadata cache.
 * Uses the furthest position found in any cache item.
 */
function estimateTotalLines(cache: CachedMetadata): number {
	let maxLine = 0;

	for (const heading of cache.headings ?? []) {
		if (heading.position.end.line > maxLine) {
			maxLine = heading.position.end.line;
		}
	}
	for (const link of cache.links ?? []) {
		if (link.position.end.line > maxLine) {
			maxLine = link.position.end.line;
		}
	}
	for (const tag of cache.tags ?? []) {
		if (tag.position.end.line > maxLine) {
			maxLine = tag.position.end.line;
		}
	}
	for (const section of cache.sections ?? []) {
		if (section.position.end.line > maxLine) {
			maxLine = section.position.end.line;
		}
	}

	return maxLine + END_OF_FILE_BUFFER;
}
