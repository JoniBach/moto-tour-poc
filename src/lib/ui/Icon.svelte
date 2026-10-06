<!--
  A Postcard icon (@jonibach/postcard/icons): a 24px line drawing in the text colour, sized to the
  text. Decorative by default; give the button or link around it the label.
  <Icon name="globe" />   <Icon name="book" size="lg" />
-->
<script lang="ts">
	import sprite from '@jonibach/postcard/icons/icons.svg?url';

	let { name, size }: { name: string; size?: 'sm' | 'lg' } = $props();
</script>

<svg class="pc-icon" class:pc-icon--sm={size === 'sm'} class:pc-icon--lg={size === 'lg'} aria-hidden="true"><use href="{sprite}#pc-{name}" /></svg>
