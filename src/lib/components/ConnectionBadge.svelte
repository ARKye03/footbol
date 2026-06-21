<script lang="ts">
	import * as m from '$lib/paraglide/messages';

	interface Props {
		connected: boolean;
		opponentLeft: boolean;
	}

	let { connected, opponentLeft }: Props = $props();
</script>

<span
	class="flex items-center gap-1.5 text-[11.5px] font-bold {connected
		? 'text-lime'
		: 'text-[#ffb27a]'}"
	aria-live="polite"
>
	<span
		class="h-2 w-2 rounded-full"
		style="background:{connected ? '#c6ff3a' : '#ff7a1a'}"
		aria-hidden="true"
	></span>
	{connected ? m.conn_connected() : m.conn_connecting()}
</span>

{#if opponentLeft}
	<p
		class="mt-2 rounded-[10px] border border-orange/40 bg-orange/[0.12] px-3 py-2 text-sm text-[#ffb27a]"
		role="status"
	>
		{m.conn_opponent_left()}
	</p>
{/if}
