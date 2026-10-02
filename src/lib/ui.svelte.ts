// Layout state for the UI chrome: whether we're on a small screen, and which bottom sheet is
// open there (one at a time). On desktop the panels are always-on floating cards instead.
export type Sheet = 'controls' | 'events' | 'info' | null;

export const MOBILE_QUERY = '(max-width: 900px)';
/** small or short screens: no room for a separate now-playing card above the event banner */
export const COMPACT_QUERY = '(max-width: 900px), (max-height: 820px)';

class Ui {
	mobile = $state(false);
	/** COMPACT_QUERY: the event banner shows the music between events */
	compact = $state(false);
	sheet = $state<Sheet>(null);

	toggle(s: Exclude<Sheet, null>) {
		this.sheet = this.sheet === s ? null : s;
	}

	/** call once on mount: tracks the breakpoint */
	watch() {
		const mq = matchMedia(MOBILE_QUERY);
		const set = () => {
			this.mobile = mq.matches;
			if (!mq.matches) this.sheet = null;
		};
		const cq = matchMedia(COMPACT_QUERY);
		const setCompact = () => (this.compact = cq.matches);
		set();
		setCompact();
		mq.addEventListener('change', set);
		cq.addEventListener('change', setCompact);
		return () => {
			mq.removeEventListener('change', set);
			cq.removeEventListener('change', setCompact);
		};
	}
}

export const ui = new Ui();
