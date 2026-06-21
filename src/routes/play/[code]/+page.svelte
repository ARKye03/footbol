<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Board from '$lib/components/Board.svelte';
	import Chat from '$lib/components/Chat.svelte';
	import ConnectionBadge from '$lib/components/ConnectionBadge.svelte';
	import GameOver from '$lib/components/GameOver.svelte';
	import GuessDialog from '$lib/components/GuessDialog.svelte';
	import Lobby from '$lib/components/Lobby.svelte';
	import TurnBar from '$lib/components/TurnBar.svelte';
	import { RoomSocket } from '$lib/client/room-socket.svelte';
	import * as m from '$lib/paraglide/messages';

	let { data } = $props();

	let socket = $state<RoomSocket | null>(null);
	let guessMode = $state(false);
	let pendingGuess = $state<string | null>(null);

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

	const fatalText = (code: string) =>
		code === 'room_full'
			? m.error_room_full()
			: code === 'unauthorized'
				? m.error_unauthorized()
				: m.error_generic();

	const cardName = (s: RoomSocket, id: string | null) =>
		s.board.find((c) => c.footballerId === id)?.name ?? '';

	function onCard(s: RoomSocket, footballerId: string) {
		if (guessMode) {
			pendingGuess = footballerId;
			return;
		}
		s.flip(footballerId, !s.eliminated.has(footballerId));
	}

	function confirmGuess(s: RoomSocket) {
		if (pendingGuess) s.guess(pendingGuess);
		pendingGuess = null;
		guessMode = false;
	}
</script>

<svelte:head><title>{m.app_title()} · {data.code}</title></svelte:head>

<main class="mx-auto max-w-3xl px-4 py-4">
	{#if !socket}
		<p class="text-sm text-zinc-500">{m.conn_connecting()}</p>
	{:else}
		{@const s = socket}
		<div class="mb-3 flex items-center justify-between">
			<span class="font-mono text-sm tracking-widest text-zinc-500">{data.code}</span>
			<ConnectionBadge connected={s.connected} opponentLeft={s.opponentLeftAt !== null} />
		</div>

		{#if s.fatal}
			<p class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
				{fatalText(s.fatal)}
			</p>
			<a href={resolve('/')} class="mt-3 inline-block text-sm text-green-700"
				>← {m.gameover_leave()}</a
			>
		{:else if s.phase === 'lobby' || s.phase === 'ready'}
			<Lobby code={data.code} players={s.players} order={s.order} you={s.you} />
		{:else if s.phase === 'playing'}
			<TurnBar
				myTurn={s.myTurn}
				awaitingAnswer={s.awaitingAnswer}
				remaining={s.board.length - s.eliminated.size}
				guessing={guessMode}
				onAsk={(t) => s.ask(t)}
				onAnswer={(v) => s.answer(v)}
				onEndTurn={() => s.endTurn()}
				onToggleGuess={() => (guessMode = !guessMode)}
			/>
			<div class="mt-3">
				<Board
					cards={s.board}
					eliminated={s.eliminated}
					guessing={guessMode}
					onCard={(id) => onCard(s, id)}
				/>
			</div>
			<Chat entries={s.chat} players={s.players} />

			{#if pendingGuess}
				<GuessDialog
					name={cardName(s, pendingGuess)}
					onConfirm={() => confirmGuess(s)}
					onCancel={() => (pendingGuess = null)}
				/>
			{/if}
		{:else if s.phase === 'finished' && s.result}
			<GameOver
				result={s.result}
				players={s.players}
				order={s.order}
				you={s.you}
				board={s.board}
				onRematch={() => s.rematch()}
				onLeave={() => goto(resolve('/'))}
			/>
		{/if}
	{/if}
</main>
