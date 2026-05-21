import {
	computeTimelineFingerprint,
	timelineRenderDecision,
} from '../../src/core/timeline-fingerprint';
import type {
	TimelineFingerprintInputs,
	TimelineRenderSettings,
} from '../../src/core/timeline-fingerprint';
import type { ImplicitMoment, Moment } from '../../src/types';

function moment(overrides: Partial<Moment> = {}): Moment {
	return {
		type: 'inline',
		date: '2026-05-21',
		title: 'Test',
		filePath: 'note.md',
		firstSeen: 0,
		...overrides,
	};
}

function implicit(overrides: Partial<ImplicitMoment> = {}): ImplicitMoment {
	return {
		filePath: 'note.md',
		fileName: 'note',
		action: 'updated',
		date: '2026-05-21',
		timestamp: 0,
		...overrides,
	};
}

function baseInputs(): TimelineFingerprintInputs {
	return {
		moments: [],
		implicitByDate: new Map(),
		activeFileMomentsByDate: new Map(),
		filter: {
			startDate: null,
			endDate: null,
			searchText: null,
			relatedToFile: null,
		},
		settings: {
			showImplicitMoments: true,
			implicitMomentsStyle: 'summary',
		},
	};
}

describe('computeTimelineFingerprint', () => {
	it('is stable for identical inputs', () => {
		expect(computeTimelineFingerprint(baseInputs())).toBe(
			computeTimelineFingerprint(baseInputs())
		);
	});

	it('changes when implicitMomentsStyle changes (the Summary/Verbose bug)', () => {
		const summary = baseInputs();
		const verbose = baseInputs();
		verbose.settings.implicitMomentsStyle = 'verbose';

		expect(computeTimelineFingerprint(summary)).not.toBe(
			computeTimelineFingerprint(verbose)
		);
	});

	it('changes when showImplicitMoments changes', () => {
		const on = baseInputs();
		const off = baseInputs();
		off.settings.showImplicitMoments = false;

		expect(computeTimelineFingerprint(on)).not.toBe(
			computeTimelineFingerprint(off)
		);
	});

	it('reacts to every render-affecting setting', () => {
		// Guards against a new TimelineRenderSettings field being added
		// without flowing into the fingerprint.
		const base = baseInputs();
		const baseFp = computeTimelineFingerprint(base);
		const keys = Object.keys(
			base.settings
		) as (keyof TimelineRenderSettings)[];

		expect(keys.length).toBeGreaterThan(0);
		for (const key of keys) {
			const flipped = baseInputs();
			const current = base.settings[key];
			flipped.settings[key] = (
				typeof current === 'boolean'
					? !current
					: current === 'summary'
						? 'verbose'
						: 'summary'
			) as never;

			expect(computeTimelineFingerprint(flipped)).not.toBe(baseFp);
		}
	});

	it('changes when a moment is added', () => {
		const empty = baseInputs();
		const withMoment = baseInputs();
		withMoment.moments = [moment()];

		expect(computeTimelineFingerprint(empty)).not.toBe(
			computeTimelineFingerprint(withMoment)
		);
	});

	it('changes when a moment moves to a different heading line', () => {
		const a = baseInputs();
		a.moments = [moment({ headingLine: 3 })];
		const b = baseInputs();
		b.moments = [moment({ headingLine: 9 })];

		expect(computeTimelineFingerprint(a)).not.toBe(
			computeTimelineFingerprint(b)
		);
	});

	it('changes when the implicit moment count for a date changes', () => {
		const one = baseInputs();
		one.implicitByDate = new Map([['2026-05-21', [implicit()]]]);
		const two = baseInputs();
		two.implicitByDate = new Map([
			['2026-05-21', [implicit(), implicit()]],
		]);

		expect(computeTimelineFingerprint(one)).not.toBe(
			computeTimelineFingerprint(two)
		);
	});

	it('changes when the filter changes', () => {
		const unfiltered = baseInputs();
		const filtered = baseInputs();
		filtered.filter.startDate = '2026-05-01';
		filtered.filter.endDate = '2026-05-31';

		expect(computeTimelineFingerprint(unfiltered)).not.toBe(
			computeTimelineFingerprint(filtered)
		);
	});

	it('changes when the active-file indicator changes', () => {
		const without = baseInputs();
		const with_ = baseInputs();
		with_.activeFileMomentsByDate = new Map([['2026-05-21', [moment()]]]);

		expect(computeTimelineFingerprint(without)).not.toBe(
			computeTimelineFingerprint(with_)
		);
	});
});

describe('timelineRenderDecision', () => {
	it('skips the re-render when nothing changed', () => {
		const inputs = baseInputs();
		const fingerprint = computeTimelineFingerprint(inputs);

		const decision = timelineRenderDecision(fingerprint, inputs, false);

		expect(decision.shouldRender).toBe(false);
		expect(decision.fingerprint).toBe(fingerprint);
	});

	it('requires a re-render when implicitMomentsStyle changes', () => {
		const summary = baseInputs();
		const previous = computeTimelineFingerprint(summary);

		const verbose = baseInputs();
		verbose.settings.implicitMomentsStyle = 'verbose';
		const decision = timelineRenderDecision(previous, verbose, false);

		expect(decision.shouldRender).toBe(true);
	});

	it('requires a re-render on the first render (no previous fingerprint)', () => {
		const decision = timelineRenderDecision('', baseInputs(), false);

		expect(decision.shouldRender).toBe(true);
	});

	it('forces a re-render when force is true even if nothing changed', () => {
		const inputs = baseInputs();
		const fingerprint = computeTimelineFingerprint(inputs);

		const decision = timelineRenderDecision(fingerprint, inputs, true);

		expect(decision.shouldRender).toBe(true);
	});
});
