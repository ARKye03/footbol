<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import type { PlayerSlot } from '$lib/game/state';

	interface Props {
		code: string;
		players: Record<string, PlayerSlot>;
		order: string[];
		you: string;
	}

	let { code, players, order, you }: Props = $props();

	let copied = $state(false);
	async function copyLink() {
		await navigator.clipboard.writeText(location.href);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
</script>

<section class="mx-auto max-w-md text-center">
	<h1 class="text-xl font-semibold">{m.lobby_heading()}</h1>
	<p class="mt-1 text-sm text-zinc-500">{m.lobby_waiting()}</p>

	<div class="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
		<p class="text-sm text-zinc-600">{m.lobby_share()}</p>
		<p class="my-2 font-mono text-3xl font-bold tracking-widest text-green-800">{code}</p>
		<button
			type="button"
			onclick={copyLink}
			class="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
		>
			{copied ? m.lobby_copied() : m.lobby_copy()}
		</button>
	</div>

	<h2 class="mt-5 text-sm font-semibold text-zinc-700">{m.lobby_players()}</h2>
	<ul class="mt-1 flex flex-col items-center gap-1 text-sm">
		{#each order as id (id)}
			<li class:font-semibold={id === you}>
				{players[id]?.name}{id === you ? ` ${m.you_suffix()}` : ''}
			</li>
		{/each}
	</ul>
</section>
