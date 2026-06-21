<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import type { ChatEntry, PlayerSlot } from '$lib/game/state';

	interface Props {
		entries: ChatEntry[];
		players: Record<string, PlayerSlot>;
		you: string;
	}

	let { entries, players, you }: Props = $props();

	const nameOf = (id: string) => players[id]?.name ?? '?';
	const answerText = (text: string) => (text === 'yes' ? m.play_answer_yes() : m.play_answer_no());

	type Side = 'system' | 'mine' | 'theirs-q' | 'theirs-a';
	const sideOf = (e: ChatEntry): Side => {
		if (e.kind === 'system') return 'system';
		if (e.from === you) return 'mine';
		return e.kind === 'question' ? 'theirs-q' : 'theirs-a';
	};
	const textOf = (e: ChatEntry) =>
		e.kind === 'system'
			? m.chat_joined({ name: nameOf(e.from) })
			: e.kind === 'answer'
				? answerText(e.text)
				: e.text;
</script>

<ol
	class="flex flex-1 flex-col gap-2.5 overflow-y-auto p-4 text-sm"
	aria-live="polite"
	aria-label={m.chat_heading()}
>
	{#each entries as entry (entry.id)}
		{@const side = sideOf(entry)}
		<li
			class="flex {side === 'mine'
				? 'justify-end'
				: side === 'system'
					? 'justify-center'
					: 'justify-start'}"
		>
			{#if side === 'system'}
				<span class="text-xs text-[#7f9a89] italic">{textOf(entry)}</span>
			{:else}
				<span
					class="max-w-[80%] px-3 py-2.25 text-sm leading-snug font-semibold {side === 'mine'
						? 'rounded-[14px_14px_4px_14px] bg-lime text-ink'
						: side === 'theirs-q'
							? 'rounded-[14px_14px_14px_4px] bg-orange/[0.16] text-[#ffc79a]'
							: 'rounded-[14px_14px_14px_4px] bg-white/10 text-cloud'}"
					style="padding-top:9px;padding-bottom:9px">{textOf(entry)}</span
				>
			{/if}
		</li>
	{/each}
</ol>
