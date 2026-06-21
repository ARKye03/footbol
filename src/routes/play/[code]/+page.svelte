<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { RoomSocket } from '$lib/client/room-socket.svelte';

	let { data } = $props();

	let socket = $state<RoomSocket | null>(null);
	let question = $state('');
	let guessMode = $state(false);

	onMount(() => {
		const s = new RoomSocket({
			code: data.code,
			wsToken: data.wsToken,
			me: data.me,
			poolId: data.poolId
		});
		socket = s;
		return () => s.close();
	});

	const cardName = (s: RoomSocket, footballerId: string | null) =>
		s.board.find((c) => c.footballerId === footballerId)?.name ?? '—';

	function submitAsk(s: RoomSocket) {
		const text = question.trim();
		if (!text) return;
		s.ask(text);
		question = '';
	}

	function onCard(s: RoomSocket, footballerId: string) {
		if (guessMode) {
			if (confirm(`Final guess: ${cardName(s, footballerId)}? This ends the game.`)) {
				s.guess(footballerId);
				guessMode = false;
			}
			return;
		}
		s.flip(footballerId, !s.eliminated.has(footballerId));
	}
</script>

<svelte:head><title>Room {data.code} — footbol</title></svelte:head>

<main>
	<header>
		<a class="back" href={resolve('/')}>← Home</a>
		<h1>Room <code>{data.code}</code></h1>
		<span class="conn" class:on={socket?.connected}
			>{socket?.connected ? 'connected' : 'connecting…'}</span
		>
	</header>

	{#if !socket}
		<p>Connecting…</p>
	{:else}
		{@const s = socket}
		{#if s.error}<p class="error">{s.error}</p>{/if}
		{#if s.opponentLeftAt}<p class="warn">
				Opponent disconnected — waiting for them to return…
			</p>{/if}

		<section class="players">
			{#each s.order as id (id)}
				<span class="player" class:you={id === s.you} class:off={!s.players[id]?.connected}>
					{s.players[id]?.name}{id === s.you ? ' (you)' : ''}
				</span>
			{/each}
		</section>

		{#if s.phase === 'lobby' || s.phase === 'ready'}
			<p class="status">Waiting for an opponent. Share the room link.</p>
		{:else if s.phase === 'playing'}
			<section class="turnbar">
				{#if s.awaitingAnswer && !s.myTurn}
					<span>Answer the question:</span>
					<button type="button" onclick={() => s.answer(true)}>Yes</button>
					<button type="button" onclick={() => s.answer(false)}>No</button>
				{:else if s.awaitingAnswer && s.myTurn}
					<span>Waiting for opponent's answer…</span>
				{:else if s.myTurn}
					<form
						onsubmit={(e) => {
							e.preventDefault();
							submitAsk(s);
						}}
					>
						<input bind:value={question} placeholder="Ask a yes/no question…" />
						<button type="submit">Ask</button>
					</form>
					<button type="button" onclick={() => s.endTurn()}>End turn</button>
					<button type="button" class:armed={guessMode} onclick={() => (guessMode = !guessMode)}>
						{guessMode ? 'Pick a card to guess…' : 'Guess'}
					</button>
				{:else}
					<span>Opponent's turn…</span>
				{/if}
			</section>

			<ul class="board" class:guessing={guessMode}>
				{#each s.board as card (card.footballerId)}
					{@const down = s.eliminated.has(card.footballerId)}
					<li>
						<button
							type="button"
							class="card"
							class:down
							aria-pressed={down}
							onclick={() => onCard(s, card.footballerId)}
						>
							<img
								src="/img/{card.photoKey}"
								alt={card.name}
								width="128"
								height="128"
								loading="lazy"
							/>
							<span>{card.name}</span>
						</button>
					</li>
				{/each}
			</ul>

			<section class="chat" aria-live="polite">
				{#each s.chat as entry (entry.id)}
					<p class="msg {entry.kind}">
						{#if entry.kind === 'system'}
							<em>{s.players[entry.from]?.name ?? 'Someone'} joined</em>
						{:else}
							<strong>{s.players[entry.from]?.name ?? '?'}:</strong>
							{entry.kind === 'answer' ? entry.text.toUpperCase() : entry.text}
						{/if}
					</p>
				{/each}
			</section>
		{:else if s.phase === 'finished' && s.result}
			<section class="over">
				<h2>
					{s.result.winnerId === s.you
						? 'You won! 🎉'
						: s.result.winnerId === null
							? 'Game over'
							: 'You lost'}
				</h2>
				<p class="reason">{s.result.reason.replace('_', ' ')}</p>
				<ul class="reveal">
					{#each s.order as id (id)}
						<li>
							{s.players[id]?.name}{id === s.you ? ' (you)' : ''} was
							<strong>{cardName(s, s.result.reveal[id])}</strong>
						</li>
					{/each}
				</ul>
				<button type="button" onclick={() => s.rematch()}>Rematch</button>
				<a class="back" href={resolve('/')}>Leave</a>
			</section>
		{/if}
	{/if}
</main>

<style>
	main {
		max-width: 52rem;
		margin: 0 auto;
		padding: 1rem 1.25rem 3rem;
		font-family: system-ui, sans-serif;
	}
	header {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
	}
	header h1 {
		margin: 0;
		font-size: 1.25rem;
	}
	code {
		font-family: ui-monospace, monospace;
		letter-spacing: 0.1em;
	}
	.back {
		color: #166534;
		text-decoration: none;
		font-size: 0.85rem;
	}
	.conn {
		margin-left: auto;
		font-size: 0.8rem;
		color: #b91c1c;
	}
	.conn.on {
		color: #166534;
	}
	.error {
		color: #b91c1c;
	}
	.warn {
		color: #b45309;
	}
	.players {
		display: flex;
		gap: 0.5rem;
		margin: 0.5rem 0;
	}
	.player {
		padding: 0.2rem 0.6rem;
		border-radius: 999px;
		background: #f4f4f5;
		font-size: 0.85rem;
	}
	.player.you {
		background: #dcfce7;
	}
	.player.off {
		opacity: 0.5;
	}
	.turnbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin: 0.75rem 0;
	}
	.turnbar input {
		padding: 0.35rem 0.5rem;
		min-width: 14rem;
	}
	button {
		padding: 0.35rem 0.75rem;
		border: 1px solid #166534;
		border-radius: 0.4rem;
		background: #fff;
		color: #166534;
		cursor: pointer;
		font-size: 0.85rem;
	}
	button.armed {
		background: #166534;
		color: #fff;
	}
	.board {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr));
		gap: 0.5rem;
	}
	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
		padding: 0;
		border: 1px solid #e4e4e7;
		border-radius: 0.5rem;
		overflow: hidden;
		background: #fafafa;
		font-size: 0.7rem;
	}
	.card img {
		width: 100%;
		height: auto;
		aspect-ratio: 1;
		object-fit: cover;
	}
	.card span {
		padding: 0.25rem;
		text-align: center;
	}
	.card.down {
		opacity: 0.35;
		filter: grayscale(1);
	}
	.board.guessing .card {
		border-color: #166534;
	}
	.chat {
		margin-top: 1rem;
		border-top: 1px solid #e4e4e7;
		padding-top: 0.5rem;
		font-size: 0.85rem;
	}
	.msg {
		margin: 0.15rem 0;
	}
	.over h2 {
		margin: 0.5rem 0;
	}
	.reason {
		color: #52525b;
		text-transform: capitalize;
	}
	.reveal {
		list-style: none;
		padding: 0;
	}
</style>
