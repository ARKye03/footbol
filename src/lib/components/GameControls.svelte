<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import type { Phase } from '$lib/game/state';

	interface Props {
		phase: Phase;
		myTurn: boolean;
		awaitingAnswer: boolean;
		answeredThisTurn: boolean;
		penaltyRole?: 'asker' | 'answerer' | null;
		penaltyRemaining?: number;
		isSecond?: boolean;
		pendingQuestion?: string;
		opponentName?: string;
		onAsk: (text: string) => void;
		onAnswer: (value: boolean) => void;
		onEndTurn: () => void;
		onStartGuess: () => void;
	}

	let {
		phase,
		myTurn,
		awaitingAnswer,
		answeredThisTurn,
		penaltyRole = null,
		penaltyRemaining = 0,
		isSecond = false,
		pendingQuestion = '',
		opponentName = '',
		onAsk,
		onAnswer,
		onEndTurn,
		onStartGuess
	}: Props = $props();

	let question = $state('');
	const chips = $derived([
		m.play_chip_defender(),
		m.play_chip_forward(),
		m.play_chip_european(),
		m.play_chip_goalkeeper()
	]);

	function submit(e: SubmitEvent) {
		e.preventDefault();
		const text = question.trim();
		if (!text) return;
		onAsk(text);
		question = '';
	}
</script>

{#snippet answerPrompt(kicker: string)}
	<div class="border-t border-white/[0.08] bg-orange/[0.08] p-3.5">
		<div class="mb-1 text-xs font-bold tracking-wide text-[#ffb27a] uppercase">{kicker}</div>
		{#if pendingQuestion}
			<div class="mb-3 text-[15px] font-bold">“{pendingQuestion}”</div>
		{/if}
		<div class="flex gap-2.5">
			<button
				type="button"
				onclick={() => onAnswer(true)}
				class="flex-1 rounded-[11px] bg-lime py-3 text-[15px] font-extrabold text-ink transition hover:brightness-105"
				>{m.play_answer_yes()}</button
			>
			<button
				type="button"
				onclick={() => onAnswer(false)}
				class="flex-1 rounded-[11px] border border-white/20 bg-white/10 py-3 text-[15px] font-extrabold text-white transition hover:bg-white/15"
				>{m.play_answer_no()}</button
			>
		</div>
	</div>
{/snippet}

{#snippet askForm()}
	<div class="mb-2.5 flex flex-wrap gap-1.5">
		{#each chips as chip (chip)}
			<button
				type="button"
				onclick={() => onAsk(chip)}
				class="rounded-full border border-lime/28 bg-lime/10 px-2.5 py-1.5 text-xs font-semibold text-[#cfe88a] transition hover:bg-lime/15"
				>{chip}</button
			>
		{/each}
	</div>
	<form class="mb-2.5 flex gap-2" onsubmit={submit}>
		<input
			bind:value={question}
			placeholder={m.play_ask_placeholder()}
			class="min-w-0 flex-1 rounded-[11px] border-[1.5px] border-white/14 bg-black/30 px-3 py-2.75 text-sm text-white outline-none focus:border-lime/60"
			style="padding-top:11px;padding-bottom:11px"
		/>
		<button
			type="submit"
			class="rounded-[11px] bg-lime px-4 font-extrabold text-ink transition hover:brightness-105"
			>{m.play_ask()}</button
		>
	</form>
{/snippet}

{#snippet waiting(label: string)}
	<div
		class="flex items-center gap-2.5 border-t border-white/[0.08] p-4.5 text-sm font-semibold text-mut"
		style="padding:18px"
	>
		<span class="flex gap-1" aria-hidden="true">
			<span class="dot"></span>
			<span class="dot" style="animation-delay:.2s"></span>
			<span class="dot" style="animation-delay:.4s"></span>
		</span>
		{label}
	</div>
{/snippet}

{#if phase === 'penalty'}
	{#if penaltyRole === 'asker'}
		{#if awaitingAnswer}
			{@render waiting(m.play_awaiting_answer())}
		{:else}
			<!-- survivor: ask within the budget or guess to win, else the match draws -->
			<div class="border-t border-white/[0.08] p-3.5">
				<div class="mb-2.5 flex items-baseline justify-between">
					<span class="text-xs font-bold tracking-wide text-[#ffb27a] uppercase"
						>{m.penalty_title()}</span
					>
					<span class="text-xs font-semibold text-mut"
						>{m.penalty_questions_left({ count: penaltyRemaining })}</span
					>
				</div>
				<p class="mb-2.5 text-[13px] font-semibold text-mut">{m.penalty_asker_sub()}</p>
				{@render askForm()}
				<button
					type="button"
					onclick={onStartGuess}
					class="w-full rounded-[11px] border-[1.5px] border-orange/50 bg-orange/[0.16] py-2.75 text-sm font-extrabold text-[#ffb27a] transition hover:bg-orange/25"
					style="padding-top:11px;padding-bottom:11px">🎯 {m.penalty_guess()}</button
				>
			</div>
		{/if}
	{:else if penaltyRole === 'answerer'}
		{#if awaitingAnswer}
			{@render answerPrompt(opponentName || m.play_their_turn())}
		{:else}
			<!-- out player: nothing to do but answer the survivor's questions -->
			<div class="border-t border-white/[0.08] p-3.5">
				<div class="mb-1 text-xs font-bold tracking-wide text-[#ffb27a] uppercase">
					{m.penalty_title()}
				</div>
				{@render waiting(m.penalty_answerer_sub())}
			</div>
		{/if}
	{:else}
		{@render waiting(m.penalty_wait())}
	{/if}
{:else if phase === 'equalizer'}
	{#if isSecond}
		<!-- Second is owed exactly one bare guess to force a draw (docs/11 § Constraint 2) -->
		<div class="border-t border-white/[0.08] p-3.5">
			<div class="mb-1 text-xs font-bold tracking-wide text-[#ffb27a] uppercase">
				{m.equalizer_title()}
			</div>
			<p class="mb-2.5 text-[13px] font-semibold text-mut">{m.equalizer_sub()}</p>
			<button
				type="button"
				onclick={onStartGuess}
				class="w-full rounded-[11px] border-[1.5px] border-orange/50 bg-orange/[0.16] py-2.75 text-sm font-extrabold text-[#ffb27a] transition hover:bg-orange/25"
				style="padding-top:11px;padding-bottom:11px">🎯 {m.equalizer_guess()}</button
			>
		</div>
	{:else}
		{@render waiting(m.equalizer_wait())}
	{/if}
{:else if awaitingAnswer && !myTurn}
	{@render answerPrompt(opponentName || m.play_their_turn())}
{:else if myTurn && !awaitingAnswer}
	<!-- asker: ask a question; once answered, the act step opens (guess or end turn) -->
	<div class="border-t border-white/[0.08] p-3.5">
		{@render askForm()}
		{#if answeredThisTurn}
			<div class="flex gap-2">
				<button
					type="button"
					onclick={onStartGuess}
					class="flex-1 rounded-[11px] border-[1.5px] border-orange/50 bg-orange/[0.16] py-2.75 text-sm font-extrabold text-[#ffb27a] transition hover:bg-orange/25"
					style="padding-top:11px;padding-bottom:11px">🎯 {m.play_make_guess()}</button
				>
				<button
					type="button"
					onclick={onEndTurn}
					class="rounded-[11px] border border-white/[0.18] bg-white/[0.06] px-4 text-sm font-bold text-fog transition hover:bg-white/10"
					>{m.play_end_turn()}</button
				>
			</div>
		{/if}
	</div>
{:else}
	<!-- waiting: opponent is thinking, or our question is being answered -->
	{@render waiting(myTurn ? m.play_awaiting_answer() : m.play_opponent_asking())}
{/if}
