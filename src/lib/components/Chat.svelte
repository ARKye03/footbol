<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import type { ChatEntry, PlayerSlot } from '$lib/game/state';

	interface Props {
		entries: ChatEntry[];
		players: Record<string, PlayerSlot>;
	}

	let { entries, players }: Props = $props();

	const nameOf = (id: string) => players[id]?.name ?? '?';
	const answerText = (text: string) => (text === 'yes' ? m.play_answer_yes() : m.play_answer_no());
</script>

<section class="mt-4 border-t border-zinc-200 pt-3">
	<h2 class="mb-1 text-sm font-semibold text-zinc-700">{m.chat_heading()}</h2>
	<ol class="flex flex-col gap-1 text-sm" aria-live="polite">
		{#each entries as entry (entry.id)}
			<li>
				{#if entry.kind === 'system'}
					<span class="text-zinc-500 italic">{m.chat_joined({ name: nameOf(entry.from) })}</span>
				{:else if entry.kind === 'answer'}
					<span class="font-semibold text-green-800">{nameOf(entry.from)}:</span>
					{answerText(entry.text)}
				{:else}
					<span class="font-semibold text-zinc-800">{nameOf(entry.from)}:</span>
					{entry.text}
				{/if}
			</li>
		{/each}
	</ol>
</section>
