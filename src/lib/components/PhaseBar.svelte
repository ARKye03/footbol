<script lang="ts">
	import * as m from '$lib/paraglide/messages';

	interface Props {
		kind: 'penalty' | 'equalizer';
		guessing: boolean;
		onCancelGuess: () => void;
	}

	let { kind, guessing, onCancelGuess }: Props = $props();

	const title = $derived(kind === 'penalty' ? m.penalty_title() : m.equalizer_title());
	const sub = $derived(kind === 'penalty' ? m.penalty_asker_sub() : m.equalizer_sub());
</script>

<div
	class="flex items-center gap-3.5 rounded-[14px] border-[1.5px] border-orange/50 px-4 py-3.5 text-[#ffc79a]"
	style="background:linear-gradient(90deg,rgba(255,122,26,.22),rgba(255,122,26,.05))"
>
	<span class="h-3.5 w-3.5 shrink-0 rounded-full" style="background:#ff7a1a" aria-hidden="true"
	></span>
	<div class="min-w-0">
		<div class="font-display text-[26px] leading-none font-black uppercase">{title}</div>
		<div class="mt-0.5 truncate text-[13px] font-semibold opacity-85">{sub}</div>
	</div>
</div>

{#if guessing}
	<div
		class="mt-3.5 flex items-center gap-2.5 rounded-xl border border-orange/45 bg-orange/[0.14] px-3.5 py-2.75 text-[#ffc79a]"
		style="padding-top:11px;padding-bottom:11px"
		role="status"
	>
		<span aria-hidden="true">🎯</span>
		<span class="text-sm font-bold">{m.play_guess_hint()}</span>
		<button
			type="button"
			onclick={onCancelGuess}
			class="ml-auto rounded-lg border border-white/20 px-3 py-1.5 text-[13px] font-bold text-white transition hover:bg-white/10"
		>
			{m.play_guess_cancel()}
		</button>
	</div>
{/if}
