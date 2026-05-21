import {
	renderTemplate,
	buildHeadingString,
	buildFilename,
	evaluateCoreTemplate,
	type TemplateVariables,
} from '../../src/core/template-engine';

describe('renderTemplate', () => {
	it('replaces single variable', () => {
		const result = renderTemplate('Hello {{name}}', { name: 'World' });
		expect(result).toBe('Hello World');
	});

	it('replaces multiple variables', () => {
		const result = renderTemplate('{{greeting}} {{name}}!', {
			greeting: 'Hello',
			name: 'World',
		});
		expect(result).toBe('Hello World!');
	});

	it('replaces same variable multiple times', () => {
		const result = renderTemplate('{{x}} and {{x}}', { x: 'test' });
		expect(result).toBe('test and test');
	});

	it('leaves unknown variables as-is', () => {
		const result = renderTemplate('Hello {{unknown}}', {});
		expect(result).toBe('Hello {{unknown}}');
	});

	it('handles empty template', () => {
		const result = renderTemplate('', { x: 'value' });
		expect(result).toBe('');
	});

	it('handles template with no variables', () => {
		const result = renderTemplate('No variables here', { x: 'value' });
		expect(result).toBe('No variables here');
	});

	it('handles whitespace in variable names', () => {
		// Should NOT match - variables must be alphanumeric
		const result = renderTemplate('{{ date }}', { date: '2026-02-04' });
		expect(result).toBe('{{ date }}');
	});

	it('is case-sensitive for variable names', () => {
		const result = renderTemplate('{{Date}} vs {{date}}', { date: '2026-02-04' });
		expect(result).toBe('{{Date}} vs 2026-02-04');
	});
});

describe('buildHeadingString', () => {
	const defaultVars: TemplateVariables = {
		date: '2026-02-04',
		title: 'Call with Lawyer',
	};

	it('builds heading with default template', () => {
		const result = buildHeadingString(defaultVars, 3);
		expect(result).toBe('### [[2026-02-04]] Call with Lawyer');
	});

	it('builds heading with custom template', () => {
		const result = buildHeadingString(defaultVars, 3, '{{date}} - {{title}}');
		expect(result).toBe('### [[2026-02-04]] - Call with Lawyer');
	});

	it('builds heading with different levels', () => {
		expect(buildHeadingString(defaultVars, 2)).toMatch(/^## /);
		expect(buildHeadingString(defaultVars, 4)).toMatch(/^#### /);
		expect(buildHeadingString(defaultVars, 5)).toMatch(/^##### /);
	});

	it('handles null title', () => {
		const vars: TemplateVariables = { date: '2026-02-04', title: null };
		const result = buildHeadingString(vars, 3);
		expect(result).toBe('### [[2026-02-04]]');
	});

	it('handles title-only template when title is null', () => {
		const vars: TemplateVariables = { date: '2026-02-04', title: null };
		const result = buildHeadingString(vars, 3, '{{title}}');
		expect(result).toBe('### [[2026-02-04]]');
	});

	it('wraps date in wiki-link format', () => {
		const result = buildHeadingString(defaultVars, 3);
		expect(result).toContain('[[2026-02-04]]');
	});

	it('uses plain date when linkDates is false', () => {
		const result = buildHeadingString(defaultVars, 3, '{{date}} {{title}}', false);
		expect(result).toBe('### 2026-02-04 Call with Lawyer');
		expect(result).not.toContain('[[');
	});

	it('handles time variable', () => {
		const vars: TemplateVariables = {
			date: '2026-02-04',
			title: 'Meeting',
			time: '14:30',
		};
		const result = buildHeadingString(vars, 3, '{{date}} {{time}} {{title}}');
		expect(result).toBe('### [[2026-02-04]] 14:30 Meeting');
	});
});

describe('buildFilename', () => {
	const defaultVars: TemplateVariables = {
		date: '2026-02-04',
		title: 'Call with Lawyer',
	};

	it('builds filename with default template', () => {
		const result = buildFilename(defaultVars);
		expect(result).toBe('2026-02-04 - Call with Lawyer.md');
	});

	it('builds filename with custom template', () => {
		const result = buildFilename(defaultVars, '{{date}}_{{title}}');
		expect(result).toBe('2026-02-04_Call with Lawyer.md');
	});

	it('adds .md extension if missing', () => {
		const result = buildFilename(defaultVars, '{{date}} - {{title}}');
		expect(result.endsWith('.md')).toBe(true);
	});

	it('does not double .md extension', () => {
		const result = buildFilename(defaultVars, '{{date}} - {{title}}.md');
		expect(result).toBe('2026-02-04 - Call with Lawyer.md');
		expect(result).not.toContain('.md.md');
	});

	it('sanitizes filename - removes illegal characters', () => {
		const vars: TemplateVariables = {
			date: '2026-02-04',
			title: 'Meeting: Q&A / Notes',
		};
		const result = buildFilename(vars);
		// Colons, slashes should be removed or replaced
		expect(result).not.toContain(':');
		expect(result).not.toContain('/');
	});

	it('handles null title', () => {
		const vars: TemplateVariables = { date: '2026-02-04', title: null };
		const result = buildFilename(vars);
		expect(result).toBe('2026-02-04.md');
	});
});

describe('evaluateCoreTemplate', () => {
	const now = new Date('2026-02-04T14:30:00');
	const opts = {
		title: 'My Note',
		dateFormat: 'YYYY-MM-DD',
		timeFormat: 'HH:mm',
		now,
	};

	it('replaces {{title}} with the note title', () => {
		expect(evaluateCoreTemplate('# {{title}}', opts)).toBe('# My Note');
	});

	it('replaces {{date}} using the default date format', () => {
		expect(evaluateCoreTemplate('{{date}}', opts)).toBe('2026-02-04');
	});

	it('replaces {{time}} using the default time format', () => {
		expect(evaluateCoreTemplate('{{time}}', opts)).toBe('14:30');
	});

	it('replaces {{date:FORMAT}} with the inline format', () => {
		expect(evaluateCoreTemplate('{{date:YYYY}}', opts)).toBe('2026');
	});

	it('replaces {{time:FORMAT}} with the inline format', () => {
		expect(evaluateCoreTemplate('{{time:HH}}', opts)).toBe('14');
	});

	it('replaces multiple placeholders in one template', () => {
		const result = evaluateCoreTemplate('{{title}} — {{date}} {{time}}', opts);
		expect(result).toBe('My Note — 2026-02-04 14:30');
	});

	it('leaves unknown placeholders untouched', () => {
		expect(evaluateCoreTemplate('{{foo}}', opts)).toBe('{{foo}}');
	});

	it('repeats the same placeholder', () => {
		expect(evaluateCoreTemplate('{{title}} {{title}}', opts)).toBe('My Note My Note');
	});
});
