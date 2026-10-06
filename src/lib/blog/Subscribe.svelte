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
	import { count, remember } from '$lib/newsletter';
	import { TOUR } from '$lib/tourConfig';

	let { variant = 'card' }: { variant?: 'card' | 'line' } = $props();

	const name = TOUR.newsletter?.buttondown;
	const id = $props.id();
</script>

{#if name && on('newsletter')}
	<form class="subscribe {variant}" class:pc-card={variant === 'card'} action="https://buttondown.com/api/emails/embed-subscribe/{name}" method="post" aria-labelledby="{id}-h" onsubmit={() => {
		remember('yes');
		count('form-yes');
	}}>
		{#if variant === 'card'}
			<h2 class="pc-h3" id="{id}-h">Get the next story by email</h2>
			<p class="why">One email when a new story goes out, nothing else.</p>
		{:else}
			<p id="{id}-h" class="why"><strong>New stories by email</strong></p>
		{/if}
		<div class="pc-inline-form">
			<label class="pc-sr-only" for="{id}-email">Your email address</label>
			<input class="pc-input" id="{id}-email" type="email" name="email" required autocomplete="email" placeholder="you@example.com" />
			<input type="hidden" name="embed" value="1" />
			<button class="pc-button pc-button--primary" type="submit">Subscribe</button>
		</div>
		<p class="pc-small small">
			You’ll get an email to confirm. Your address is kept by <a href="https://buttondown.com/legal/privacy">Buttondown</a>, used
			only for these emails, and every email has a link to unsubscribe. Or follow by <a href="{base}/blog/feed.xml" type="application/rss+xml">RSS</a>.
		</p>
	</form>
{/if}

<style>
	/* the form is Postcard's (a card, an inline field and button); this is only its spacing */
	.subscribe {
		color: var(--pc-ink);
	}
	.card {
		margin: 2.5rem 0 0;
	}
	h2 {
		margin: 0 0 0.25rem;
	}
	.why {
		margin: 0 0 0.75rem;
	}
	.small {
		margin: 0.6rem 0 0;
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
</style>
