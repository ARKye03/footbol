<script lang="ts">
	import { resolve } from '$app/paths';
	import LangSwitcher from '$lib/components/LangSwitcher.svelte';
	import * as m from '$lib/paraglide/messages';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children, data } = $props();

	const identity = $derived(data.identity);
	const initial = $derived((identity?.name?.trim()?.[0] ?? 'G').toUpperCase());
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="relative min-h-screen overflow-x-hidden bg-pitch text-cloud">
	<!-- background FX -->
	<div
		aria-hidden="true"
		class="pointer-events-none fixed inset-0 z-0"
		style="background:radial-gradient(120% 80% at 50% -20%, rgba(198,255,58,0.10), transparent 55%), radial-gradient(80% 60% at 85% 110%, rgba(255,122,26,0.07), transparent 60%);animation:flood 9s ease-in-out infinite"
	></div>
	<div
		aria-hidden="true"
		class="pointer-events-none fixed inset-0 z-0 opacity-50"
		style="background-image:repeating-linear-gradient(90deg, transparent 0 119px, rgba(255,255,255,0.025) 119px 120px)"
	></div>

	<header
		class="relative z-20 mx-auto flex max-w-[1320px] items-center justify-between px-5 py-4 sm:px-7"
	>
		<a href={resolve('/')} class="flex items-center gap-3">
			<span
				class="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-lime"
				style="box-shadow:0 0 18px rgba(198,255,58,.45)"
			>
				<span
					class="h-[18px] w-[18px] rounded-full"
					style="background:conic-gradient(#0a1f08 0 25%, transparent 0 50%, #0a1f08 0 75%, transparent 0)"
				></span>
			</span>
			<span class="font-display text-[26px] font-black tracking-tight text-cloud"
				>{m.app_title()}</span
			>
		</a>

		<div class="flex items-center gap-2.5">
			<LangSwitcher />
			{#if identity?.guest}
				<a
					href={resolve('/login')}
					class="flex items-center gap-2 rounded-full bg-white/[0.06] py-1.5 pr-3 pl-2 transition hover:bg-white/10"
				>
					<span
						class="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold text-lime"
						style="background:linear-gradient(135deg,#1d4a39,#0c2a20)">{initial}</span
					>
					<span class="text-[13px] font-semibold text-fog">{m.header_guest()}</span>
				</a>
			{:else}
				<div class="flex items-center gap-2 rounded-full bg-white/[0.06] py-1.5 pr-3 pl-2">
					<span
						class="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold text-ink"
						style="background:linear-gradient(135deg,#c6ff3a,#7fae1f)">{initial}</span
					>
					<span class="text-[13px] font-semibold text-fog">{identity?.name}</span>
				</div>
			{/if}
		</div>
	</header>

	{@render children()}
</div>
