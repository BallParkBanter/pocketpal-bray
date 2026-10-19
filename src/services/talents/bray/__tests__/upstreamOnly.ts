// Shared test util (not a test file). Bray registers extra talents (tablet_*,
// notes, MCP ...); upstream tests that count talents count these five only.
export const UPSTREAM_TALENTS = [
  'render_html',
  'calculate',
  'datetime',
  'web_search',
  'read_url',
];

export const upstreamOnly = <T extends {function: {name: string}}>(
  s: T[],
): T[] => s.filter(x => UPSTREAM_TALENTS.includes(x.function.name));
