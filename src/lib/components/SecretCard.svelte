<script lang="ts">
	import { flagEmoji } from '$lib/flags';

	interface Props {
		name: string;
		photoKey: string;
		position?: string | null;
		nationality?: string | null;
		accent?: 'lime' | 'orange';
	}

	let { name, photoKey, position = null, nationality = null, accent = 'lime' }: Props = $props();

	const ring = $derived(accent === 'lime' ? 'rgba(198,255,58,.3)' : 'rgba(255,122,26,.4)');
	const badge = $derived(accent === 'lime' ? 'bg-lime text-ink' : 'bg-orange text-white');
</script>

<div
	class="relative h-[248px] w-[178px] overflow-hidden rounded-[18px]"
	style="background:radial-gradient(75% 55% at 50% 32%, #20402f, #081710 72%);border:1.5px solid {ring};box-shadow:0 16px 40px rgba(0,0,0,.5)"
>
	<img
		src="/img/{photoKey}"
		alt={name}
		width="178"
		height="248"
		class="absolute inset-0 h-full w-full object-cover opacity-90"
	/>
	{#if position}
		<span
			class="font-display absolute top-2.5 left-2.5 z-[3] rounded-md px-1.5 py-0.5 text-xs font-extrabold {badge}"
			>{position}</span
		>
	{/if}
	<span class="absolute top-3 right-3 z-[3] text-[22px]" aria-hidden="true"
		>{flagEmoji(nationality)}</span
	>
	<div
		class="absolute right-0 bottom-0 left-0 z-[4] px-3.5 pt-7 pb-3"
		style="background:linear-gradient(0deg,rgba(4,13,9,.96),transparent)"
	>
		<div class="font-display text-xl leading-none font-black text-white">{name}</div>
		{#if nationality}
			<div class="mt-0.5 text-[11px] text-mut">{nationality}</div>
		{/if}
	</div>
</div>
