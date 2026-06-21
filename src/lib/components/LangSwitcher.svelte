<script lang="ts">
	import type { Pathname } from '$app/types';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import * as m from '$lib/paraglide/messages';
	import { getLocale, localizeHref, locales } from '$lib/paraglide/runtime';

	const current = $derived(getLocale());
</script>

<nav class="flex rounded-full bg-white/[0.06] p-[3px]" aria-label={m.lang_label()}>
	{#each locales as locale (locale)}
		<a
			href={resolve(localizeHref(page.url.pathname, { locale }) as Pathname)}
			aria-current={locale === current ? 'true' : undefined}
			class="rounded-full px-[11px] py-[5px] text-xs font-extrabold uppercase transition {locale ===
			current
				? 'bg-lime text-ink'
				: 'text-mut hover:text-fog'}"
		>
			{locale}
		</a>
	{/each}
</nav>
