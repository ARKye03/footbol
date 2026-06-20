<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();

	let copied = $state(false);

	async function copyLink() {
		await navigator.clipboard.writeText(location.href);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
</script>

<svelte:head><title>Room {data.code} — footbol</title></svelte:head>

<main>
	<a class="back" href={resolve('/')}>← Home</a>

	<h1>Room <code>{data.code}</code></h1>
	<p class="me">You are <strong>{data.me.name}</strong></p>

	<button type="button" onclick={copyLink}>{copied ? 'Link copied!' : 'Copy invite link'}</button>

	<p class="note">
		Waiting for the realtime layer — live play (board, chat, turns) connects over the WebSocket in
		Phase 3. The signed <code>wsToken</code> is ready in the page data.
	</p>
</main>

<style>
	main {
		max-width: 36rem;
		margin: 0 auto;
		padding: 2rem 1.5rem;
		font-family: system-ui, sans-serif;
	}
	.back {
		color: #166534;
		text-decoration: none;
		font-size: 0.9rem;
	}
	h1 {
		margin: 0.75rem 0 0.25rem;
	}
	code {
		font-family: ui-monospace, monospace;
		letter-spacing: 0.1em;
	}
	.me {
		margin: 0 0 1.25rem;
		color: #52525b;
	}
	button {
		padding: 0.5rem 1rem;
		border: 1px solid #166534;
		border-radius: 0.5rem;
		background: #166534;
		color: #fff;
		font-size: 0.9rem;
		cursor: pointer;
	}
	.note {
		margin-top: 1.5rem;
		color: #71717a;
		font-size: 0.85rem;
		line-height: 1.5;
	}
</style>
