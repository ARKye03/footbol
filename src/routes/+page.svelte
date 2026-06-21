<script lang="ts">
	import { enhance } from '$app/forms';
	import * as m from '$lib/paraglide/messages';

	let { data, form } = $props();

	// seeded once from server data; the field is then user-editable
	// svelte-ignore state_referenced_locally
	let name = $state(data.name);
</script>

<svelte:head><title>{m.app_title()} — {m.app_tagline()}</title></svelte:head>

<main class="mx-auto max-w-md px-5 py-10">
	<header class="mb-8 text-center">
		<h1 class="text-3xl font-bold text-green-800">{m.app_title()}</h1>
		<p class="mt-1 text-sm text-zinc-500">{m.app_tagline()}</p>
	</header>

	<label class="block">
		<span class="text-sm font-medium text-zinc-700">{m.home_name_label()}</span>
		<input
			bind:value={name}
			name="name"
			form="create-form"
			placeholder={m.home_name_placeholder()}
			maxlength="24"
			class="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 focus:border-green-600 focus:outline-none"
		/>
	</label>

	<form
		id="create-form"
		method="POST"
		action="?/create"
		use:enhance
		class="mt-6 rounded-xl border border-zinc-200 p-4"
	>
		<h2 class="font-semibold">{m.home_create_heading()}</h2>
		<label class="mt-2 block text-sm">
			<span class="text-zinc-600">{m.home_pool_label()}</span>
			<select
				name="pool"
				class="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 focus:border-green-600 focus:outline-none"
			>
				{#each data.pools as pool (pool.id)}
					<option value={pool.id}>{pool.label}</option>
				{/each}
			</select>
		</label>
		<button
			type="submit"
			class="mt-3 w-full rounded-md bg-green-700 px-4 py-2 font-medium text-white hover:bg-green-800"
		>
			{m.home_create_button()}
		</button>
	</form>

	<form
		method="POST"
		action="?/join"
		use:enhance
		class="mt-4 rounded-xl border border-zinc-200 p-4"
	>
		<h2 class="font-semibold">{m.home_join_heading()}</h2>
		<input type="hidden" name="name" value={name} />
		<label class="mt-2 block text-sm">
			<span class="text-zinc-600">{m.home_code_label()}</span>
			<input
				name="code"
				maxlength="4"
				autocomplete="off"
				class="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-center font-mono text-lg tracking-widest uppercase focus:border-green-600 focus:outline-none"
			/>
		</label>
		{#if form?.codeError}
			<p class="mt-1 text-sm text-red-600">{m.home_error_code()}</p>
		{/if}
		<button
			type="submit"
			class="mt-3 w-full rounded-md border border-green-700 px-4 py-2 font-medium text-green-800 hover:bg-green-50"
		>
			{m.home_join_button()}
		</button>
	</form>
</main>
