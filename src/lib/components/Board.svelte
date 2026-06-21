<script lang="ts">
	import type { BoardCard } from '$lib/game/state';
	import Card from './Card.svelte';

	interface Props {
		cards: BoardCard[];
		eliminated: Set<string>;
		guessing?: boolean;
		onCard: (footballerId: string) => void;
	}

	let { cards, eliminated, guessing = false, onCard }: Props = $props();
</script>

<ul
	class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6"
	class:ring-2={guessing}
	class:ring-green-600={guessing}
	class:rounded-xl={guessing}
	class:p-1={guessing}
>
	{#each cards as card (card.footballerId)}
		<li>
			<Card
				name={card.name}
				photoKey={card.photoKey}
				down={eliminated.has(card.footballerId)}
				{guessing}
				onActivate={() => onCard(card.footballerId)}
			/>
		</li>
	{/each}
</ul>
