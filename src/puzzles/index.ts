import type { PuzzleModule } from '../types';

const KEYPAD_THUMB = `<svg viewBox="0 0 120 120" fill="none">
  <rect x="10" y="10" width="28" height="28" rx="5" fill="#555"/>
  <rect x="46" y="10" width="28" height="28" rx="5" fill="#ff6600"/>
  <rect x="82" y="10" width="28" height="28" rx="5" fill="#555"/>
  <rect x="10" y="46" width="28" height="28" rx="5" fill="#555"/>
  <rect x="46" y="46" width="28" height="28" rx="5" fill="#ff6600"/>
  <rect x="82" y="46" width="28" height="28" rx="5" fill="#555"/>
  <rect x="10" y="82" width="28" height="28" rx="5" fill="#ff6600"/>
  <rect x="46" y="82" width="28" height="28" rx="5" fill="#555"/>
  <rect x="82" y="82" width="28" height="28" rx="5" fill="#555"/>
</svg>`;

const VJOLT_THUMB = `<svg viewBox="0 0 120 120" fill="none">
  <rect x="15" y="10" width="90" height="60" rx="4" stroke="#888" stroke-width="2" fill="none"/>
  <text x="60" y="30" text-anchor="middle" font-family="monospace" font-size="10" fill="#888" dominant-baseline="middle">1+3=4</text>
  <text x="60" y="44" text-anchor="middle" font-family="monospace" font-size="10" fill="#888" dominant-baseline="middle">4+6=10</text>
  <text x="60" y="58" text-anchor="middle" font-family="monospace" font-size="10" fill="#888" dominant-baseline="middle">10+7=17</text>
  <rect x="30" y="78" width="18" height="30" rx="3" stroke="#666" stroke-width="1.5" fill="#4488ff" opacity="0.5"/>
  <rect x="52" y="78" width="18" height="30" rx="3" stroke="#666" stroke-width="1.5" fill="#ff4444" opacity="0.5"/>
  <rect x="74" y="78" width="18" height="30" rx="3" stroke="#666" stroke-width="1.5" fill="#ffcc00" opacity="0.5"/>
  <text x="39" y="100" text-anchor="middle" font-family="monospace" font-size="6" fill="#aaa">W</text>
  <text x="61" y="100" text-anchor="middle" font-family="monospace" font-size="6" fill="#aaa">R</text>
  <text x="83" y="100" text-anchor="middle" font-family="monospace" font-size="6" fill="#aaa">Y</text>
</svg>`;

const SAFE_THUMB = `<svg viewBox="0 0 120 120" fill="none">
  <circle cx="60" cy="60" r="50" stroke="#555" stroke-width="5"/>
  <circle cx="60" cy="60" r="35" stroke="#ff6600" stroke-width="4"/>
  <circle cx="60" cy="60" r="8" fill="#ff6600"/>
  <line x1="60" y1="10" x2="60" y2="22" stroke="#ff6600" stroke-width="3"/>
  <line x1="60" y1="98" x2="60" y2="110" stroke="#555" stroke-width="3"/>
  <line x1="10" y1="60" x2="22" y2="60" stroke="#555" stroke-width="3"/>
  <line x1="98" y1="60" x2="110" y2="60" stroke="#555" stroke-width="3"/>
  <line x1="25" y1="25" x2="33" y2="33" stroke="#555" stroke-width="2"/>
  <line x1="95" y1="25" x2="87" y2="33" stroke="#555" stroke-width="2"/>
  <line x1="95" y1="95" x2="87" y2="87" stroke="#555" stroke-width="2"/>
  <line x1="25" y1="95" x2="33" y2="87" stroke="#555" stroke-width="2"/>
</svg>`;

const PP_THUMB = `<svg viewBox="0 0 120 120" fill="none">
  <rect x="10" y="16" width="100" height="8" rx="2" fill="#555"/>
  <rect x="86" y="16" width="24" height="8" rx="2" fill="#cc0000"/>
  <polygon points="55,14 61,26 49,26" fill="#cc0000"/>
  <text x="28" y="38" text-anchor="middle" fill="#aaa" font-size="6">0</text>
  <text x="60" y="38" text-anchor="middle" fill="#aaa" font-size="6">50</text>
  <text x="96" y="38" text-anchor="middle" fill="#aaa" font-size="6">100</text>
  <rect x="8" y="52" width="16" height="42" rx="2" fill="#444"/>
  <rect x="28" y="52" width="16" height="42" rx="2" fill="#ff6600"/>
  <rect x="48" y="52" width="16" height="42" rx="2" fill="#444"/>
  <rect x="68" y="52" width="16" height="42" rx="2" fill="#444"/>
  <rect x="88" y="52" width="16" height="42" rx="2" fill="#444"/>
  <text x="16" y="86" text-anchor="middle" fill="#ff6600" font-size="6">+36</text>
  <text x="36" y="86" text-anchor="middle" fill="#ff6600" font-size="6">+36</text>
  <text x="56" y="86" text-anchor="middle" fill="#ff6600" font-size="6">+36</text>
  <text x="76" y="86" text-anchor="middle" fill="#ff6600" font-size="6">+36</text>
  <text x="96" y="86" text-anchor="middle" fill="#ff6600" font-size="6">+36</text>
  <text x="16" y="100" text-anchor="middle" fill="#888" font-size="7">1</text>
  <text x="36" y="100" text-anchor="middle" fill="#888" font-size="7">2</text>
  <text x="56" y="100" text-anchor="middle" fill="#888" font-size="7">3</text>
  <text x="76" y="100" text-anchor="middle" fill="#888" font-size="7">4</text>
  <text x="96" y="100" text-anchor="middle" fill="#888" font-size="7">5</text>
</svg>`;

const STAGLA_THUMB = `<svg viewBox="0 0 120 120" fill="none">
  <rect x="15" y="15" width="90" height="90" rx="10" stroke="#555" stroke-width="3" fill="none"/>
  <circle cx="40" cy="40" r="14" fill="#ff6600"/>
  <circle cx="80" cy="40" r="14" fill="#555"/>
  <circle cx="40" cy="80" r="14" fill="#555"/>
  <circle cx="80" cy="80" r="14" fill="#555"/>
  <text x="40" y="45" text-anchor="middle" fill="#fff" font-size="12" font-weight="bold">A</text>
  <text x="80" y="45" text-anchor="middle" fill="#fff" font-size="12" font-weight="bold">B</text>
  <text x="40" y="85" text-anchor="middle" fill="#fff" font-size="12" font-weight="bold">C</text>
  <text x="80" y="85" text-anchor="middle" fill="#fff" font-size="12" font-weight="bold">D</text>
</svg>`;

const GRAVEYARD_THUMB = `<svg viewBox="0 0 120 120" fill="none">
  <circle cx="60" cy="60" r="48" stroke="#555" stroke-width="4"/>
  <circle cx="60" cy="60" r="12" fill="#ff6600"/>
  <circle cx="60" cy="60" r="8" fill="#111"/>
  <text x="60" y="18" text-anchor="middle" fill="#888" font-size="14">☠</text>
  <text x="88" y="42" text-anchor="middle" fill="#888" font-size="12">★</text>
  <text x="88" y="80" text-anchor="middle" fill="#888" font-size="12">※</text>
  <text x="60" y="104" text-anchor="middle" fill="#888" font-size="14">†</text>
  <text x="30" y="80" text-anchor="middle" fill="#888" font-size="12">◆</text>
  <text x="30" y="42" text-anchor="middle" fill="#888" font-size="12">◈</text>
</svg>`;

const SLIDING_THUMB = `<svg viewBox="0 0 120 120" fill="none">
  <rect x="6" y="6" width="34" height="34" rx="5" fill="#ff6600"/>
  <text x="23" y="29" text-anchor="middle" fill="#fff" font-size="14" font-weight="bold">1</text>
  <rect x="44" y="6" width="34" height="34" rx="5" fill="#555"/>
  <text x="61" y="29" text-anchor="middle" fill="#fff" font-size="14" font-weight="bold">2</text>
  <rect x="82" y="6" width="34" height="34" rx="5" fill="#555"/>
  <text x="99" y="29" text-anchor="middle" fill="#fff" font-size="14" font-weight="bold">3</text>
  <rect x="6" y="44" width="34" height="34" rx="5" fill="#555"/>
  <text x="23" y="67" text-anchor="middle" fill="#fff" font-size="14" font-weight="bold">4</text>
  <rect x="44" y="44" width="34" height="34" rx="5" fill="#555"/>
  <text x="61" y="67" text-anchor="middle" fill="#fff" font-size="14" font-weight="bold">5</text>
  <rect x="82" y="44" width="34" height="34" rx="5" fill="#555"/>
  <text x="99" y="67" text-anchor="middle" fill="#fff" font-size="14" font-weight="bold">6</text>
  <rect x="6" y="82" width="34" height="34" rx="5" fill="#555"/>
  <text x="23" y="105" text-anchor="middle" fill="#fff" font-size="14" font-weight="bold">7</text>
  <rect x="44" y="82" width="34" height="34" rx="5" fill="#555"/>
  <text x="61" y="105" text-anchor="middle" fill="#fff" font-size="14" font-weight="bold">8</text>
  <rect x="82" y="82" width="34" height="34" rx="5" fill="#222" stroke="#555" stroke-width="2"/>
</svg>`;

const LAB_THUMB = `<svg viewBox="0 0 120 120" fill="none">
  <rect x="6" y="6" width="34" height="34" rx="4" fill="#1a1a1a" stroke="#2288ff" stroke-width="2"/>
  <text x="23" y="29" text-anchor="middle" fill="#66bbff" font-size="18" font-weight="bold">\u25B6</text>
  <rect x="43" y="6" width="34" height="34" rx="4" fill="#1a1a1a" stroke="#22cc44" stroke-width="2"/>
  <text x="60" y="29" text-anchor="middle" fill="#44ee66" font-size="18" font-weight="bold">\u25BC</text>
  <rect x="80" y="6" width="34" height="34" rx="4" fill="#1a1a1a" stroke="#ffcc00" stroke-width="2"/>
  <text x="97" y="29" text-anchor="middle" fill="#ffdd44" font-size="18" font-weight="bold">\u25C0</text>
  <rect x="6" y="43" width="34" height="34" rx="4" fill="#1a1a1a" stroke="#ff3333" stroke-width="2"/>
  <text x="23" y="66" text-anchor="middle" fill="#ff6666" font-size="18" font-weight="bold">\u25B2</text>
  <rect x="43" y="43" width="34" height="34" rx="4" fill="#1a1a1a" stroke="#2288ff" stroke-width="2"/>
  <text x="60" y="66" text-anchor="middle" fill="#66bbff" font-size="18" font-weight="bold">\u25B6</text>
  <rect x="80" y="43" width="34" height="34" rx="4" fill="#1a1a1a" stroke="#22cc44" stroke-width="2"/>
  <text x="97" y="66" text-anchor="middle" fill="#44ee66" font-size="18" font-weight="bold">\u25BC</text>
  <rect x="6" y="80" width="34" height="34" rx="4" fill="#1a1a1a" stroke="#ffcc00" stroke-width="2"/>
  <text x="23" y="103" text-anchor="middle" fill="#ffdd44" font-size="18" font-weight="bold">\u25C0</text>
  <rect x="43" y="80" width="34" height="34" rx="4" fill="#1a1a1a" stroke="#ff3333" stroke-width="2"/>
  <text x="60" y="103" text-anchor="middle" fill="#ff6666" font-size="18" font-weight="bold">\u25B2</text>
  <rect x="80" y="80" width="34" height="34" rx="4" fill="#1a1a1a" stroke="#ff8800" stroke-width="2"/>
  <text x="97" y="103" text-anchor="middle" fill="#ff8800" font-size="18" font-weight="bold">\u25C9</text>
</svg>`;

const PLANT43_THUMB = `<svg viewBox="0 0 120 120" fill="none">
  <rect x="10" y="20" width="20" height="80" rx="3" stroke="#888" stroke-width="2" fill="none"/>
  <rect x="18" y="20" width="4" height="80" rx="1" fill="#0a0"/>
  <rect x="50" y="20" width="20" height="80" rx="3" stroke="#888" stroke-width="2" fill="none"/>
  <rect x="58" y="60" width="4" height="40" rx="1" fill="#0a0"/>
  <rect x="90" y="20" width="20" height="80" rx="3" stroke="#888" stroke-width="2" fill="none"/>
  <rect x="98" y="80" width="4" height="20" rx="1" fill="#0a0"/>
  <line x1="18" y1="40" x2="38" y2="40" stroke="#f00" stroke-width="2.5"/>
  <circle cx="16" cy="18" r="6" fill="#c00"/>
  <circle cx="56" cy="18" r="6" fill="#00c"/>
  <circle cx="96" cy="18" r="6" fill="#0a0"/>
</svg>`;

const MODULES: Array<{
    id: string;
    slug: string;
    sourceGame: string;
    name: string;
    thumbnail: string;
}> = [
    { id: 'keypad', slug: 'keypad', sourceGame: 're1', name: 'Keypad', thumbnail: KEYPAD_THUMB },
    { id: 'vjolt', slug: 'v-jolt', sourceGame: 're1r', name: 'V-JOLT', thumbnail: VJOLT_THUMB },
    {
        id: 'portableSafe',
        slug: 'portable-safe',
        sourceGame: 're2r',
        name: 'Portable Safe',
        thumbnail: SAFE_THUMB,
    },
    {
        id: 'powerPanel',
        slug: 'power-panel',
        sourceGame: 're2',
        name: 'Power Panel',
        thumbnail: PP_THUMB,
    },
    { id: 'stagla', slug: 'stagla', sourceGame: 're3', name: 'Stagla', thumbnail: STAGLA_THUMB },
    {
        id: 'graveyard',
        slug: 'graveyard',
        sourceGame: 're4',
        name: 'Graveyard',
        thumbnail: GRAVEYARD_THUMB,
    },
    {
        id: 'slidingBlock',
        slug: 'sliding-block',
        sourceGame: 're4',
        name: 'Sliding Block',
        thumbnail: SLIDING_THUMB,
    },
    {
        id: 'labPuzzle',
        slug: 'lab-puzzle',
        sourceGame: 're4',
        name: 'Lab Puzzle',
        thumbnail: LAB_THUMB,
    },
    {
        id: 'plant43',
        slug: 'plant-43',
        sourceGame: 're2r',
        name: 'Plant 43',
        thumbnail: PLANT43_THUMB,
    },
];

export const puzzles = new Map<string, PuzzleModule>(
    MODULES.map(
        (m) =>
            [
                m.id,
                {
                    ...m,
                    create() {
                        return { destroy() {} };
                    },
                },
            ] as [string, PuzzleModule],
    ),
);

export const puzzleOrder = MODULES.map((m) => m.id);

export const puzzlesByPath = new Map<string, PuzzleModule>();
for (const p of puzzles.values()) {
    puzzlesByPath.set(`${p.sourceGame}/${p.slug}`, p);
}
