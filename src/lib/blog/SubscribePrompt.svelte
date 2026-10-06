<!--
  The mailing list, offered once to new visitors on any page (the globe, the map, the blog): a
  modal over a blurred page, a few seconds after they arrive. Its answer is remembered in this
  browser (src/lib/newsletter.ts): "Yes, subscribe" posts the email to Buttondown in a new tab (the
  tour stays where it was) and never asks again; "Maybe later" (or Esc, or ×) waits a few days;
  "No thanks" a couple of months. Subscribing with any form on the site counts as yes.
  Not on the story editor, nor the page people land on after confirming.
-->
<script lang="ts">
	import Icon from '$lib/ui/Icon.svelte';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { on } from '$lib/flags';
	import { count, remember, shouldAsk, type Answer } from '$lib/newsletter';
	import { TOUR } from '$lib/tourConfig';

	/** how long a new visitor looks around before being asked */
	const DELAY_MS = 8000;

	const name = TOUR.newsletter?.buttondown;
	let dialog = $state<HTMLDialogElement>();
	let sent = $state(false);

	const quiet = $derived(/\/(wysiwyg|blog\/subscribed)\/?$/.test(page.url.pathname));

	$effect(() => {
		if (!name || !on('newsletter') || quiet || !shouldAsk()) return;
		const timer = setTimeout(() => {
			// not over another modal, and not if they've answered in another tab meanwhile
			if (!document.querySelector('dialog[open]') && shouldAsk()) {
				dialog?.showModal();
				count('shown');
			}
		}, DELAY_MS);
		return () => clearTimeout(timer);
	});

	function answer(a: Answer, via: '' | '-x' | '-esc' = '') {
		remember(a);
		count(a === 'later' ? `later${via}` : a);
		dialog?.close();
	}
	function subscribed() {
		// the form goes on to Buttondown in a new tab; this one says what happens next
		remember('yes');
		count('yes');
		// after the browser has sent it: a form taken out of the page mid-submit is never sent
		setTimeout(() => (sent = true));
	}
</script>

{#if name && on('newsletter')}
	<!-- Esc is "maybe later" -->
	<dialog
		bind:this={dialog}
		class="pc-dialog prompt"
		aria-labelledby="nl-h"
		aria-describedby="nl-why"
		oncancel={(e) => {
			e.preventDefault();
			answer('later', '-esc');
		}}
	>
		<button class="pc-icon-button pc-dialog__close" type="button" aria-label="Close (maybe later)" onclick={() => (sent ? dialog?.close() : answer('later', '-x'))}><Icon name="close" /></button>
		{#if !sent}
			<p class="pc-eyebrow">{TOUR.name} · {TOUR.when}</p>
			<!-- svelte-ignore a11y_autofocus -->
			<h2 class="pc-h3" id="nl-h" tabindex="-1" autofocus>Follow the trip by email?</h2>
			<p id="nl-why">
				Each new story from {TOUR.title.replace(/^A /, 'a ')}, sent to your inbox as it goes out. One email per story, nothing else.
			</p>
			<form action="https://buttondown.com/api/emails/embed-subscribe/{name}" method="post" target="_blank" onsubmit={subscribed}>
				<div class="pc-field">
					<label class="pc-field__label" for="nl-email">Your email address</label>
					<input class="pc-input" id="nl-email" type="email" name="email" required autocomplete="email" placeholder="you@example.com" />
				</div>
				<input type="hidden" name="embed" value="1" />
				<div class="pc-dialog__actions">
					<button type="submit" class="pc-button pc-button--primary yes">Yes, subscribe</button>
					<button type="button" class="pc-button" onclick={() => answer('later')}>Maybe later</button>
					<button type="button" class="pc-button pc-button--ghost" onclick={() => answer('no')}>No thanks</button>
				</div>
			</form>
			<p class="pc-small small">
				You’ll get an email to confirm. Your address is kept by <a href="https://buttondown.com/legal/privacy">Buttondown</a>, used
				only for these emails, and every email has a link to unsubscribe. Prefer a feed reader? <a href="{base}/blog/feed.xml">RSS</a>.
			</p>
		{:else}
			<h2 class="pc-h3" id="nl-h">Check your inbox</h2>
			<p id="nl-why">Buttondown has opened in a new tab. Click the link in the email it sends you to confirm, and the next story will come to you.</p>
			<div class="pc-dialog__actions">
				<button type="button" class="pc-button pc-button--primary" onclick={() => dialog?.close()}>Back to the trip</button>
			</div>
		{/if}
	</dialog>
{/if}

<style>
	/* Postcard's dialog, fields and buttons; this is only the prompt's own spacing */
	h2 {
		margin: 0 0 0.5rem;
	}
	/* focus lands on the heading when the prompt opens, so it's read first; no ring for that */
	h2:focus {
		outline: none;
	}
	p {
		margin: 0 0 0.9rem;
	}
	/* yes on a row of its own; later and no share the next */
	.yes {
		flex-basis: 100%;
	}
	.small {
		margin: 0.9rem 0 0;
	}
	.small a {
		color: inherit;
	}
</style>
