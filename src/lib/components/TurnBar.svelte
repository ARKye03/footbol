<script lang="ts">
	import * as m from '$lib/paraglide/messages';

	interface Props {
		myTurn: boolean;
		awaitingAnswer: boolean;
		remaining: number;
		guessing: boolean;
		opponentName?: string;
		onMyPlayer: () => void;
		onCancelGuess: () => void;
	}

	let {
		myTurn,
		awaitingAnswer,
		remaining,
		guessing,
		opponentName = '',
		onMyPlayer,
		onCancelGuess
	}: Props = $props();

	type Accent = 'lime' | 'orange' | 'neutral';
	const view = $derived.by((): { title: string; sub: string; accent: Accent; pulse: boolean } => {
		if (myTurn && !awaitingAnswer)
			return {
				title: m.play_your_turn(),
				sub: m.play_ask_placeholder(),
				accent: 'lime',
				pulse: true
			};
		if (myTurn && awaitingAnswer)
			return {
				title: m.play_waiting(),
				sub: m.play_awaiting_answer(),
				accent: 'neutral',
				pulse: false
			};
		if (!myTurn && awaitingAnswer)
			return {
				title: opponentName || m.play_their_turn(),
				sub: m.play_answer_their_question(),
				accent: 'orange',
				pulse: false
			};
		return {
			title: m.play_their_turn(),
			sub: m.play_opponent_asking(),
			accent: 'orange',
			pulse: false
		};
	});

	const bar = $derived(
		view.accent === 'lime'
			? 'border-lime/50 text-[#dfff9a]'
			: view.accent === 'orange'
				? 'border-orange/50 text-[#ffc79a]'
				: 'border-white/14 text-fog'
	);
	const barBg = $derived(
		view.accent === 'lime'
			? 'linear-gradient(90deg,rgba(198,255,58,.22),rgba(198,255,58,.06))'
			: view.accent === 'orange'
				? 'linear-gradient(90deg,rgba(255,122,26,.22),rgba(255,122,26,.05))'
				: 'rgba(255,255,255,.05)'
	);
	const dot = $derived(
		view.accent === 'lime' ? '#c6ff3a' : view.accent === 'orange' ? '#ff7a1a' : '#8fa89b'
	);
</script>

<div
	class="flex items-center justify-between gap-3 rounded-[14px] border-[1.5px] px-4 py-3.5 {bar}"
	style="background:{barBg}"
>
	<div class="flex min-w-0 items-center gap-3.5">
		<span
			class="h-3.5 w-3.5 shrink-0 rounded-full"
			style="background:{dot};{view.pulse ? 'animation:ringpulse 1.6s infinite' : ''}"
			aria-hidden="true"
		></span>
		<div class="min-w-0">
			<div class="font-display text-[26px] leading-none font-black uppercase" aria-live="polite">
				{view.title}
			</div>
			<div class="mt-0.5 truncate text-[13px] font-semibold opacity-85">{view.sub}</div>
		</div>
	</div>
	<div class="flex shrink-0 items-center gap-2">
		<span class="hidden text-xs font-semibold opacity-80 sm:inline"
			>{m.play_remaining({ count: remaining })}</span
		>
		<button
			type="button"
			onclick={onMyPlayer}
			class="rounded-[10px] border border-white/[0.18] bg-black/25 px-3 py-2 text-[13px] font-bold text-inherit transition hover:bg-black/40"
		>
			{m.play_my_player()}
		</button>
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
