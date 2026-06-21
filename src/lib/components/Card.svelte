<script lang="ts">
	import * as m from '$lib/paraglide/messages';

	interface Props {
		name: string;
		photoKey: string;
		down?: boolean;
		guessing?: boolean;
		onActivate: () => void;
	}

	let { name, photoKey, down = false, guessing = false, onActivate }: Props = $props();

	const label = $derived(
		guessing ? m.card_guess({ name }) : down ? m.card_flip_up({ name }) : m.card_flip_down({ name })
	);
</script>

<button
	type="button"
	aria-label={label}
	aria-pressed={guessing ? undefined : down}
	data-testid="card"
	onclick={onActivate}
	class="group relative flex flex-col overflow-hidden rounded-lg border bg-white text-center shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600
		{guessing ? 'cursor-pointer border-green-600 hover:ring-2 hover:ring-green-600' : 'border-zinc-200'}
		{down ? 'opacity-35 grayscale' : ''}"
>
	<img
		src="/img/{photoKey}"
		alt={name}
		width="128"
		height="128"
		loading="lazy"
		class="aspect-square w-full object-cover"
	/>
	<span class="truncate px-1 py-1 text-[0.7rem] leading-tight font-medium text-zinc-800"
		>{name}</span
	>
	{#if down && !guessing}
		<span class="absolute inset-0 flex items-center justify-center text-2xl" aria-hidden="true"
			>✕</span
		>
	{/if}
</button>
