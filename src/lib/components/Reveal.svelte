<script lang="ts">
	import { onMount } from 'svelte';
	import * as m from '$lib/paraglide/messages';
	import { flagEmoji } from '$lib/flags';

	interface Props {
		name: string;
		photoKey: string;
		position?: string | null;
		nationality?: string | null;
		kicker: string;
		closeLabel: string;
		onClose: () => void;
	}

	let {
		name,
		photoKey,
		position = null,
		nationality = null,
		kicker,
		closeLabel,
		onClose
	}: Props = $props();

	let stage = $state(0);
	const done = $derived(stage >= 5);
	let timers: ReturnType<typeof setTimeout>[] = [];

	const clear = () => {
		timers.forEach(clearTimeout);
		timers = [];
	};

	onMount(() => {
		const reduce =
			typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reduce) {
			stage = 5;
		} else {
			[1, 2, 3, 4, 5].forEach((st, i) =>
				timers.push(setTimeout(() => (stage = st), 520 * (i + 1)))
			);
		}
		return clear;
	});

	function advance() {
		clear();
		stage = Math.min(5, stage + 1);
	}
	function skip() {
		clear();
		stage = 5;
	}

	const at = (n: number) => `opacity:${stage >= n ? 1 : 0};transition:opacity .5s ease`;
</script>

<div
	class="fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center overflow-hidden p-6"
	style="background:radial-gradient(60% 70% at 50% 8%, rgba(198,255,58,.16), transparent 55%), #050d09"
	role="presentation"
	onclick={advance}
>
	<div class="mb-4 text-[13px] font-bold tracking-[0.2em] text-[#7f9a89] uppercase">{kicker}</div>

	<div
		class="relative h-[420px] w-[300px] overflow-hidden rounded-[22px]"
		style="background:radial-gradient(75% 55% at 50% 32%, #20402f, #081710 72%);border:1.5px solid rgba(198,255,58,.25);box-shadow:0 30px 90px rgba(0,0,0,.6)"
	>
		<img
			src="/img/{photoKey}"
			alt={name}
			width="300"
			height="420"
			class="absolute inset-0 h-full w-full object-cover"
		/>
		<!-- silhouette veil lifts at the final stage -->
		<div
			class="absolute inset-0"
			style="background:#04100a;opacity:{stage >= 5 ? 0 : 0.92};transition:opacity .5s ease"
			aria-hidden="true"
		></div>

		{#if position}
			<div class="absolute top-3.5 left-3.5 z-[3] text-center" style={at(2)}>
				<div
					class="font-display inline-block rounded-md bg-lime px-2 py-0.5 text-[15px] font-extrabold text-ink"
				>
					{position}
				</div>
			</div>
		{/if}
		<div class="absolute top-4 right-4 z-[3]" style={at(3)}>
			<span class="text-[30px]" aria-hidden="true">{flagEmoji(nationality)}</span>
		</div>

		<div
			class="pointer-events-none absolute inset-0 rounded-[22px]"
			style="box-shadow:inset 0 0 0 2px rgba(198,255,58,.6), 0 0 60px rgba(198,255,58,.35);{at(5)}"
			aria-hidden="true"
		></div>

		<div
			class="absolute right-0 bottom-0 left-0 z-[4] px-4 pt-7 pb-4"
			style="background:linear-gradient(0deg,rgba(4,13,9,.95),transparent)"
		>
			<div class="font-display text-[30px] leading-none font-black text-white" style={at(4)}>
				{name}
			</div>
			{#if nationality}
				<div class="mt-0.5 text-[13px] font-semibold text-mut" style={at(4)}>{nationality}</div>
			{/if}
		</div>
	</div>

	<div class="mt-5 flex gap-1.5">
		{#each [1, 2, 3, 4, 5] as n (n)}
			<span
				class="h-2 rounded-full transition-all"
				style="width:{stage >= n ? 22 : 8}px;background:{stage >= n
					? '#c6ff3a'
					: 'rgba(255,255,255,.18)'}"
			></span>
		{/each}
	</div>

	<div class="mt-5 flex gap-3">
		<button
			type="button"
			onclick={(e) => {
				e.stopPropagation();
				skip();
			}}
			class="rounded-[11px] border border-white/[0.18] bg-white/[0.08] px-5.5 py-2.75 text-sm font-bold text-fog transition hover:bg-white/15"
			style="padding-left:22px;padding-right:22px;padding-top:11px;padding-bottom:11px"
			>{m.reveal_skip()}</button
		>
		{#if done}
			<button
				type="button"
				onclick={(e) => {
					e.stopPropagation();
					onClose();
				}}
				class="rounded-[11px] bg-lime px-6.5 py-2.75 text-sm font-extrabold text-ink transition hover:brightness-105"
				style="padding-left:26px;padding-right:26px;padding-top:11px;padding-bottom:11px"
				>{closeLabel}</button
			>
		{/if}
	</div>
	<div class="mt-3.5 text-xs text-mut3">{m.reveal_tap()}</div>
</div>
