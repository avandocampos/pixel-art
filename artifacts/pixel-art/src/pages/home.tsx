import { useRef, useState, useCallback, useEffect } from "react";
import { convertToPixelArt, DEFAULT_OPTIONS, PixelArtOptions } from "@/lib/pixelArt";
import { BUILTIN_PALETTES, LospecPalette, fetchLospecPalette, parseHexList } from "@/lib/lospecPalettes";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STYLE_PRESETS = [
  { name: "8-bit Classic", blockSize: 8, paletteSize: 16 },
  { name: "16-bit Sharp", blockSize: 5, paletteSize: 32 },
  { name: "Chunky Retro", blockSize: 14, paletteSize: 12 },
  { name: "Hi-Res Detail", blockSize: 3, paletteSize: 64 },
  { name: "Mosaic", blockSize: 20, paletteSize: 8 },
  { name: "Portrait", blockSize: 6, paletteSize: 48 },
];

type PaletteTab = "builtin" | "lospec" | "custom";
type ViewMode = "result" | "original" | "compare";

function ColorSwatch({ color }: { color: [number, number, number] }) {
  const hex = `#${color.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  return <div className="w-4 h-4 rounded-sm border border-black/10 shrink-0" style={{ backgroundColor: hex }} title={hex} />;
}

// ─── Before / After compare slider ─────────────────────────────────────────
//
// O truque está em ter uma caixa única para ambas as imagens.
// O lado original define o tamanho do quadro e o lado processado ocupa
// exatamente a mesma área, com um recorte horizontal controlado por ratio.

function CompareSlider({ originalUrl, resultUrl }: { originalUrl: string; resultUrl: string }) {
  const [ratio, setRatio] = useState(0.5);
  const [dragging, setDragging] = useState(false);
  const [boxSize, setBoxSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const frameRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const naturalRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  // Ajusta a caixa ao espaço disponível mantendo a proporção da imagem
  // original (mesma lógica do maxWidth/maxHeight: contém, nunca amplia).
  const recompute = useCallback(() => {
    const frame = frameRef.current;
    const nat = naturalRef.current;
    if (!frame || !nat.w || !nat.h) return;
    const aw = frame.clientWidth;
    const ah = frame.clientHeight;
    if (aw <= 0 || ah <= 0) return;
    const scale = Math.min(aw / nat.w, ah / nat.h, 1);
    setBoxSize({ w: Math.round(nat.w * scale), h: Math.round(nat.h * scale) });
  }, []);

  // Carrega a imagem original só para obter as dimensões naturais.
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      naturalRef.current = { w: img.naturalWidth, h: img.naturalHeight };
      recompute();
    };
    img.src = originalUrl;
  }, [originalUrl, recompute]);

  // Recalcula quando o frame muda de tamanho (resize, sidebar, etc.).
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const ro = new ResizeObserver(() => recompute());
    ro.observe(frame);
    window.addEventListener("resize", recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [recompute]);

  const updateRatio = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    setRatio(Math.min(0.98, Math.max(0.02, (clientX - rect.left) / rect.width)));
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => updateRatio(e.clientX);
    const onUp = () => setDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, updateRatio]);

  return (
    <div className="absolute inset-0 p-4">
      <div ref={frameRef} className="w-full h-full flex items-center justify-center overflow-hidden">
        {boxSize.w > 0 && (
        <div
          ref={containerRef}
          className="relative overflow-hidden select-none shadow-xl rounded-sm"
          style={{
            width: `${boxSize.w}px`,
            height: `${boxSize.h}px`,
            lineHeight: 0,
            touchAction: "none",
            cursor: "ew-resize",
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            setDragging(true);
            updateRatio(e.clientX);
          }}
        >
          <img
            src={originalUrl}
            alt="Original"
            draggable={false}
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              objectFit: "fill",
              userSelect: "none",
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: `${ratio * 100}%`,
              height: "100%",
              overflow: "hidden",
            }}
          >
            {/* Largura fixa = caixa inteira, então a imagem é RECORTADA
                pelo overflow do pai, não espremida — alinhando os lados. */}
            <img
              src={resultUrl}
              alt="Pixel Art"
              draggable={false}
              style={{
                display: "block",
                width: `${boxSize.w}px`,
                height: `${boxSize.h}px`,
                maxWidth: "none",
                objectFit: "fill",
                imageRendering: "pixelated",
                userSelect: "none",
                pointerEvents: "none",
              }}
            />
          </div>

        <div className="pointer-events-none absolute bottom-2 left-2 z-10 text-[10px] font-mono bg-black/60 text-white px-1.5 py-0.5 rounded">
          Pixel Art
        </div>
        <div className="pointer-events-none absolute bottom-2 right-2 z-10 text-[10px] font-mono bg-black/60 text-white px-1.5 py-0.5 rounded">
          Original
        </div>

        <div
          className="pointer-events-none absolute inset-y-0 z-20"
          style={{
            left: `${ratio * 100}%`,
            width: "2px",
            transform: "translateX(-50%)",
            background: "white",
            boxShadow: "0 0 6px rgba(0,0,0,0.8)",
          }}
        />

        <div
          className="pointer-events-none absolute top-1/2 z-30"
          style={{ left: `${ratio * 100}%`, transform: "translate(-50%, -50%)" }}
        >
          <div className="w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 9l-4 3 4 3M16 9l4 3-4 3" />
            </svg>
          </div>
        </div>
        </div>
        )}
      </div>
    </div>
  );
}

// ─── Palette card ──────────────────────────────────────────────────────────────

function PaletteCard({ palette, selected, onClick }: { palette: LospecPalette; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-2.5 rounded-lg border transition-all ${selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40 hover:bg-muted/50"}`}
    >
      <div className="flex flex-wrap gap-0.5 mb-1.5">
        {palette.colors.slice(0, 32).map((c, i) => <ColorSwatch key={i} color={c} />)}
        {palette.colors.length > 32 && <span className="text-[10px] text-muted-foreground self-center ml-0.5">+{palette.colors.length - 32}</span>}
      </div>
      <p className="text-xs font-medium leading-tight truncate">{palette.name}</p>
      <p className="text-[10px] text-muted-foreground leading-tight">{palette.colors.length} colors{palette.author ? ` · ${palette.author}` : ""}</p>
    </button>
  );
}

function SidebarContent({
  options, activeStylePreset, selectedPalette, paletteTab, lospecInput, lospecError,
  isFetchingPalette, customHexInput, allLospecPalettes,
  updateOption, applyStylePreset, setPaletteTab, setLospecInput, setLospecError,
  fetchLospec, setCustomHexInput, applyCustomHex, applyPalette, clearPalette,
}: {
  options: PixelArtOptions;
  activeStylePreset: string | null;
  selectedPalette: LospecPalette | null;
  paletteTab: PaletteTab;
  lospecInput: string;
  lospecError: string | null;
  isFetchingPalette: boolean;
  customHexInput: string;
  allLospecPalettes: LospecPalette[];
  updateOption: <K extends keyof PixelArtOptions>(key: K, value: PixelArtOptions[K]) => void;
  applyStylePreset: (p: (typeof STYLE_PRESETS)[0]) => void;
  setPaletteTab: (t: PaletteTab) => void;
  setLospecInput: (v: string) => void;
  setLospecError: (v: string | null) => void;
  fetchLospec: () => void;
  setCustomHexInput: (v: string) => void;
  applyCustomHex: () => void;
  applyPalette: (p: LospecPalette | null) => void;
  clearPalette: () => void;
}) {
  const [paletteOpen, setPaletteOpen] = useState(true);
  return (
    <div className="p-4 space-y-5">
      {/* Style Presets */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Style Presets</p>
        <div className="flex flex-wrap gap-1.5">
          {STYLE_PRESETS.map((p) => (
            <button key={p.name} onClick={() => applyStylePreset(p)}
              className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${activeStylePreset === p.name ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50 hover:bg-muted"}`}>
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Pixel Size */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label className="text-sm font-medium">Base Pixel Size</Label>
          <Badge variant="secondary" className="font-mono text-xs">{options.blockSize}px</Badge>
        </div>
        <Slider min={2} max={32} step={1} value={[options.blockSize]} onValueChange={([v]) => updateOption("blockSize", v)} />
        <p className="text-xs text-muted-foreground">Starting block size — detail areas go smaller</p>
      </div>

      {!options.customPalette && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label className="text-sm font-medium">Auto Palette</Label>
            <Badge variant="secondary" className="font-mono text-xs">{options.paletteSize} colors</Badge>
          </div>
          <Slider min={4} max={128} step={2} value={[options.paletteSize]} onValueChange={([v]) => updateOption("paletteSize", v)} />
          <p className="text-xs text-muted-foreground">Extracted from your image</p>
        </div>
      )}

      {/* Toggles */}
      <div className="space-y-3">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label className="text-sm font-medium">Enhance Contrast</Label>
            <Badge variant="secondary" className="font-mono text-xs">{options.enhanceContrast}%</Badge>
          </div>
          <Slider min={0} max={100} step={5} value={[options.enhanceContrast]} onValueChange={([v]) => updateOption("enhanceContrast", v)} />
          <p className="text-xs text-muted-foreground">Boost light/dark separation</p>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label className="text-sm font-medium">Brightness</Label>
            <Badge variant="secondary" className="font-mono text-xs">{options.brightness > 0 ? `+${options.brightness}` : options.brightness}</Badge>
          </div>
          <Slider min={-100} max={100} step={5} value={[options.brightness]} onValueChange={([v]) => updateOption("brightness", v)} />
          <p className="text-xs text-muted-foreground">Shift overall luminosity</p>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="dithering" className="text-sm font-medium cursor-pointer">Dithering</Label>
            <p className="text-xs text-muted-foreground">Smoother gradients on small palettes</p>
          </div>
          <Switch id="dithering" checked={options.dithering} onCheckedChange={(v) => updateOption("dithering", v)} />
        </div>
      </div>

      {/* Palette Picker */}
      <div>
        <button
          onClick={() => setPaletteOpen((v) => !v)}
          className="flex w-full items-center justify-between mb-2 group"
        >
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Color Palette</p>
          <div className="flex items-center gap-2">
            {selectedPalette && (
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => { e.stopPropagation(); clearPalette(); }}
                className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
              >Clear</span>
            )}
            <svg
              className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${paletteOpen ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>
        {paletteOpen && (
          <>
            {selectedPalette && (
              <div className="mb-3 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex flex-wrap gap-0.5 mb-1">
                  {selectedPalette.colors.slice(0, 40).map((c, i) => <ColorSwatch key={i} color={c} />)}
                </div>
                <p className="text-xs font-medium">{selectedPalette.name}</p>
                <p className="text-[10px] text-muted-foreground">{selectedPalette.colors.length} colors active</p>
              </div>
            )}
            <div className="flex rounded-md border border-border overflow-hidden text-xs mb-3">
              {(["builtin", "lospec", "custom"] as PaletteTab[]).map((tab) => (
                <button key={tab} onClick={() => setPaletteTab(tab)}
                  className={`flex-1 py-1.5 capitalize transition-colors ${paletteTab === tab ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>
                  {tab === "builtin" ? "Built-in" : tab === "lospec" ? "Lospec" : "Custom"}
                </button>
              ))}
            </div>
            {paletteTab === "builtin" && (
              <div className="space-y-1.5">
                {allLospecPalettes.map((palette) => (
                  <PaletteCard key={palette.slug ?? palette.name} palette={palette}
                    selected={selectedPalette?.name === palette.name}
                    onClick={() => selectedPalette?.name === palette.name ? clearPalette() : applyPalette(palette)} />
                ))}
              </div>
            )}
            {paletteTab === "lospec" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Paste a palette name or URL from{" "}
                  <a href="https://lospec.com/palette-list" target="_blank" rel="noopener noreferrer" className="text-primary underline">lospec.com/palette-list</a>
                </p>
                <div className="flex gap-2">
                  <input type="text" value={lospecInput} onChange={(e) => { setLospecInput(e.target.value); setLospecError(null); }}
                    onKeyDown={(e) => e.key === "Enter" && fetchLospec()}
                    placeholder="e.g. pico-8 or full URL"
                    className="flex-1 min-w-0 text-xs px-2.5 py-1.5 rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                  <Button size="sm" onClick={fetchLospec} disabled={isFetchingPalette || !lospecInput.trim()} className="text-xs shrink-0">
                    {isFetchingPalette ? <span className="w-3 h-3 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin inline-block" /> : "Load"}
                  </Button>
                </div>
                {lospecError && <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">{lospecError}</p>}
              </div>
            )}
            {paletteTab === "custom" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Paste hex colors separated by spaces, commas, or newlines.</p>
                <textarea value={customHexInput} onChange={(e) => setCustomHexInput(e.target.value)}
                  placeholder={"#ff004d #ffa300 #ffec27\n#00e436 #29adff ..."}
                  rows={4} className="w-full text-xs px-2.5 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary font-mono resize-none" />
                {customHexInput.trim() && (() => {
                  const colors = parseHexList(customHexInput);
                  return colors.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {colors.map((c, i) => <ColorSwatch key={i} color={c} />)}
                      <span className="text-[10px] text-muted-foreground self-center ml-1">{colors.length} colors</span>
                    </div>
                  ) : null;
                })()}
                <Button size="sm" className="w-full text-xs" onClick={applyCustomHex} disabled={!customHexInput.trim()}>
                  Apply Custom Palette
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [options, setOptions] = useState<PixelArtOptions>({ ...DEFAULT_OPTIONS });
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("result");
  const [zoom, setZoom] = useState(1);
  const [activeStylePreset, setActiveStylePreset] = useState<string | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [paletteTab, setPaletteTab] = useState<PaletteTab>("builtin");
  const [selectedPalette, setSelectedPalette] = useState<LospecPalette | null>(null);
  const [lospecInput, setLospecInput] = useState("");
  const [lospecError, setLospecError] = useState<string | null>(null);
  const [isFetchingPalette, setIsFetchingPalette] = useState(false);
  const [customHexInput, setCustomHexInput] = useState("");
  const [fetchedPalettes, setFetchedPalettes] = useState<LospecPalette[]>([]);

  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const processingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optionsRef = useRef<PixelArtOptions>({ ...DEFAULT_OPTIONS });
  const processingVersionRef = useRef(0);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const processImage = useCallback((img: HTMLImageElement, opts: PixelArtOptions) => {
    const canvas = hiddenCanvasRef.current;
    if (!canvas) return;
    const version = processingVersionRef.current + 1;
    processingVersionRef.current = version;
    setIsProcessing(true);
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    setTimeout(() => {
      if (version !== processingVersionRef.current) return;
      const result = convertToPixelArt(canvas, opts);
      setResultUrl(result.toDataURL("image/png"));
      setIsProcessing(false);
    }, 50);
  }, []);

  const scheduleProcess = useCallback((opts: PixelArtOptions) => {
    if (!imageRef.current) return;
    if (processingTimer.current) clearTimeout(processingTimer.current);
    processingTimer.current = setTimeout(() => {
      processImage(imageRef.current!, opts);
    }, 300);
  }, [processImage]);

  const loadFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const nextOptions = { ...DEFAULT_OPTIONS };
    setOriginalUrl(url);
    setResultUrl(null);
    setZoom(1);
    setViewMode("result");
    setOptions(nextOptions);
    optionsRef.current = nextOptions;
    setActiveStylePreset(null);
    setSelectedPalette(null);
    setCustomHexInput("");
    setLospecInput("");
    setLospecError(null);
    setPaletteTab("builtin");
    processingVersionRef.current += 1;

    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      const canvas = hiddenCanvasRef.current!;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      processImage(img, nextOptions);
    };
    img.src = url;
  }, [processImage]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  };

  const updateOption = <K extends keyof PixelArtOptions>(key: K, value: PixelArtOptions[K]) => {
    const next = { ...optionsRef.current, [key]: value };
    setOptions(next);
    optionsRef.current = next;
    setActiveStylePreset(null);
    scheduleProcess(next);
  };

  const applyStylePreset = (preset: (typeof STYLE_PRESETS)[0]) => {
    const next = { ...optionsRef.current, blockSize: preset.blockSize, paletteSize: preset.paletteSize };
    setOptions(next);
    optionsRef.current = next;
    setActiveStylePreset(preset.name);
    scheduleProcess(next);
  };

  const applyPalette = useCallback((palette: LospecPalette | null) => {
    setSelectedPalette(palette);
    const next = { ...optionsRef.current, customPalette: palette?.colors };
    setOptions(next);
    optionsRef.current = next;
    scheduleProcess(next);
  }, [scheduleProcess]);

  const clearPalette = () => {
    setSelectedPalette(null);
    const next = { ...optionsRef.current, customPalette: undefined };
    setOptions(next);
    optionsRef.current = next;
    scheduleProcess(next);
  };

  const fetchLospec = async () => {
    if (!lospecInput.trim()) return;
    setLospecError(null);
    setIsFetchingPalette(true);
    try {
      const palette = await fetchLospecPalette(lospecInput.trim());
      setFetchedPalettes((prev) => {
        const exists = prev.find((p) => p.slug === palette.slug);
        return exists ? prev : [palette, ...prev];
      });
      applyPalette(palette);
      setLospecInput("");
    } catch (err) {
      setLospecError(err instanceof Error ? err.message : "Failed to fetch palette");
    } finally {
      setIsFetchingPalette(false);
    }
  };

  const applyCustomHex = () => {
    const colors = parseHexList(customHexInput);
    if (!colors.length) return;
    applyPalette({ name: "Custom Palette", colors });
  };

  const downloadResult = () => {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = "pixel-art.png";
    a.click();
  };

  useEffect(() => () => { if (processingTimer.current) clearTimeout(processingTimer.current); }, []);

  const allLospecPalettes = [...fetchedPalettes, ...BUILTIN_PALETTES];

  const sidebarProps = {
    options, activeStylePreset, selectedPalette, paletteTab, lospecInput, lospecError,
    isFetchingPalette, customHexInput, allLospecPalettes,
    updateOption, applyStylePreset, setPaletteTab, setLospecInput, setLospecError,
    fetchLospec, setCustomHexInput, applyCustomHex, applyPalette, clearPalette,
  };

  return (
    <div className="h-screen max-w-full bg-background text-foreground flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-border px-3 sm:px-6 py-3 flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-bold text-sm font-mono">PX</span>
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-base leading-none truncate">PixelForge</h1>
            <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">AI edge-aware pixel art converter</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Controls toggle — visible only on mobile */}
          <button
            className="md:hidden flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border bg-background hover:bg-muted transition-colors"
            onClick={() => setControlsOpen((v) => !v)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
            </svg>
            Controls
          </button>
          {resultUrl && <Button onClick={downloadResult} size="sm" className="text-xs">Download</Button>}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — desktop collapsible, mobile hidden */}
        <aside className={`hidden md:flex flex-col border-r border-border bg-card shrink-0 transition-all duration-200 ${sidebarCollapsed ? "w-10 overflow-hidden" : "w-72"}`}>
          <div className={`flex items-center shrink-0 border-b border-border ${sidebarCollapsed ? "justify-center py-2" : "justify-end px-2 py-1.5"}`}>
            <button
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors text-muted-foreground"
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarCollapsed ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} />
              </svg>
            </button>
          </div>
          {!sidebarCollapsed && (
            <div className="flex-1 overflow-y-auto">
              <SidebarContent {...sidebarProps} />
            </div>
          )}
        </aside>

        {/* Main area */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Mobile controls drawer */}
          <div
            className="md:hidden flex flex-col border-border bg-card overflow-y-auto transition-all duration-300 ease-in-out"
            style={{
              maxHeight: controlsOpen ? "55vh" : "0px",
              opacity: controlsOpen ? 1 : 0,
              borderBottomWidth: controlsOpen ? "1px" : "0px",
              pointerEvents: controlsOpen ? undefined : "none",
            }}
          >
            <SidebarContent {...sidebarProps} />
          </div>

          {/* Canvas area */}
          {!originalUrl ? (
            <div
              className={`flex-1 flex flex-col items-center justify-center p-6 transition-colors ${isDragging ? "bg-primary/5 border-2 border-dashed border-primary rounded-xl m-4" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <div className="max-w-sm w-full text-center space-y-5">
                <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-muted flex items-center justify-center">
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold">Drop an image here</h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    Convert any image to pixel art with edge-aware processing.
                  </p>
                </div>
                <Button onClick={() => fileInputRef.current?.click()} size="lg" className="w-full sm:w-auto">Choose Image</Button>
                <p className="text-xs text-muted-foreground">Supports JPG, PNG, WebP, GIF</p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Toolbar */}
              <div className="border-b border-border px-3 py-2 flex items-center gap-2 shrink-0 flex-wrap">
                <div className="flex rounded-lg border border-border overflow-hidden text-sm">
                  <button onClick={() => setViewMode("result")}
                    className={`px-3 py-1.5 transition-colors ${viewMode === "result" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>
                    Pixel Art
                  </button>
                  <button onClick={() => setViewMode("original")}
                    className={`px-3 py-1.5 transition-colors ${viewMode === "original" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>
                    Original
                  </button>
                  <button onClick={() => setViewMode("compare")}
                    className={`px-3 py-1.5 transition-colors ${viewMode === "compare" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>
                    Compare
                  </button>
                </div>
                {selectedPalette && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 border border-primary/20 text-xs text-primary font-medium min-w-0">
                    <div className="flex gap-0.5 shrink-0">
                      {selectedPalette.colors.slice(0, 6).map((c, i) => <ColorSwatch key={i} color={c} />)}
                    </div>
                    <span className="truncate">{selectedPalette.name}</span>
                  </div>
                )}
                <button onClick={() => fileInputRef.current?.click()} className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto shrink-0">
                  Change image
                </button>
                {isProcessing && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                    <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Processing…
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </div>

              {/* Image display */}
              <div className="flex-1 min-h-0 relative bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:20px_20px]">
                {/* Zoom controls — oculto no modo compare */}
                {viewMode !== "compare" && (
                  <div className="absolute top-3 right-3 flex flex-col items-center gap-1 z-10">
                    <button
                      onClick={() => setZoom((z) => Math.min(1, parseFloat((z + 0.25).toFixed(2))))}
                      disabled={zoom >= 1}
                      className="w-7 h-7 rounded border border-border bg-background/90 backdrop-blur-sm hover:bg-muted flex items-center justify-center text-base font-bold shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Zoom in"
                    >+</button>
                    <span className="text-[10px] text-muted-foreground font-mono leading-tight">{Math.round(zoom * 100)}%</span>
                    <button
                      onClick={() => setZoom((z) => Math.max(0.25, parseFloat((z - 0.25).toFixed(2))))}
                      disabled={zoom <= 0.25}
                      className="w-7 h-7 rounded border border-border bg-background/90 backdrop-blur-sm hover:bg-muted flex items-center justify-center text-base font-bold shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Zoom out"
                    >−</button>
                  </div>
                )}
                {viewMode === "compare" && resultUrl ? (
                  <CompareSlider originalUrl={originalUrl!} resultUrl={resultUrl} />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center p-4">
                    {viewMode === "original" ? (
                      <img
                        src={originalUrl}
                        alt="Original"
                        className="shadow-xl rounded-sm"
                        style={{
                          imageRendering: "auto",
                          maxWidth: "100%",
                          maxHeight: "100%",
                          transform: zoom !== 1 ? `scale(${zoom})` : undefined,
                          transformOrigin: "center center",
                        }}
                      />
                    ) : resultUrl ? (
                      <img
                        src={resultUrl}
                        alt="Pixel Art"
                        className="shadow-xl rounded-sm"
                        style={{
                          imageRendering: "pixelated",
                          maxWidth: "100%",
                          maxHeight: "100%",
                          transform: zoom !== 1 ? `scale(${zoom})` : undefined,
                          transformOrigin: "center center",
                        }}
                      />
                    ) : (
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm">Generating pixel art…</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <canvas ref={hiddenCanvasRef} className="hidden" />
    </div>
  );
}
