<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
</script>

<svelte:head><title>Catalog — footbol</title></svelte:head>

<main>
	<h1>Catalog preview</h1>
	<p class="meta">{data.pool.label} · {data.board.length} cards</p>

	<nav class="pools">
		{#each data.pools as p (p.id)}
			<a
				href={resolve('/catalog/[[pool]]', { pool: p.id })}
				class="pool"
				aria-current={p.id === data.pool.id ? 'page' : undefined}
			>
				{p.label}
			</a>
		{/each}
	</nav>

	{#if data.board.length === 0}
		<p class="empty">No footballers in this pool. Run <code>pnpm seed:local</code> first.</p>
	{:else}
		<ul class="board">
			{#each data.board as card (card.footballerId)}
				<li class="card">
					<img src="/img/{card.photoKey}" alt={card.name} width="256" height="256" loading="lazy" />
					<span class="name">{card.name}</span>
				</li>
			{/each}
		</ul>
	{/if}
</main>

<style>
	main {
		max-width: 60rem;
		margin: 0 auto;
		padding: 1.5rem;
		font-family: system-ui, sans-serif;
	}
	h1 {
		margin: 0 0 0.25rem;
	}
	.meta {
		margin: 0 0 1rem;
		color: #52525b;
	}
	.pools {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
	}
	.pool {
		padding: 0.35rem 0.7rem;
		border: 1px solid #d4d4d8;
		border-radius: 999px;
		font-size: 0.85rem;
		text-decoration: none;
		color: #18181b;
	}
	.pool[aria-current='page'] {
		background: #166534;
		border-color: #166534;
		color: #fff;
	}
	.board {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
		gap: 0.75rem;
	}
	.card {
		display: flex;
		flex-direction: column;
		border: 1px solid #e4e4e7;
		border-radius: 0.5rem;
		overflow: hidden;
		background: #fafafa;
	}
	.card img {
		width: 100%;
		height: auto;
		aspect-ratio: 1;
		object-fit: cover;
		display: block;
	}
	.name {
		padding: 0.4rem 0.5rem;
		font-size: 0.8rem;
		text-align: center;
	}
	.empty {
		color: #52525b;
	}
</style>
