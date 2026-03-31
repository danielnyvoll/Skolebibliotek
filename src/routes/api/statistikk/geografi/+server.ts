import { json } from '@sveltejs/kit';
import { getFylker, getKommuner, getSkoler, setNxrBase } from '$lib/api/udir/nxrClient';
import { isOstlandet } from '$lib/api/udir/ostlandet';
import { env } from '$env/dynamic/private';

function initBase() {
	if (env.NXR_API_URL) setNxrBase(env.NXR_API_URL);
}

export async function GET({ url }) {
	initBase();
	const type = url.searchParams.get('type');
	const id = url.searchParams.get('id') ?? undefined;

	try {
		if (type === 'fylker') {
			const alle = await getFylker();
			// Support both array and wrapped response shapes
			const list = Array.isArray(alle) ? alle : (alle as { data?: unknown[] }).data ?? [];
			const ostlandet = (list as { navn: string }[]).filter(f => isOstlandet(f.navn));
			return json({ data: ostlandet });
		}

		if (type === 'kommuner') {
			const data = await getKommuner(id);
			const list = Array.isArray(data) ? data : (data as { data?: unknown[] }).data ?? [];
			return json({ data: list });
		}

		if (type === 'skoler' && id) {
			const data = await getSkoler(id);
			const list = Array.isArray(data) ? data : (data as { data?: unknown[] }).data ?? [];
			return json({ data: list });
		}

		return json({ error: 'Ugyldig type-parameter' }, { status: 400 });
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		console.error('[geografi]', msg);
		return json({ error: msg }, { status: 502 });
	}
}
