import type { Moment, ImplicitMoment, TimelineFilter } from '../types';

/**
 * The subset of plugin settings that changes what the timeline renders.
 *
 * Add any new render-affecting setting here: `computeTimelineFingerprint`
 * serializes this object wholesale, so a new field flows into the fingerprint
 * automatically — there is no second place to remember to update.
 */
export interface TimelineRenderSettings {
	showImplicitMoments: boolean;
	implicitMomentsStyle: 'verbose' | 'summary';
}

/** Everything that determines the rendered timeline output. */
export interface TimelineFingerprintInputs {
	moments: Moment[];
	implicitByDate: Map<string, ImplicitMoment[]>;
	activeFileMomentsByDate: Map<string, Moment[]>;
	filter: TimelineFilter;
	settings: TimelineRenderSettings;
}

/**
 * Serialize the render settings as a stable, sorted `key=value` string so that
 * every field is captured regardless of insertion order.
 */
function serializeSettings(settings: TimelineRenderSettings): string {
	return Object.entries(settings)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, value]) => `${key}=${String(value)}`)
		.join(',');
}

/**
 * Build a string fingerprint of everything that affects the rendered timeline.
 *
 * Two renders with equal fingerprints produce identical output, so the view
 * can safely skip a rebuild when the fingerprint is unchanged.
 */
export function computeTimelineFingerprint(
	inputs: TimelineFingerprintInputs
): string {
	const { moments, implicitByDate, activeFileMomentsByDate, filter, settings } =
		inputs;

	const parts: string[] = [
		String(moments.length),
		serializeSettings(settings),
		filter.startDate ?? '',
		filter.endDate ?? '',
		filter.relatedToFile ?? '',
	];

	for (const m of moments) {
		parts.push(`${m.filePath}:${m.date}:${m.headingLine ?? 's'}`);
	}
	for (const [date, items] of implicitByDate) {
		parts.push(`i:${date}:${items.length}`);
	}
	for (const [date, items] of activeFileMomentsByDate) {
		parts.push(`a:${date}:${items.length}`);
	}

	return parts.join('|');
}

/**
 * Decide whether the timeline must re-render.
 *
 * Returns the freshly computed fingerprint so the caller can store it for the
 * next comparison.
 */
export function timelineRenderDecision(
	previousFingerprint: string | null,
	inputs: TimelineFingerprintInputs,
	force: boolean
): { shouldRender: boolean; fingerprint: string } {
	const fingerprint = computeTimelineFingerprint(inputs);
	return {
		shouldRender: force || fingerprint !== previousFingerprint,
		fingerprint,
	};
}
