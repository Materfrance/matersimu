/** Limiteur en mémoire (fenêtre glissante par IP). Suffisant pour une seule instance Node. */
export function rateLimiter(max: number, windowMs: number) {
	const hits = new Map<string, number[]>();
	return (key: string): boolean => {
		const now = Date.now();
		const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
		if (list.length >= max) {
			hits.set(key, list);
			return false;
		}
		list.push(now);
		hits.set(key, list);
		if (hits.size > 5000) hits.clear();
		return true;
	};
}
