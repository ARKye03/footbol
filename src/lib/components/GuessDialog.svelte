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
	class="fixed inset-0 z-90 flex items-center justify-center p-6"
	style="background:rgba(3,10,7,.78);backdrop-filter:blur(4px)"
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
		class="max-w-[380px] rounded-[20px] border border-orange/40 bg-panel p-6.5 text-center"
		style="padding:26px;box-shadow:0 30px 80px rgba(0,0,0,.6)"
	>
		<div
			class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange/[0.16] text-[26px]"
			aria-hidden="true"
		>
			⚠
		</div>
		<h2 id="guess-title" class="font-display mb-2 text-[26px] font-extrabold">{m.guess_title()}</h2>
		<p id="guess-desc" class="mb-2 text-[14.5px] leading-relaxed text-mut">
			{m.guess_confirm({ name })}
		</p>
		<p class="mb-5.5 text-[13px] font-bold text-[#ff9a5a]" style="margin-bottom:22px">
			{m.guess_warn()}
		</p>
		<div class="flex gap-2.5">
			<button
				type="button"
				onclick={onCancel}
				class="flex-1 rounded-[11px] border border-white/[0.18] bg-white/[0.08] py-3.25 font-extrabold text-white transition hover:bg-white/15"
				style="padding-top:13px;padding-bottom:13px"
			>
				{m.guess_cancel()}
			</button>
			<button
				{@attach autofocus}
				type="button"
				onclick={onConfirm}
				class="flex-1 rounded-[11px] bg-orange py-3.25 font-extrabold text-white transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange/60"
				style="padding-top:13px;padding-bottom:13px"
			>
				{m.guess_confirm_button()}
			</button>
		</div>
	</div>
</div>
