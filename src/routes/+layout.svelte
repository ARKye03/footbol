<script lang="ts">
	import { resolve } from '$app/paths';
	import LangSwitcher from '$lib/components/LangSwitcher.svelte';
	import * as m from '$lib/paraglide/messages';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="min-h-screen bg-white text-zinc-900">
	<header class="flex items-center justify-between border-b border-zinc-200 px-4 py-2">
		<a href={resolve('/')} class="font-bold text-green-800">{m.app_title()}</a>
		<LangSwitcher />
	</header>
	{@render children()}
</div>
