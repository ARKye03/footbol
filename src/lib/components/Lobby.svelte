<script lang="ts">
	import { browser } from '$app/environment';
	import * as m from '$lib/paraglide/messages';
	import type { PlayerSlot } from '$lib/game/state';

	interface Props {
		code: string;
		players: Record<string, PlayerSlot>;
		order: string[];
		you: string;
		connected: boolean;
		boardSize?: number;
	}

	let { code, players, order, you, connected, boardSize = 0 }: Props = $props();

	const joined = $derived(order.length >= 2);
	const link = browser ? location.href : '';

	let copied = $state(false);

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(location.href);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			/* clipboard unavailable */
		}
	}

	const initial = (name: string | undefined) => (name?.trim()?.[0] ?? '?').toUpperCase();
</script>

<main
	class="relative z-10 mx-auto grid max-w-[1080px] gap-6 px-7 pt-6 pb-20 md:grid-cols-[1.1fr_1fr]"
>
	<!-- players + status -->
	<section class="panel flex flex-col rounded-[22px] p-7">
		<div class="mb-6 flex items-center justify-between">
			<span class="font-display text-2xl font-extrabold">{m.lobby_title()}</span>
			<span
				class="flex items-center gap-1.5 text-xs font-bold {connected
					? 'text-lime'
					: 'text-[#ffb27a]'}"
			>
				<span
					class="h-2 w-2 rounded-full"
					style="background:{connected ? '#c6ff3a' : '#ff7a1a'}"
					aria-hidden="true"
				></span>
				{connected ? m.conn_connected() : m.conn_connecting()}
			</span>
		</div>

		<div class="mb-6 flex flex-col gap-3">
			{#each [0, 1] as slot (slot)}
				{@const id = order[slot]}
				{#if id}
					{@const isYou = id === you}
					<div
						class="flex items-center gap-3.5 rounded-[14px] border px-4 py-3.5 {isYou
							? 'border-lime/30 bg-lime/10'
							: 'border-white/12 bg-white/[0.05]'}"
					>
						<span
							class="flex h-[42px] w-[42px] items-center justify-center rounded-full text-base font-black"
							style="background:{isYou
								? 'linear-gradient(135deg,#c6ff3a,#7fae1f);color:#0a1f08'
								: 'linear-gradient(135deg,#ff7a1a,#b34d08);color:#fff'}"
							>{initial(players[id]?.name)}</span
						>
						<div>
							<div class="font-extrabold">
								{players[id]?.name}{isYou ? ` ${m.you_suffix()}` : ''}
							</div>
							<div class="text-xs text-mut">
								{slot === 0 ? m.lobby_host() : m.lobby_opponent()}
							</div>
						</div>
						<span class="ml-auto text-[13px] font-extrabold text-lime"
							>✓ {slot === 0 ? m.lobby_ready() : m.lobby_joined_tag()}</span
						>
					</div>
				{:else}
					<div
						class="flex items-center gap-3.5 rounded-[14px] border-[1.5px] border-dashed border-white/16 bg-white/[0.03] px-4 py-3.5"
					>
						<span
							class="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-white/[0.06]"
						>
							<span class="flex gap-1" aria-hidden="true">
								<span class="dot"></span>
								<span class="dot" style="animation-delay:.2s"></span>
								<span class="dot" style="animation-delay:.4s"></span>
							</span>
						</span>
						<div class="text-sm font-semibold text-mut">{m.lobby_waiting_player()}</div>
					</div>
				{/if}
			{/each}
		</div>

		<div class="mt-auto">
			{#if boardSize > 0}
				<div class="mb-2 text-xs font-bold tracking-wide text-mut2 uppercase">
					{m.lobby_setup()}
				</div>
				<div class="text-sm text-mut">{m.lobby_board_size()}: {boardSize}</div>
			{/if}
			<p class="mt-3 text-sm font-semibold text-mut" role="status">
				{joined ? m.lobby_start() + '…' : m.lobby_waiting_short()}
			</p>
		</div>
	</section>

	<!-- invite -->
	<section class="panel rounded-[22px] p-7 text-center">
		<div class="font-display mb-1 text-[22px] font-extrabold">{m.lobby_invite()}</div>
		<div class="mb-5 text-[13px] text-mut2">{m.lobby_invite_sub()}</div>

		<div class="mb-3 rounded-[14px] border border-white/12 bg-black/30 p-4">
			<div class="mb-1.5 text-[11px] tracking-[0.1em] text-mut2 uppercase">
				{m.lobby_room_code()}
			</div>
			<div class="font-display text-[42px] font-black tracking-[0.16em] text-lime">{code}</div>
		</div>

		<div class="flex gap-2">
			<div
				class="flex flex-1 items-center overflow-hidden rounded-[11px] border border-white/12 bg-black/30 px-3 text-[13px] font-semibold whitespace-nowrap text-mut"
			>
				{link}
			</div>
			<button
				type="button"
				onclick={copyLink}
				class="rounded-[11px] border border-white/16 px-4 font-extrabold whitespace-nowrap transition {copied
					? 'bg-lime text-ink'
					: 'bg-white/10 text-white hover:bg-white/15'}"
			>
				{copied ? m.lobby_copied() : m.lobby_copy()}
			</button>
		</div>
	</section>
</main>
