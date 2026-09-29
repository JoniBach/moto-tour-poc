// Layout state for the UI chrome: whether we're on a small screen, and which bottom sheet is
// open there (one at a time). On desktop the panels are always-on floating cards instead.
export type Sheet = 'controls' | 'events' | 'info' | null;

export const MOBILE_QUERY = '(max-width: 900px)';

class Ui {
	mobile = $state(false);
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
		set();
		mq.addEventListener('change', set);
		return () => mq.removeEventListener('change', set);
	}
}

export const ui = new Ui();
