import type { PageServerLoad } from './$types';
import { getFylker, setNxrBase } from '$lib/api/udir/nxrClient';
import { isOstlandet } from '$lib/api/udir/ostlandet';
import { env } from '$env/dynamic/private';

export const load: PageServerLoad = async () => {
	if (env.NXR_API_URL) setNxrBase(env.NXR_API_URL);

	try {
		// getFylker() returns normalised Fylke[] — fields are already strings
		const alle = await getFylker();
		const fylker = alle
			.filter(f => isOstlandet(f.navn))
			.sort((a, b) => a.navn.localeCompare(b.navn, 'nb'));
		return { fylker, geoError: null };
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		return { fylker: [], geoError: msg };
	}
};
