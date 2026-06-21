<script lang="ts">
	import type { Pathname } from '$app/types';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import * as m from '$lib/paraglide/messages';
	import { getLocale, localizeHref, locales } from '$lib/paraglide/runtime';

	const current = $derived(getLocale());
</script>

<nav class="flex items-center gap-1 text-xs" aria-label={m.lang_label()}>
	{#each locales as locale (locale)}
		<a
			href={resolve(localizeHref(page.url.pathname, { locale }) as Pathname)}
			aria-current={locale === current ? 'true' : undefined}
			class="rounded px-1.5 py-0.5 font-medium uppercase {locale === current
				? 'bg-green-700 text-white'
				: 'text-zinc-500 hover:text-zinc-800'}"
		>
			{locale}
		</a>
	{/each}
</nav>
