import { json } from '@sveltejs/kit';
import { getFylker, getKommunerForFylke, setNxrBase } from '$lib/api/udir/nxrClient';
import { isOstlandet } from '$lib/api/udir/ostlandet';
import { env } from '$env/dynamic/private';

function initBase() {
	if (env.NXR_API_URL) setNxrBase(env.NXR_API_URL);
}

function unwrap<T>(raw: unknown): T[] {
	if (Array.isArray(raw)) return raw as T[];
	const wrapped = raw as { data?: unknown[] };
	return (wrapped.data ?? []) as T[];
}

export async function GET({ url }) {
	initBase();
	const type = url.searchParams.get('type');
	const id = url.searchParams.get('id') ?? '';

	try {
		if (type === 'fylker') {
			// getFylker() already returns normalised Fylke[] with string fields
			const alle = await getFylker();
			const ostlandet = alle.filter(f => isOstlandet(f.navn));
			return json({ data: ostlandet });
		}

		if (type === 'kommuner' && id) {
			const data = unwrap(await getKommunerForFylke(id));
			return json({ data });
		}

		// Skole-nivå er ikke tilgjengelig via NXR /api/v2/ — returner tomt
		if (type === 'skoler') {
			return json({ data: [], note: 'Skole-oppslag ikke tilgjengelig via NXR /api/v2/' });
		}

		return json({ error: 'Ugyldig eller manglende type-parameter' }, { status: 400 });
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		console.error('[geografi]', msg);
		return json({ error: msg }, { status: 502 });
	}
}
