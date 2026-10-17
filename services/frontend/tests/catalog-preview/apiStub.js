// Imported only instead of CourseList's ./api; never forwards an arbitrary URL.
let scene = 'baseline';
export function setPreviewScene(value) { scene = value; }

export default {
    async get(requestPath) {
        const input = new URL(requestPath, 'http://catalog-preview.invalid/');
        const operation = {
            '/courses/': 'courses',
            '/courses/categories/': 'categories',
            '/courses/promo-slots/': 'promo-slots',
        }[input.pathname];
        if (input.origin !== 'http://catalog-preview.invalid' || !operation) {
            throw new Error(`Unexpected API route blocked by isolated catalog preview: ${requestPath}`);
        }
        const query = new URLSearchParams({ scene });
        for (const key of ['search', 'category']) if (input.searchParams.has(key)) query.set(key, input.searchParams.get(key));
        const response = await fetch(`/__catalog_preview__/${operation}?${query}`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw Object.assign(new Error(data.detail), { response: { status: response.status, data } });
        return { data };
    },
};
