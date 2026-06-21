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

<ul class="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
	{#each cards as card (card.footballerId)}
		<li>
			<Card
				name={card.name}
				photoKey={card.photoKey}
				position={card.position}
				nationality={card.nationality}
				down={eliminated.has(card.footballerId)}
				{guessing}
				onActivate={() => onCard(card.footballerId)}
			/>
		</li>
	{/each}
</ul>
