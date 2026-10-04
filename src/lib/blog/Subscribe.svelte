<!--
  The mailing list's sign-up: an email field that posts straight to Buttondown (no script, so it
  works before or without JavaScript, and the Content Security Policy allows only that one
  address: vite.config.ts form-action). Buttondown asks for a confirmation click (double opt-in),
  then sends every new story from the RSS feed. "card" for the blog's front page and the end of a
  story; "line" for the footer. Nothing without the tour config's newsletter or the flag.
-->
<script lang="ts">
	import { base } from '$app/paths';
	import { on } from '$lib/flags';
	import { TOUR } from '$lib/tourConfig';

	let { variant = 'card' }: { variant?: 'card' | 'line' } = $props();

	const name = TOUR.newsletter?.buttondown;
	const id = $props.id();
</script>

{#if name && on('newsletter')}
	<form class="subscribe {variant}" action="https://buttondown.com/api/emails/embed-subscribe/{name}" method="post" aria-labelledby="{id}-h">
		{#if variant === 'card'}
			<h2 id="{id}-h">Get the next story by email</h2>
			<p class="why">One email when a new story goes out, nothing else.</p>
		{:else}
			<p id="{id}-h" class="why"><strong>New stories by email</strong></p>
		{/if}
		<div class="row">
			<label class="sr" for="{id}-email">Your email address</label>
			<input id="{id}-email" type="email" name="email" required autocomplete="email" placeholder="you@example.com" />
			<input type="hidden" name="embed" value="1" />
			<button type="submit">Subscribe</button>
		</div>
		<p class="small">
			You’ll get an email to confirm. Your address is kept by <a href="https://buttondown.com/legal/privacy">Buttondown</a>, used
			only for these emails, and every email has a link to unsubscribe. Or follow by <a href="{base}/blog/feed.xml" type="application/rss+xml">RSS</a>.
		</p>
	</form>
{/if}

<style>
	.subscribe {
		color: var(--b-text);
	}
	.card {
		margin: 2.5rem 0 0;
		padding: 1.25rem 1.25rem 1rem;
		background: var(--b-card);
		border: 1px solid var(--b-line);
		border-radius: 1rem;
	}
	h2 {
		margin: 0 0 0.25rem;
		font-family: var(--font-display, inherit);
		font-size: 1.35rem;
	}
	.why {
		margin: 0 0 0.75rem;
	}
	.row {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	input[type='email'] {
		flex: 1 1 14rem;
		min-width: 0;
		min-height: 2.75rem;
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
	button {
		min-height: 2.75rem;
		padding: 0 1.1rem;
		font: inherit;
		font-weight: 600;
		color: #fff;
		background: var(--b-accent);
		border: 0;
		border-radius: 0.6rem;
		cursor: pointer;
	}
	button:hover {
		filter: brightness(1.15);
	}
	input:focus-visible,
	button:focus-visible {
		outline: 3px solid var(--b-accent);
		outline-offset: 2px;
	}
	.small {
		margin: 0.6rem 0 0;
		font-size: 0.85rem;
		color: var(--b-muted);
	}
	.small a {
		color: inherit;
	}
	.line {
		margin: 0 0 1rem;
		max-width: 36rem;
	}
	.line .why {
		margin-bottom: 0.4rem;
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
