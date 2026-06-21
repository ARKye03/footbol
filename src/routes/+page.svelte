<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages';

	let { data, form } = $props();

	// seeded once from server data; the field is then user-editable
	// svelte-ignore state_referenced_locally
	let name = $state(data.name);

	const stats = [
		{ k: 'Played', v: '—' },
		{ k: 'Win %', v: '—' },
		{ k: 'Streak', v: '—' }
	];
</script>

<svelte:head><title>{m.app_title()} — {m.app_tagline()}</title></svelte:head>

<main class="relative z-10 mx-auto max-w-[1180px] px-5 pb-20 sm:px-7">
	<section class="pt-6 pb-8 text-center">
		<div
			class="inline-flex items-center gap-2 rounded-full border border-lime/25 bg-lime/10 px-3.5 py-[7px] text-[12.5px] font-bold tracking-wide text-lime uppercase"
		>
			● {m.home_badge_live()}
		</div>
		<h1
			class="font-display mt-4 mb-2 leading-[0.9] font-black tracking-tight text-[clamp(56px,12vw,104px)]"
		>
			{m.home_hero_a()}<br /><span class="text-lime">{m.home_hero_b()}</span>
		</h1>
		<p class="mx-auto mb-8 max-w-[560px] text-[19px] text-balance text-mut">
			{m.home_hero_tagline()}
		</p>

		<div class="mb-2 flex flex-wrap items-center justify-center gap-2.5">
			<span class="text-sm font-semibold text-mut2">{m.home_playing_as()}</span>
			<input
				bind:value={name}
				name="name"
				form="create-form"
				placeholder={m.home_name_placeholder()}
				maxlength="24"
				aria-label={m.home_name_label()}
				class="w-[220px] rounded-[10px] border-[1.5px] border-white/12 bg-white/[0.06] px-3.5 py-2.5 text-[15px] font-semibold text-white outline-none focus:border-lime/60"
			/>
		</div>
	</section>

	<!-- stats strip (placeholder until accounts track history) -->
	<section
		class="panel mb-7 flex flex-wrap items-center gap-5 rounded-[18px] px-5 py-4.5"
		style="padding-top:18px;padding-bottom:18px"
	>
		<div class="flex items-center gap-3">
			<span
				class="flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-orange/15 text-xl"
				>📈</span
			>
			<div>
				<div class="text-[15px] font-extrabold">{m.home_stats_title()}</div>
				<div class="text-[13px] text-mut2">{m.home_stats_sub()}</div>
			</div>
		</div>
		<div class="ml-auto flex flex-wrap items-center gap-6">
			{#each stats as s (s.k)}
				<div class="text-center opacity-45">
					<div class="font-display text-3xl font-extrabold text-fog">{s.v}</div>
					<div class="text-[11px] tracking-wide text-mut2 uppercase">{s.k}</div>
				</div>
			{/each}
			<a
				href={resolve('/login')}
				class="self-center rounded-[10px] bg-lime px-4.5 py-2.5 text-sm font-extrabold text-ink"
				style="padding-left:18px;padding-right:18px">{m.home_keep_stats()}</a
			>
		</div>
	</section>

	<!-- actions -->
	<section class="grid gap-4.5 md:grid-cols-3" style="gap:18px">
		<!-- single player — stubbed until a CPU opponent exists -->
		<div
			class="panel relative cursor-not-allowed rounded-[20px] p-6 opacity-60"
			aria-disabled="true"
		>
			<span
				class="absolute top-4 right-4 rounded-full border border-white/12 bg-white/[0.06] px-2.5 py-1 text-[11px] font-bold tracking-wide text-mut2 uppercase"
				>{m.home_single_soon()}</span
			>
			<div
				class="mb-9 flex h-[46px] w-[46px] items-center justify-center rounded-[13px] bg-white/[0.07] text-[22px]"
			>
				🤖
			</div>
			<div class="font-display mb-1 text-[26px] font-extrabold">{m.home_single_title()}</div>
			<div class="text-sm leading-snug text-mut">{m.home_single_sub()}</div>
		</div>

		<!-- multiplayer / create room -->
		<form
			id="create-form"
			method="POST"
			action="?/create"
			use:enhance
			class="relative flex flex-col rounded-[20px] p-6 text-left"
			style="background:linear-gradient(180deg,rgba(198,255,58,.14),rgba(198,255,58,.04));border:1.5px solid rgba(198,255,58,.4)"
		>
			<div
				class="mb-9 flex h-[46px] w-[46px] items-center justify-center rounded-[13px] bg-lime/20 text-[22px]"
			>
				🔗
			</div>
			<div class="font-display mb-1 text-[26px] font-extrabold text-[#dfff9a]">
				{m.home_multi_title()}
			</div>
			<div class="mb-4 text-sm leading-snug text-[#b9d49a]">{m.home_multi_sub()}</div>

			<label class="mb-3 block">
				<span class="mb-1.5 block text-[12px] font-bold tracking-wide text-[#b9d49a] uppercase"
					>{m.home_pool_label()}</span
				>
				<select
					name="pool"
					class="w-full rounded-[10px] border-[1.5px] border-white/14 bg-black/25 px-3 py-2.5 text-[15px] font-semibold text-white outline-none focus:border-lime/60"
				>
					{#each data.pools as pool (pool.id)}
						<option value={pool.id} class="bg-panel">{pool.label}</option>
					{/each}
				</select>
			</label>
			<button
				type="submit"
				class="mt-auto rounded-[11px] bg-lime px-4 py-3 text-[15px] font-extrabold text-ink transition hover:brightness-105"
			>
				{m.home_create_button()} →
			</button>
		</form>

		<!-- join -->
		<form
			method="POST"
			action="?/join"
			use:enhance
			class="panel flex flex-col rounded-[20px] p-6 text-left"
		>
			<input type="hidden" name="name" value={name} />
			<div
				class="mb-7 flex h-[46px] w-[46px] items-center justify-center rounded-[13px] bg-white/[0.07] text-[22px]"
			>
				⌨️
			</div>
			<div class="font-display mb-2.5 text-[26px] font-extrabold">{m.home_join_heading()}</div>
			<div class="flex gap-2">
				<input
					name="code"
					maxlength="4"
					autocomplete="off"
					placeholder={m.home_code_placeholder()}
					aria-label={m.home_code_label()}
					class="font-display min-w-0 flex-1 rounded-[10px] border-[1.5px] border-white/14 bg-black/25 px-3 py-2.5 text-[18px] font-bold tracking-[0.12em] text-white uppercase outline-none focus:border-lime/60"
				/>
				<button
					type="submit"
					class="rounded-[10px] bg-white px-4 font-extrabold text-ink transition hover:bg-fog"
				>
					{m.home_join_button()}
				</button>
			</div>
			{#if form?.codeError}
				<p class="mt-2 text-sm text-orange">{m.home_error_code()}</p>
			{/if}
		</form>
	</section>
</main>
