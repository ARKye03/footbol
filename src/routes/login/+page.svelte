<script lang="ts">
	import { enhance } from '$app/forms';
	import * as m from '$lib/paraglide/messages';

	let { form } = $props();

	// initial tab follows which action errored on the server
	// svelte-ignore state_referenced_locally
	let tab = $state<'signin' | 'signup'>(form?.error === 'signup' ? 'signup' : 'signin');

	const tabClass = (on: boolean) =>
		`flex-1 rounded-lg py-2.5 text-sm font-bold transition ${
			on ? 'bg-lime/16 text-lime' : 'text-mut2 hover:text-fog'
		}`;
</script>

<svelte:head><title>{m.login_title()} · {m.app_title()}</title></svelte:head>

<main class="relative z-10 mx-auto max-w-[440px] px-7 pt-6 pb-20">
	<div class="panel rounded-[22px] p-7">
		<h2 class="font-display mb-1 text-center text-[34px] font-black">{m.login_title()}</h2>
		<p class="mb-5 text-center text-sm text-mut2">{m.login_sub()}</p>

		<form method="POST" action="?/guest" use:enhance>
			<button
				type="submit"
				class="w-full rounded-xl bg-lime py-3.5 text-base font-extrabold text-ink transition hover:brightness-105"
				style="box-shadow:0 8px 22px rgba(198,255,58,.25)">{m.login_continue_guest()}</button
			>
		</form>

		<div
			class="my-4.5 flex items-center gap-3 text-xs font-semibold text-mut3"
			style="margin:18px 0"
		>
			<span class="h-px flex-1 bg-white/10"></span>{m.login_or()}<span
				class="h-px flex-1 bg-white/10"
			></span>
		</div>

		<div class="mb-4 flex rounded-[10px] bg-black/25 p-1">
			<button type="button" class={tabClass(tab === 'signin')} onclick={() => (tab = 'signin')}
				>{m.login_signin()}</button
			>
			<button type="button" class={tabClass(tab === 'signup')} onclick={() => (tab = 'signup')}
				>{m.login_signup()}</button
			>
		</div>

		{#if form?.error}
			<div
				class="mb-3.5 rounded-[10px] border border-orange/40 bg-orange/[0.14] px-3 py-2.5 text-[13px] font-semibold text-[#ffb27a]"
				role="alert"
			>
				⚠ {tab === 'signup' ? m.login_signup_error() : m.login_error()}
			</div>
		{/if}

		<form method="POST" action="?/{tab}" use:enhance>
			<label
				for="login-email"
				class="mb-1.5 block text-xs font-bold tracking-wide text-mut uppercase"
				>{m.login_email()}</label
			>
			<input
				id="login-email"
				name="email"
				type="email"
				autocomplete="email"
				value={form?.email ?? ''}
				placeholder="you@email.com"
				class="mb-3.5 w-full rounded-[10px] border-[1.5px] border-white/14 bg-black/25 px-3.5 py-3 text-[15px] text-white outline-none focus:border-lime/60"
			/>
			<label
				for="login-password"
				class="mb-1.5 block text-xs font-bold tracking-wide text-mut uppercase"
				>{m.login_password()}</label
			>
			<input
				id="login-password"
				name="password"
				type="password"
				autocomplete={tab === 'signup' ? 'new-password' : 'current-password'}
				placeholder="••••••••"
				class="mb-4.5 w-full rounded-[10px] border-[1.5px] border-white/14 bg-black/25 px-3.5 py-3 text-[15px] text-white outline-none focus:border-lime/60"
				style="margin-bottom:18px"
			/>
			<button
				type="submit"
				class="w-full rounded-xl border border-white/20 bg-white/10 py-3.5 text-[15px] font-extrabold text-white transition hover:bg-white/15"
			>
				{tab === 'signup' ? m.login_signup() : m.login_signin()}
			</button>
		</form>

		<p class="mt-4.5 text-center text-[12.5px] leading-relaxed text-mut3" style="margin-top:18px">
			{m.login_upgrade_note()}
		</p>
	</div>
	<p class="mt-4 text-center text-xs text-mut3">{m.login_optional()}</p>
</main>
