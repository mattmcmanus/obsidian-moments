/**
 * Variables available for template substitution
 */
export interface TemplateVariables {
	/** Date string in configured format (e.g., "2026-02-04") */
	date: string;
	/** Title text, or null if no title */
	title: string | null;
	/** Time string (e.g., "14:30"), optional */
	time?: string;
	/** Combined datetime string, optional */
	datetime?: string;
	/** Allow additional string properties */
	[key: string]: string | null | undefined;
}

/**
 * Default template for inline moment headings
 */
export const DEFAULT_HEADING_TEMPLATE = '{{date}} {{title}}';

/**
 * Default template for standalone moment filenames
 */
export const DEFAULT_FILENAME_TEMPLATE = '{{date}} - {{title}}';

/**
 * Characters that are illegal in filenames across platforms
 */
const ILLEGAL_FILENAME_CHARS = /[<>:"/\\|?*]/g;

/**
 * Render a template string by replacing {{variable}} placeholders.
 *
 * @param template - The template string with {{variable}} placeholders
 * @param variables - Object mapping variable names to values
 * @returns The rendered string
 */
export function renderTemplate(
	template: string,
	variables: Record<string, string | null | undefined>
): string {
	// Match {{variableName}} where variableName is alphanumeric/underscore
	return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
		const value = variables[varName];
		if (value === undefined || value === null) {
			return match; // Leave as-is if not found
		}
		return value;
	});
}

/**
 * Build a complete heading string for an inline moment.
 *
 * @param variables - Template variables (date, title, etc.)
 * @param level - Heading level (2-6)
 * @param template - Template string (default: "{{date}} {{title}}")
 * @param linkDates - Whether to wrap dates in wiki-links (default: true)
 * @returns Complete heading string with # prefix
 */
export function buildHeadingString(
	variables: TemplateVariables,
	level: number,
	template: string = DEFAULT_HEADING_TEMPLATE,
	linkDates: boolean = true
): string {
	const hashes = '#'.repeat(level);

	// Format date with or without wiki-link
	const formattedDate = linkDates ? `[[${variables.date}]]` : variables.date;

	// Build the template variables with formatted date
	const templateVars: Record<string, string | null> = {
		...variables,
		date: formattedDate,
	};

	// Render the template
	let rendered = renderTemplate(template, templateVars);

	// If title is null, clean up the result
	if (variables.title === null) {
		// Remove {{title}} placeholder and clean up whitespace/separators
		rendered = rendered
			.replace(/\{\{title\}\}/g, '')
			.replace(/\s*-\s*$/, '') // Remove trailing " - "
			.replace(/\s+/g, ' ')
			.trim();

		// If only date remains, just use the formatted date
		if (!rendered || rendered === formattedDate) {
			rendered = formattedDate;
		}
	}

	return `${hashes} ${rendered}`;
}

/**
 * Build a filename for a standalone moment.
 *
 * @param variables - Template variables (date, title, etc.)
 * @param template - Template string (default: "{{date}} - {{title}}")
 * @returns Sanitized filename with .md extension
 */
export function buildFilename(
	variables: TemplateVariables,
	template: string = DEFAULT_FILENAME_TEMPLATE
): string {
	// Render the template
	let rendered = renderTemplate(template, variables);

	// If title is null, clean up the result
	if (variables.title === null) {
		rendered = rendered
			.replace(/\{\{title\}\}/g, '')
			.replace(/\s*-\s*$/, '') // Remove trailing " - "
			.replace(/\s+/g, ' ')
			.trim();
	}

	// Sanitize filename - remove illegal characters
	rendered = rendered.replace(ILLEGAL_FILENAME_CHARS, '');

	// Ensure .md extension
	if (!rendered.endsWith('.md')) {
		rendered = `${rendered}.md`;
	}

	return rendered;
}
