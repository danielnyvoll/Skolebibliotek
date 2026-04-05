/**
 * nsrClient.ts — Oslo school discovery via UDIR EnhetID tree
 *
 * The UDIR filterVerdier endpoint returns a tree of units:
 *   nivaa 0 = root ("Alle")
 *   nivaa 1 = national aggregate
 *   nivaa 2 = county (fylke)  — Oslo: kode "03"
 *   nivaa 3 = municipality    — Oslo: kode "0301" (Oslo is both county and municipality)
 *   nivaa 4 = individual school  (kode = Norwegian org number)
 *
 * We traverse the tree to find the Oslo node and collect all descendant schools.
 * The school's internal UDIR `id` is what must be used in EnhetID(…) API queries.
 */

import { getFilterTree, type EnhetNode } from './elevundersokelsenClient';

export interface UdirSkole {
	nsrId: string;       // String(EnhetNode.id) — use for EnhetID(…) API queries
	kode: string;        // Norwegian org number (9 digits), e.g. "975280888"
	navn: string;
	kommunenummer: string;
}

// ── In-memory cache ───────────────────────────────────────────────────────────
const _cache = new Map<string, { data: UdirSkole[]; exp: number }>();

// ── Tree helpers ──────────────────────────────────────────────────────────────
function collectSchools(tree: EnhetNode[], node: EnhetNode): UdirSkole[] {
	if (node.nivaa === 4) {
		return [{ nsrId: String(node.id), kode: node.kode, navn: node.navn, kommunenummer: '0301' }];
	}
	if (!node.barn || node.barn.length === 0) return [];
	const result: UdirSkole[] = [];
	for (const childIndeks of node.barn) {
		const child = tree[childIndeks];
		if (child) result.push(...collectSchools(tree, child));
	}
	return result;
}

function findOsloNode(tree: EnhetNode[]): EnhetNode | null {
	// Oslo is special: it is both county (kode "03", nivaa 2) and municipality (kode "0301", nivaa 3).
	// Prefer county-level entry so we get all schools in one subtree.
	return (
		tree.find(e => e.kode === '03'   && e.nivaa === 2) ??
		tree.find(e => e.kode === '0301' && e.nivaa === 3) ??
		tree.find(e => e.navn?.toLowerCase() === 'oslo' && e.nivaa <= 3) ??
		null
	);
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns all Oslo schools for use in UDIR data queries. */
export async function getOsloSkoler(eksportId = 148): Promise<UdirSkole[]> {
	const key = `oslo_${eksportId}`;
	const hit = _cache.get(key);
	if (hit && Date.now() < hit.exp) return hit.data;

	try {
		const tree = await getFilterTree(eksportId);
		const enhetTree = tree.EnhetID;

		const osloNode = findOsloNode(enhetTree);
		if (!osloNode) {
			console.warn('[nsrClient] Oslo node not found in EnhetID tree. Available nivaa-2 entries:',
				enhetTree.filter(e => e.nivaa === 2).map(e => `${e.kode}=${e.navn}`));
			return [];
		}

		console.info(`[nsrClient] Oslo node: id=${osloNode.id} kode=${osloNode.kode} nivaa=${osloNode.nivaa} children=${osloNode.barn?.length ?? 0}`);

		const schools = collectSchools(enhetTree, osloNode);

		// Deduplicate by internal id
		const seen = new Set<string>();
		const unique = schools.filter(s => {
			if (seen.has(s.nsrId)) return false;
			seen.add(s.nsrId);
			return true;
		});

		console.info(`[nsrClient] Collected ${unique.length} unique Oslo schools`);

		if (unique.length > 0) {
			_cache.set(key, { data: unique, exp: Date.now() + 30 * 60_000 });
		}
		return unique;
	} catch (e) {
		console.error('[nsrClient] getOsloSkoler error:', e);
		return [];
	}
}

/** Returns raw EnhetID entries for the debug panel (shows actual id/kode/name/nivaa). */
export async function getRawGeoSample(): Promise<{ verdi: string; displayNavn: string; nivaa?: number; kode?: string }[]> {
	try {
		const tree = await getFilterTree(148);
		return tree.EnhetID.slice(0, 60).map(e => ({
			verdi: String(e.id),
			displayNavn: e.navn,
			nivaa: e.nivaa,
			kode: e.kode
		}));
	} catch {
		return [];
	}
}
