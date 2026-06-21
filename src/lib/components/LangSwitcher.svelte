<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { getLocale, locales, setLocale } from '$lib/paraglide/runtime';

	const current = $derived(getLocale());
</script>

<nav class="flex rounded-full bg-white/[0.06] p-[3px]" aria-label={m.lang_label()}>
	{#each locales as locale (locale)}
		<button
			type="button"
			onclick={() => setLocale(locale)}
			aria-current={locale === current ? 'true' : undefined}
			class="rounded-full px-[11px] py-[5px] text-xs font-extrabold uppercase transition {locale ===
			current
				? 'bg-lime text-ink'
				: 'text-mut hover:text-fog'}"
		>
			{locale}
		</button>
	{/each}
</nav>
