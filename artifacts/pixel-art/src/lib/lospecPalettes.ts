export interface LospecPalette {
  name: string;
  author?: string;
  slug?: string;
  colors: [number, number, number][];
}

function hex(h: string): [number, number, number] {
  const v = h.replace("#", "");
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function pal(name: string, author: string, slug: string, hexColors: string[]): LospecPalette {
  return { name, author, slug, colors: hexColors.map(hex) };
}

export const BUILTIN_PALETTES: LospecPalette[] = [
  pal("Game Boy", "Nintendo", "gameboy", ["0f380f", "306230", "8bac0f", "9bbc0f"]),
  pal("PICO-8", "Lexaloffle", "pico-8", [
    "000000", "1d2b53", "7e2553", "008751",
    "ab5236", "5f574f", "c2c3c7", "fff1e8",
    "ff004d", "ffa300", "ffec27", "00e436",
    "29adff", "83769c", "ff77a8", "ffccaa",
  ]),
  pal("Sweetie 16", "GrafxKid", "sweetie-16", [
    "1a1c2c", "5d275d", "b13e53", "ef7d57",
    "ffcd75", "a7f070", "38b764", "257179",
    "29366f", "3b5dc9", "41a6f6", "73eff7",
    "f4f4f4", "94b0c2", "566c86", "333c57",
  ]),
  pal("DB32", "DawnBringer", "dawnbringer32", [
    "000000", "222034", "45283c", "663931",
    "8f563b", "df7126", "d9a066", "eec39a",
    "fbf236", "99e550", "6abe30", "37946e",
    "4b692f", "524b24", "323c39", "3f3f74",
    "306082", "5b6ee1", "639bff", "5fcde4",
    "cbdbfc", "ffffff", "9badb7", "847e87",
    "696a6a", "595652", "76428a", "ac3232",
    "d95763", "d77bba", "8f974a", "8a6f30",
  ]),
  pal("Endesga 32", "Endesga", "endesga-32", [
    "be4a2f", "d77643", "ead4aa", "e4a672",
    "b86f50", "733e39", "3e2731", "a22633",
    "e43b44", "f77622", "feae34", "fee761",
    "63c74d", "3e8948", "265c42", "193c3e",
    "124e89", "0099db", "2ce8f5", "ffffff",
    "c0cbdc", "8b9bb4", "5a6988", "3a4466",
    "262b44", "181425", "ff0044", "68386c",
    "b55088", "f6757a", "e8b796", "c28569",
  ]),
  pal("Resurrect 64", "Kerrie Lake", "resurrect-64", [
    "2e222f", "3e3546", "625565", "966c6c",
    "ab947a", "694f62", "7f708a", "9babb2",
    "c7dcd7", "ffffff", "6e2727", "b33831",
    "ea4f36", "f57d4a", "ae2334", "e83b3b",
    "fb6b1d", "f79617", "f9c22b", "7a3045",
    "9e4539", "cd683d", "e6904e", "fbb954",
    "4c3e24", "676633", "a2a947", "d5e04b",
    "8a9f37", "394a17", "c6d94a", "f0f0a6",
    "b5c78c", "7a8c5e", "5a6e36", "3b4827",
    "26301f", "213b25", "3c6e41", "5da329",
    "94e050", "c2f560", "47b53c", "0b6321",
    "14a02e", "1d7e41", "17adaa", "14b8c2",
    "3dc2c2", "60c3d1", "2f878c", "065e6b",
    "0b4068", "1164a9", "2996c3", "5ac0e4",
    "b5ebe3", "8dd8e5", "567891", "1b4a52",
    "2a4e6a", "3e6695", "578cc7", "b1cde8",
  ]),
  pal("1-Bit Monitor Glow", "Polyducks", "1bit-monitor-glow", ["222323", "f0f6f0"]),
  pal("Arne 16", "Arne Niklas Jansson", "arne-16", [
    "000000", "493c2b", "be2633", "e06f8b",
    "9d9d9d", "a46422", "eb8931", "f7e26b",
    "ffffff", "1b2632", "2f484e", "44891a",
    "a3ce27", "005784", "31a2f2", "b2dcef",
  ]),
  pal("CGA", "IBM", "cga", [
    "000000", "0000aa", "00aa00", "00aaaa",
    "aa0000", "aa00aa", "aa5500", "aaaaaa",
    "555555", "5555ff", "55ff55", "55ffff",
    "ff5555", "ff55ff", "ffff55", "ffffff",
  ]),
  pal("NES", "Nintendo", "nintendo-entertainment-system", [
    "626262", "001fb2", "2404c8", "5200b2",
    "730076", "800024", "730b00", "522800",
    "244400", "005700", "005c00", "005324",
    "003c76", "000000", "000000", "000000",
    "ababab", "0d57ff", "4b30ff", "8a13ff",
    "bc08d6", "d21269", "c72e00", "a84b00",
    "6c6e00", "1c8600", "009200", "008844",
    "006e9a", "000000", "000000", "000000",
    "ffffff", "53aeff", "9085ff", "d365ff",
    "ff57ff", "ff5dcf", "ff7757", "fa9e00",
    "bdc700", "7ae700", "67f300", "5ef58a",
    "00e4d0", "4f4f4f", "000000", "000000",
    "ffffff", "b6dfff", "cec1ff", "e9b3ff",
    "ffb3ff", "ffb5ef", "ffc6c3", "ffd59a",
    "e9e681", "cef481", "c0fb9e", "bdfcd0",
    "00fbfc", "c4c4c4", "000000", "000000",
  ]),
  pal("AAP-64", "Adigunpolack", "aap-64", [
    "060608", "141013", "3b1725", "73172d",
    "b4202a", "df3e23", "fa6a0a", "f9a31b",
    "ffd541", "fffc40", "d6f264", "9cdb43",
    "59c135", "14a02e", "1a7a3e", "24523b",
    "122020", "143464", "285cc4", "249fde",
    "20d6c7", "a6fcdb", "ffffff", "fef3c0",
    "fad6b8", "f5a097", "e86a73", "be4a2f",
    "9e3a34", "7e2533", "5b1f2d", "35121a",
    "2b1328", "5c1a4e", "9e286e", "d81879",
    "f84fa5", "f5b8ca", "e8f7f7", "b3e4e4",
    "7bc8c8", "4e9999", "2f7070", "1c4f4f",
    "0b2b2e", "0d4a6d", "0e7c9e", "0db6d8",
    "79dfe8", "d4f1f7", "e2d7e9", "b0a8c0",
    "786080", "4d3558", "271c3a", "080420",
    "1e1e1e", "3f3f3f", "5f5f5f", "7f7f7f",
    "9f9f9f", "bfbfbf", "dfdfdf", "ffffff",
  ]),
];

function hexToRgb(h: string): [number, number, number] {
  const v = h.replace("#", "").toLowerCase();
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

export function parseHexList(raw: string): [number, number, number][] {
  const tokens = raw.match(/[0-9a-fA-F]{6}/g) ?? [];
  return tokens.map(hexToRgb);
}

export async function fetchLospecPalette(slugOrUrl: string): Promise<LospecPalette> {
  let slug = slugOrUrl.trim();
  const urlMatch = slug.match(/lospec\.com\/palette-list\/([^/?#.]+)/);
  if (urlMatch) slug = urlMatch[1];
  slug = slug.replace(/\.json$/, "").replace(/^\/+|\/+$/g, "");

  const url = `https://lospec.com/palette-list/${slug}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Palette "${slug}" not found (${res.status})`);

  const data = await res.json() as { name?: string; author?: string; colors?: string[] };
  if (!data.colors?.length) throw new Error("No colors in palette response");

  return {
    name: data.name ?? slug,
    author: data.author,
    slug,
    colors: data.colors.map(hexToRgb),
  };
}
