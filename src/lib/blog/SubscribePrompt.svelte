<!--
  The mailing list, offered once to new visitors on any page (the globe, the map, the blog): a
  modal over a blurred page, a few seconds after they arrive. Its answer is remembered in this
  browser (src/lib/newsletter.ts): "Yes, subscribe" posts the email to Buttondown in a new tab (the
  tour stays where it was) and never asks again; "Maybe later" (or Esc, or ×) waits a few days;
  "No thanks" a couple of months. Subscribing with any form on the site counts as yes.
  Not on the story editor, nor the page people land on after confirming.
-->
<script lang="ts">
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
		class="prompt blog-palette"
		aria-labelledby="nl-h"
		aria-describedby="nl-why"
		oncancel={(e) => {
			e.preventDefault();
			answer('later', '-esc');
		}}
	>
		<button class="x" type="button" aria-label="Close (maybe later)" onclick={() => (sent ? dialog?.close() : answer('later', '-x'))}>×</button>
		{#if !sent}
			<p class="eyebrow">{TOUR.name} · {TOUR.when}</p>
			<!-- svelte-ignore a11y_autofocus -->
			<h2 id="nl-h" tabindex="-1" autofocus>Follow the trip by email?</h2>
			<p id="nl-why">
				Each new story from {TOUR.title.replace(/^A /, 'a ')}, sent to your inbox as it goes out. One email per story, nothing else.
			</p>
			<form action="https://buttondown.com/api/emails/embed-subscribe/{name}" method="post" target="_blank" onsubmit={subscribed}>
				<label for="nl-email">Your email address</label>
				<input id="nl-email" type="email" name="email" required autocomplete="email" placeholder="you@example.com" />
				<input type="hidden" name="embed" value="1" />
				<div class="actions">
					<button type="submit" class="yes">Yes, subscribe</button>
					<button type="button" onclick={() => answer('later')}>Maybe later</button>
					<button type="button" onclick={() => answer('no')}>No thanks</button>
				</div>
			</form>
			<p class="small">
				You’ll get an email to confirm. Your address is kept by <a href="https://buttondown.com/legal/privacy">Buttondown</a>, used
				only for these emails, and every email has a link to unsubscribe. Prefer a feed reader? <a href="{base}/blog/feed.xml">RSS</a>.
			</p>
		{:else}
			<h2 id="nl-h">Check your inbox</h2>
			<p id="nl-why">Buttondown has opened in a new tab. Click the link in the email it sends you to confirm, and the next story will come to you.</p>
			<div class="actions">
				<button type="button" class="yes" onclick={() => dialog?.close()}>Back to the trip</button>
			</div>
		{/if}
	</dialog>
{/if}

<style>
	.prompt {
		box-sizing: border-box;
		width: min(30rem, calc(100vw - 2rem));
		max-height: calc(100dvh - 2rem);
		overflow: auto;
		margin: auto;
		padding: 1.6rem 1.5rem 1.2rem;
		color: var(--b-text);
		background: var(--b-card);
		border: 1px solid var(--b-line);
		border-radius: 1.25rem;
		box-shadow: 0 24px 60px rgb(38 50 56 / 0.28);
		font-family: var(--font-ui);
		font-size: 1rem;
		line-height: 1.5;
	}
	/* the page behind, softened */
	.prompt::backdrop {
		background: rgb(38 50 56 / 0.25);
		backdrop-filter: blur(8px) saturate(0.9);
		-webkit-backdrop-filter: blur(8px) saturate(0.9);
	}
	.prompt[open] {
		animation: rise 0.25s ease-out;
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.prompt[open] {
			animation: none;
		}
	}
	.x {
		position: absolute;
		top: 0.6rem;
		right: 0.6rem;
		width: 2.5rem;
		height: 2.5rem;
		font-size: 1.5rem;
		line-height: 1;
		color: var(--b-muted);
		background: none;
		border: 0;
		border-radius: 50%;
		cursor: pointer;
	}
	.x:hover {
		background: var(--b-bg);
	}
	.eyebrow {
		margin: 0 0 0.3rem;
		font-size: 0.78rem;
		font-weight: 750;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--b-muted);
	}
	h2 {
		outline: none;
		margin: 0 2rem 0.5rem 0;
		font-family: var(--font-display);
		font-size: 1.6rem;
		line-height: 1.2;
	}
	p {
		margin: 0 0 1rem;
	}
	label {
		display: block;
		margin-bottom: 0.3rem;
		font-weight: 600;
	}
	input[type='email'] {
		box-sizing: border-box;
		width: 100%;
		min-height: 2.9rem;
		padding: 0 0.85rem;
		font: inherit;
		color: var(--b-text);
		background: #fff;
		border: 1px solid var(--b-line-strong);
		border-radius: 0.6rem;
	}
	input[type='email']::placeholder {
		color: var(--b-muted);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 0.9rem 0 0.2rem;
	}
	.actions button {
		flex: 1 1 auto;
		min-height: 2.75rem;
		padding: 0 1rem;
		font: inherit;
		font-weight: 600;
		color: var(--b-text);
		background: var(--b-bg);
		border: 1px solid var(--b-line-strong);
		border-radius: 0.6rem;
		cursor: pointer;
	}
	/* yes on a row of its own; later and no share the next */
	.actions .yes {
		flex-basis: 100%;
		color: #fff;
		background: var(--b-accent);
		border-color: var(--b-accent);
	}
	.actions button:hover {
		filter: brightness(1.08);
	}
	button:focus-visible,
	input:focus-visible,
	a:focus-visible {
		outline: 3px solid var(--b-accent);
		outline-offset: 2px;
	}
	.small {
		margin: 0.9rem 0 0;
		font-size: 0.85rem;
		color: var(--b-muted);
	}
	.small a {
		color: inherit;
	}
</style>
