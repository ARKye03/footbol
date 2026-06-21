<script lang="ts">
	import * as m from '$lib/paraglide/messages';

	interface Props {
		name: string;
		onConfirm: () => void;
		onCancel: () => void;
	}

	let { name, onConfirm, onCancel }: Props = $props();

	const autofocus = (node: HTMLElement) => node.focus();
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') onCancel();
	}}
/>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
	role="presentation"
	onclick={(e) => {
		if (e.target === e.currentTarget) onCancel();
	}}
>
	<div
		role="alertdialog"
		aria-modal="true"
		aria-labelledby="guess-title"
		aria-describedby="guess-desc"
		class="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
	>
		<h2 id="guess-title" class="mb-2 text-lg font-semibold">{m.guess_title()}</h2>
		<p id="guess-desc" class="mb-4 text-sm text-zinc-600">{m.guess_confirm({ name })}</p>
		<div class="flex justify-end gap-2">
			<button
				type="button"
				onclick={onCancel}
				class="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
			>
				{m.guess_cancel()}
			</button>
			<button
				{@attach autofocus}
				type="button"
				onclick={onConfirm}
				class="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
			>
				{m.guess_confirm_button()}
			</button>
		</div>
	</div>
</div>
