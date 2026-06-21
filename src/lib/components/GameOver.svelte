<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import type { BoardCard, PlayerSlot } from '$lib/game/state';

	interface Result {
		winnerId: string | null;
		reason: string;
		reveal: Record<string, string>;
	}

	interface Props {
		result: Result;
		players: Record<string, PlayerSlot>;
		order: string[];
		you: string;
		board: BoardCard[];
		onRematch: () => void;
		onLeave: () => void;
	}

	let { result, players, order, you, board, onRematch, onLeave }: Props = $props();

	const heading = $derived(
		result.winnerId === you
			? m.gameover_you_won()
			: result.winnerId === null
				? m.gameover_over()
				: m.gameover_you_lost()
	);

	const reasonText = (reason: string): string => {
		switch (reason) {
			case 'correct_guess':
				return m.gameover_reason_correct_guess();
			case 'wrong_guess':
				return m.gameover_reason_wrong_guess();
			case 'forfeit':
				return m.gameover_reason_forfeit();
			default:
				return m.gameover_reason_abandoned();
		}
	};

	const cardName = (footballerId: string | undefined) =>
		board.find((c) => c.footballerId === footballerId)?.name ?? '—';
	const won = $derived(result.winnerId === you);
</script>

<section class="mx-auto max-w-md text-center">
	<h1 class="text-2xl font-bold {won ? 'text-green-700' : 'text-zinc-800'}">{heading}</h1>
	<p class="mt-1 text-sm text-zinc-500">{reasonText(result.reason)}</p>

	<h2 class="mt-5 text-sm font-semibold text-zinc-700">{m.gameover_reveal_heading()}</h2>
	<ul class="mt-1 flex flex-col items-center gap-1 text-sm">
		{#each order as id (id)}
			<li>
				{m.gameover_reveal({
					name: `${players[id]?.name}${id === you ? ` ${m.you_suffix()}` : ''}`,
					card: cardName(result.reveal[id])
				})}
			</li>
		{/each}
	</ul>

	<div class="mt-5 flex justify-center gap-2">
		<button
			type="button"
			onclick={onRematch}
			class="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
		>
			{m.gameover_rematch()}
		</button>
		<button
			type="button"
			onclick={onLeave}
			class="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
		>
			{m.gameover_leave()}
		</button>
	</div>
</section>
