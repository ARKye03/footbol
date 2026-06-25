<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Board from '$lib/components/Board.svelte';
	import Chat from '$lib/components/Chat.svelte';
	import ConnectionBadge from '$lib/components/ConnectionBadge.svelte';
	import GameControls from '$lib/components/GameControls.svelte';
	import GameOver from '$lib/components/GameOver.svelte';
	import GuessDialog from '$lib/components/GuessDialog.svelte';
	import Lobby from '$lib/components/Lobby.svelte';
	import PhaseBar from '$lib/components/PhaseBar.svelte';
	import Reveal from '$lib/components/Reveal.svelte';
	import TurnBar from '$lib/components/TurnBar.svelte';
	import { RoomSocket } from '$lib/client/room-socket.svelte';
	import type { BoardCard } from '$lib/game/state';
	import * as m from '$lib/paraglide/messages';

	let { data } = $props();

	let socket = $state<RoomSocket | null>(null);
	let guessMode = $state(false);
	let pendingGuess = $state<string | null>(null);
	let reveal = $state<BoardCard | null>(null);
	let autoRevealed = $state(false);

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

	// Reveal the player's own secret card once, when the match begins.
	$effect(() => {
		const s = socket;
		if (s && s.phase === 'playing' && !autoRevealed) {
			const card = mySecret(s);
			if (card) {
				reveal = card;
				autoRevealed = true;
			}
		}
	});

	const mySecret = (s: RoomSocket): BoardCard | undefined => {
		const id = s.me?.secretId;
		return id ? s.board.find((c) => c.footballerId === id) : undefined;
	};

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

{#if !socket}
	<main class="relative z-10 mx-auto max-w-[1320px] px-7 py-6">
		<p class="text-sm text-mut2">{m.conn_connecting()}</p>
	</main>
{:else}
	{@const s = socket}
	{#if s.fatal}
		<main class="relative z-10 mx-auto max-w-md px-7 py-10 text-center">
			<p
				class="rounded-[12px] border border-orange/40 bg-orange/[0.14] px-4 py-3 text-orange"
				role="alert"
			>
				{fatalText(s.fatal)}
			</p>
			<a href={resolve('/')} class="mt-4 inline-block text-sm font-bold text-lime"
				>← {m.gameover_leave()}</a
			>
		</main>
	{:else if s.phase === 'lobby' || s.phase === 'ready'}
		<Lobby
			code={data.code}
			players={s.players}
			order={s.order}
			you={s.you}
			connected={s.connected}
			boardSize={s.board.length}
		/>
	{:else if s.phase === 'playing' || s.phase === 'penalty' || s.phase === 'equalizer'}
		{@const oppId = s.opponentId}
		{@const oppName = oppId ? (s.players[oppId]?.name ?? '') : ''}
		{@const pendingQuestion = s.chat.filter((c) => c.kind === 'question').at(-1)?.text ?? ''}
		<main
			class="relative z-10 mx-auto grid max-w-[1320px] items-start gap-5 px-7 pb-10 lg:grid-cols-[1fr_372px]"
		>
			<section>
				{#if s.opponentLeftAt !== null}
					<div class="mb-3.5">
						<ConnectionBadge connected={s.connected} opponentLeft={true} />
					</div>
				{/if}
				{#if s.phase === 'playing'}
					<TurnBar
						myTurn={s.myTurn}
						awaitingAnswer={s.awaitingAnswer}
						remaining={s.board.length - s.eliminated.size}
						guessing={guessMode}
						opponentName={oppName}
						onMyPlayer={() => (reveal = mySecret(s) ?? null)}
						onCancelGuess={() => (guessMode = false)}
					/>
					<div class="mt-3.5">
						<Board
							cards={s.board}
							eliminated={s.eliminated}
							guessing={guessMode}
							onCard={(id) => onCard(s, id)}
						/>
					</div>
				{:else}
					<PhaseBar kind={s.phase} guessing={guessMode} onCancelGuess={() => (guessMode = false)} />
					<div class="mt-3.5">
						<Board
							cards={s.board}
							eliminated={s.eliminated}
							guessing={guessMode}
							onCard={(id) => onCard(s, id)}
						/>
					</div>
				{/if}
			</section>

			<aside class="panel flex flex-col overflow-hidden rounded-[18px] lg:h-[640px]">
				<div class="flex items-center justify-between border-b border-white/[0.08] px-4 py-3.5">
					<span class="font-display text-lg font-extrabold">{m.chat_match()}</span>
					<ConnectionBadge connected={s.connected} opponentLeft={false} />
				</div>
				<Chat entries={s.chat} players={s.players} you={s.you} />
				<GameControls
					phase={s.phase}
					myTurn={s.myTurn}
					awaitingAnswer={s.awaitingAnswer}
					answeredThisTurn={s.answeredThisTurn}
					penaltyRole={s.penaltyRole}
					penaltyRemaining={s.penalty?.questionsRemaining ?? 0}
					isSecond={s.isSecond}
					{pendingQuestion}
					opponentName={oppName}
					onAsk={(t) => s.ask(t)}
					onAnswer={(v) => s.answer(v)}
					onEndTurn={() => s.endTurn()}
					onStartGuess={() => (guessMode = true)}
				/>
			</aside>
		</main>

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
			order={s.order}
			you={s.you}
			board={s.board}
			onRematch={() => s.rematch()}
			onLeave={() => goto(resolve('/'))}
		/>
	{/if}

	{#if reveal}
		<Reveal
			name={reveal.name}
			photoKey={reveal.photoKey}
			position={reveal.position}
			nationality={reveal.nationality}
			kicker={m.reveal_your_secret()}
			closeLabel={m.reveal_to_board()}
			onClose={() => (reveal = null)}
		/>
	{/if}
{/if}
