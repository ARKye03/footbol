<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import type { BoardCard } from '$lib/game/state';
	import SecretCard from './SecretCard.svelte';

	interface Result {
		winnerId: string | null;
		reason: string;
		reveal: Record<string, string>;
	}

	interface Props {
		result: Result;
		order: string[];
		you: string;
		board: BoardCard[];
		onRematch: () => void;
		onLeave: () => void;
	}

	let { result, order, you, board, onRematch, onLeave }: Props = $props();

	const won = $derived(result.winnerId === you);
	const title = $derived(
		won
			? m.gameover_you_won()
			: result.winnerId === null
				? m.gameover_over()
				: m.gameover_you_lost()
	);
	const titleColor = $derived(won ? '#c6ff3a' : '#ff7a1a');

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

	const opponentId = $derived(order.find((id) => id !== you) ?? null);
	const cardFor = (pid: string | null): BoardCard | undefined =>
		board.find((c) => c.footballerId === (pid ? result.reveal[pid] : undefined));
	const mine = $derived(cardFor(you));
	const theirs = $derived(cardFor(opponentId));
</script>

<main class="relative z-10 mx-auto max-w-[880px] px-7 pt-8 pb-20 text-center">
	<div
		class="font-display text-[clamp(56px,14vw,96px)] leading-[0.92] font-black tracking-tight"
		style="color:{titleColor}"
	>
		{title}
	</div>
	<p class="mt-1.5 mb-8 text-[18px] text-mut">{reasonText(result.reason)}</p>

	<div class="mb-9 flex flex-wrap justify-center gap-7.5" style="gap:30px">
		<div>
			<div class="mb-2.5 text-xs font-bold tracking-wide text-mut2 uppercase">
				{m.gameover_your_secret()}
			</div>
			{#if mine}
				<SecretCard
					name={mine.name}
					photoKey={mine.photoKey}
					position={mine.position}
					nationality={mine.nationality}
					accent="lime"
				/>
			{/if}
		</div>
		<div>
			<div class="mb-2.5 text-xs font-bold tracking-wide text-mut2 uppercase">
				{m.gameover_their_secret()}
			</div>
			{#if theirs}
				<SecretCard
					name={theirs.name}
					photoKey={theirs.photoKey}
					position={theirs.position}
					nationality={theirs.nationality}
					accent="orange"
				/>
			{/if}
		</div>
	</div>

	<div class="flex flex-wrap justify-center gap-3">
		<button
			type="button"
			onclick={onRematch}
			class="rounded-xl bg-lime px-6.5 py-3.5 text-base font-extrabold text-ink transition hover:brightness-105"
			style="padding-left:26px;padding-right:26px">↻ {m.gameover_rematch()}</button
		>
		<button
			type="button"
			onclick={onLeave}
			class="rounded-xl border border-white/[0.18] bg-white/[0.08] px-6.5 py-3.5 text-base font-extrabold text-white transition hover:bg-white/15"
			style="padding-left:26px;padding-right:26px">{m.gameover_leave()}</button
		>
	</div>
</main>
