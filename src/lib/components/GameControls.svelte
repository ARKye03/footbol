<script lang="ts">
	import * as m from '$lib/paraglide/messages';

	interface Props {
		myTurn: boolean;
		awaitingAnswer: boolean;
		pendingQuestion?: string;
		opponentName?: string;
		onAsk: (text: string) => void;
		onAnswer: (value: boolean) => void;
		onEndTurn: () => void;
		onStartGuess: () => void;
	}

	let {
		myTurn,
		awaitingAnswer,
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

{#if awaitingAnswer && !myTurn}
	<!-- answerer: respond to the opponent's question -->
	<div class="border-t border-white/[0.08] bg-orange/[0.08] p-3.5">
		<div class="mb-1 text-xs font-bold tracking-wide text-[#ffb27a] uppercase">
			{opponentName || m.play_their_turn()}
		</div>
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
{:else if myTurn && !awaitingAnswer}
	<!-- asker: ask a question, end the turn, or make a guess -->
	<div class="border-t border-white/[0.08] p-3.5">
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
	</div>
{:else}
	<!-- waiting: opponent is thinking, or our question is being answered -->
	<div
		class="flex items-center gap-2.5 border-t border-white/[0.08] p-4.5 text-sm font-semibold text-mut"
		style="padding:18px"
	>
		<span class="flex gap-1" aria-hidden="true">
			<span class="dot"></span>
			<span class="dot" style="animation-delay:.2s"></span>
			<span class="dot" style="animation-delay:.4s"></span>
		</span>
		{myTurn ? m.play_awaiting_answer() : m.play_opponent_asking()}
	</div>
{/if}
