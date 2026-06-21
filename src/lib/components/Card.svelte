<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { flagEmoji } from '$lib/flags';

	interface Props {
		name: string;
		photoKey: string;
		position?: string | null;
		nationality?: string | null;
		down?: boolean;
		guessing?: boolean;
		onActivate: () => void;
	}

	let {
		name,
		photoKey,
		position = null,
		nationality = null,
		down = false,
		guessing = false,
		onActivate
	}: Props = $props();

	const label = $derived(
		guessing ? m.card_guess({ name }) : down ? m.card_flip_up({ name }) : m.card_flip_down({ name })
	);
	const flag = $derived(flagEmoji(nationality));
</script>

<button
	type="button"
	aria-label={label}
	aria-pressed={guessing ? undefined : down}
	data-testid="card"
	onclick={onActivate}
	class="group relative block w-full cursor-pointer rounded-[13px] transition focus:outline-none focus-visible:ring-[3px] focus-visible:ring-lime"
>
	<div
		class="overflow-hidden rounded-[13px] border-[1.5px] border-white/[0.08] bg-panel2"
		style="box-shadow:0 4px 12px rgba(0,0,0,.3)"
	>
		<div class="relative aspect-square">
			<img
				src="/img/{photoKey}"
				alt={name}
				width="128"
				height="128"
				loading="lazy"
				class="h-full w-full object-cover"
			/>
			{#if position}
				<span
					class="font-display absolute top-1.5 left-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-extrabold tracking-wide text-lime"
					>{position}</span
				>
			{/if}
		</div>
		<div class="flex items-center justify-between gap-1 px-2 py-1.5">
			<span class="truncate text-[12.5px] font-bold">{name}</span>
			<span class="text-[13px]" aria-hidden="true">{flag}</span>
		</div>
	</div>

	{#if down && !guessing}
		<div
			class="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-[13px] border-[1.5px] border-white/[0.06]"
			style="background:linear-gradient(rgba(6,16,11,.86),rgba(6,16,11,.86)),repeating-linear-gradient(45deg,#0a1c15 0 8px,#0c2018 8px 16px)"
			aria-hidden="true"
		>
			<span
				class="flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-[#7f9a89] text-[17px] font-extrabold text-[#7f9a89]"
				>✕</span
			>
			<span class="text-[10.5px] font-extrabold tracking-[0.12em] text-[#7f9a89] uppercase"
				>{m.card_out()}</span
			>
			<span class="max-w-[84%] truncate text-[10px] text-mut3 line-through">{name}</span>
		</div>
	{/if}

	{#if guessing}
		<div
			class="pointer-events-none absolute -inset-0.5 rounded-[15px] border-[2.5px] border-orange"
			style="box-shadow:0 0 14px rgba(255,122,26,.4)"
			aria-hidden="true"
		></div>
	{/if}
</button>
