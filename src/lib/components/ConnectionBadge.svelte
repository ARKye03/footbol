<script lang="ts">
	import * as m from '$lib/paraglide/messages';

	interface Props {
		connected: boolean;
		opponentLeft: boolean;
	}

	let { connected, opponentLeft }: Props = $props();
</script>

<div class="flex items-center gap-1.5 text-xs" aria-live="polite">
	<span
		class="h-2 w-2 rounded-full {connected ? 'bg-green-600' : 'bg-amber-500'}"
		aria-hidden="true"
	></span>
	<span class={connected ? 'text-green-700' : 'text-amber-600'}>
		{connected ? m.conn_connected() : m.conn_connecting()}
	</span>
</div>

{#if opponentLeft}
	<p class="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700" role="status">
		{m.conn_opponent_left()}
	</p>
{/if}
