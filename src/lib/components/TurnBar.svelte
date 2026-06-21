<script lang="ts">
	import * as m from '$lib/paraglide/messages';

	interface Props {
		myTurn: boolean;
		awaitingAnswer: boolean;
		remaining: number;
		guessing: boolean;
		onAsk: (text: string) => void;
		onAnswer: (value: boolean) => void;
		onEndTurn: () => void;
		onToggleGuess: () => void;
	}

	let {
		myTurn,
		awaitingAnswer,
		remaining,
		guessing,
		onAsk,
		onAnswer,
		onEndTurn,
		onToggleGuess
	}: Props = $props();

	let question = $state('');

	function submit(e: SubmitEvent) {
		e.preventDefault();
		const text = question.trim();
		if (!text) return;
		onAsk(text);
		question = '';
	}

	const btn =
		'rounded-md border border-green-700 px-3 py-1.5 text-sm font-medium text-green-800 hover:bg-green-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 disabled:opacity-40';
	const btnSolid =
		'rounded-md bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800';
</script>

<div class="flex flex-wrap items-center gap-2 rounded-lg bg-zinc-50 p-2">
	<span
		class="rounded-full px-2.5 py-1 text-xs font-semibold {myTurn
			? 'bg-green-700 text-white'
			: 'bg-zinc-200 text-zinc-700'}"
		aria-live="polite"
	>
		{myTurn ? m.play_your_turn() : m.play_their_turn()}
	</span>
	<span class="text-xs text-zinc-500">{m.play_remaining({ count: remaining })}</span>

	{#if awaitingAnswer && !myTurn}
		<span class="text-sm font-medium">{m.play_answer_prompt()}</span>
		<button type="button" class={btnSolid} onclick={() => onAnswer(true)}
			>{m.play_answer_yes()}</button
		>
		<button type="button" class={btn} onclick={() => onAnswer(false)}>{m.play_answer_no()}</button>
	{:else if awaitingAnswer && myTurn}
		<span class="text-sm text-zinc-600">{m.play_awaiting_answer()}</span>
	{:else if myTurn}
		<form class="flex flex-wrap items-center gap-2" onsubmit={submit}>
			<input
				bind:value={question}
				placeholder={m.play_ask_placeholder()}
				class="min-w-48 flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-green-600 focus:outline-none"
			/>
			<button type="submit" class={btnSolid}>{m.play_ask()}</button>
		</form>
		<button type="button" class={btn} onclick={onEndTurn}>{m.play_end_turn()}</button>
		<button type="button" class={guessing ? btnSolid : btn} onclick={onToggleGuess}>
			{guessing ? m.play_guess_cancel() : m.play_guess()}
		</button>
	{:else}
		<span class="text-sm text-zinc-600">{m.play_opponent_asking()}</span>
	{/if}
</div>
