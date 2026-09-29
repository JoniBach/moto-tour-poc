import type { Attachment } from 'svelte/attachments';

/**
 * For buttons placed in the 3D scene (HTML overlays): {@attach clickThroughControls}.
 * The orbit controls listen on the scene's wrapper element, which also contains these overlays,
 * and capture the pointer on pointerdown; that capture swallows the button's click.
 * This has to be a native listener on the button itself: Svelte 5 delegates onpointerdown to
 * the document root, so stopping it there is too late, the controls have already seen it.
 */
export const clickThroughControls: Attachment<HTMLElement> = (el) => {
	const stop = (e: PointerEvent) => e.stopPropagation();
	el.addEventListener('pointerdown', stop);
	return () => el.removeEventListener('pointerdown', stop);
};
