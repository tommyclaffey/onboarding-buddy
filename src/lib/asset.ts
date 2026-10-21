/** Public file path that also works when the app is served from a sub-path (the GitHub Pages demo). */
export const asset = (p: string) => import.meta.env.BASE_URL.replace(/\/$/, '') + p;
