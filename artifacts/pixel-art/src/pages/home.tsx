import { useRef, useState, useCallback, useEffect } from "react";
import { convertToPixelArt, DEFAULT_OPTIONS, PixelArtOptions } from "@/lib/pixelArt";
import { BUILTIN_PALETTES, LospecPalette, fetchLospecPalette, parseHexList } from "@/lib/lospecPalettes";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STYLE_PRESETS = [
  { name: "8-bit Classic", blockSize: 8, paletteSize: 16, edgeStrength: 0.35, outlineEdges: true },
  { name: "16-bit Sharp", blockSize: 5, paletteSize: 32, edgeStrength: 0.3, outlineEdges: true },
  { name: "Chunky Retro", blockSize: 14, paletteSize: 12, edgeStrength: 0.45, outlineEdges: true },
  { name: "Hi-Res Detail", blockSize: 3, paletteSize: 64, edgeStrength: 0.25, outlineEdges: false },
  { name: "Mosaic", blockSize: 20, paletteSize: 8, edgeStrength: 0.5, outlineEdges: false },
];

type PaletteTab = "builtin" | "lospec" | "custom";

function ColorSwatch({ color }: { color: [number, number, number] }) {
  const hex = `#${color.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  return (
    <div
      className="w-4 h-4 rounded-sm border border-black/10 shrink-0"
      style={{ backgroundColor: hex }}
      title={hex}
    />
  );
}

function PaletteCard({
  palette,
  selected,
  onClick,
}: {
  palette: LospecPalette;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-2.5 rounded-lg border transition-all ${
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border hover:border-primary/40 hover:bg-muted/50"
      }`}
    >
      <div className="flex flex-wrap gap-0.5 mb-1.5">
        {palette.colors.slice(0, 32).map((c, i) => (
          <ColorSwatch key={i} color={c} />
        ))}
        {palette.colors.length > 32 && (
          <span className="text-[10px] text-muted-foreground self-center ml-0.5">
            +{palette.colors.length - 32}
          </span>
        )}
      </div>
      <p className="text-xs font-medium leading-tight truncate">{palette.name}</p>
      <p className="text-[10px] text-muted-foreground leading-tight">
        {palette.colors.length} colors{palette.author ? ` · ${palette.author}` : ""}
      </p>
    </button>
  );
}

export default function Home() {
  const [options, setOptions] = useState<PixelArtOptions>({ ...DEFAULT_OPTIONS });
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [activeStylePreset, setActiveStylePreset] = useState<string | null>(null);

  // Palette state
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

  const processImage = useCallback((img: HTMLImageElement, opts: PixelArtOptions) => {
    const canvas = hiddenCanvasRef.current;
    if (!canvas) return;
    setIsProcessing(true);
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    setTimeout(() => {
      const result = convertToPixelArt(canvas, opts);
      setResultUrl(result.toDataURL("image/png"));
      setIsProcessing(false);
    }, 50);
  }, []);

  const scheduleProcess = useCallback(
    (opts: PixelArtOptions) => {
      if (!imageRef.current) return;
      if (processingTimer.current) clearTimeout(processingTimer.current);
      processingTimer.current = setTimeout(() => {
        processImage(imageRef.current!, opts);
      }, 300);
    },
    [processImage]
  );

  const loadFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const url = URL.createObjectURL(file);
      setOriginalUrl(url);
      setResultUrl(null);
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        processImage(img, options);
      };
      img.src = url;
    },
    [options, processImage]
  );

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
    const next = { ...options, [key]: value };
    setOptions(next);
    setActiveStylePreset(null);
    scheduleProcess(next);
  };

  const applyStylePreset = (preset: (typeof STYLE_PRESETS)[0]) => {
    const next = {
      ...options,
      blockSize: preset.blockSize,
      paletteSize: preset.paletteSize,
      edgeStrength: preset.edgeStrength,
      outlineEdges: preset.outlineEdges,
    };
    setOptions(next);
    setActiveStylePreset(preset.name);
    scheduleProcess(next);
  };

  const applyPalette = useCallback(
    (palette: LospecPalette | null) => {
      setSelectedPalette(palette);
      const next = { ...options, customPalette: palette?.colors };
      setOptions(next);
      scheduleProcess(next);
    },
    [options, scheduleProcess]
  );

  const clearPalette = () => {
    setSelectedPalette(null);
    const next = { ...options, customPalette: undefined };
    setOptions(next);
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
        if (exists) return prev;
        return [palette, ...prev];
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
    if (colors.length === 0) {
      return;
    }
    const palette: LospecPalette = {
      name: "Custom Palette",
      colors,
    };
    applyPalette(palette);
  };

  const downloadResult = () => {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = "pixel-art.png";
    a.click();
  };

  useEffect(() => {
    return () => {
      if (processingTimer.current) clearTimeout(processingTimer.current);
    };
  }, []);

  const allLospecPalettes = [...fetchedPalettes, ...BUILTIN_PALETTES];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm font-mono">PX</span>
          </div>
          <div>
            <h1 className="font-bold text-base leading-none">PixelForge</h1>
            <p className="text-xs text-muted-foreground mt-0.5">AI edge-aware pixel art converter</p>
          </div>
        </div>
        {resultUrl && (
          <Button onClick={downloadResult} size="sm">
            Download PNG
          </Button>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 border-r border-border bg-card flex flex-col shrink-0 overflow-y-auto">
          <div className="p-4 space-y-5">

            {/* Style Presets */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Style Presets</p>
              <div className="flex flex-wrap gap-1.5">
                {STYLE_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => applyStylePreset(p)}
                    className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                      activeStylePreset === p.name
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border hover:border-primary/50 hover:bg-muted"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Block Size */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-medium">Pixel Size</Label>
                <Badge variant="secondary" className="font-mono text-xs">{options.blockSize}px</Badge>
              </div>
              <Slider
                min={2} max={32} step={1}
                value={[options.blockSize]}
                onValueChange={([v]) => updateOption("blockSize", v)}
              />
              <p className="text-xs text-muted-foreground">Larger = chunkier pixels</p>
            </div>

            {/* Palette size (only if no custom palette) */}
            {!options.customPalette && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-sm font-medium">Auto Palette</Label>
                  <Badge variant="secondary" className="font-mono text-xs">{options.paletteSize} colors</Badge>
                </div>
                <Slider
                  min={4} max={128} step={2}
                  value={[options.paletteSize]}
                  onValueChange={([v]) => updateOption("paletteSize", v)}
                />
                <p className="text-xs text-muted-foreground">Extracted from your image</p>
              </div>
            )}

            {/* Edge Strength */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-medium">Edge Sensitivity</Label>
                <Badge variant="secondary" className="font-mono text-xs">{Math.round(options.edgeStrength * 100)}%</Badge>
              </div>
              <Slider
                min={0.05} max={0.9} step={0.05}
                value={[options.edgeStrength]}
                onValueChange={([v]) => updateOption("edgeStrength", v)}
              />
              <p className="text-xs text-muted-foreground">Sobel AI edge detection</p>
            </div>

            {/* Toggles */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="outline" className="text-sm font-medium cursor-pointer">Edge Outlines</Label>
                  <p className="text-xs text-muted-foreground">Darken detected edge pixels</p>
                </div>
                <Switch
                  id="outline"
                  checked={options.outlineEdges}
                  onCheckedChange={(v) => updateOption("outlineEdges", v)}
                />
              </div>
              {options.outlineEdges && (
                <div className="flex items-center justify-between pl-1">
                  <Label htmlFor="outlineColor" className="text-sm text-muted-foreground">Outline Color</Label>
                  <input
                    id="outlineColor"
                    type="color"
                    value={options.outlineColor}
                    onChange={(e) => updateOption("outlineColor", e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent"
                  />
                </div>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="contrast" className="text-sm font-medium cursor-pointer">Enhance Contrast</Label>
                  <p className="text-xs text-muted-foreground">Boost light/dark separation</p>
                </div>
                <Switch
                  id="contrast"
                  checked={options.enhanceContrast}
                  onCheckedChange={(v) => updateOption("enhanceContrast", v)}
                />
              </div>
            </div>

            {/* Palette Picker */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Color Palette</p>
                {selectedPalette && (
                  <button
                    onClick={clearPalette}
                    className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Active palette preview */}
              {selectedPalette && (
                <div className="mb-3 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex flex-wrap gap-0.5 mb-1">
                    {selectedPalette.colors.slice(0, 40).map((c, i) => (
                      <ColorSwatch key={i} color={c} />
                    ))}
                  </div>
                  <p className="text-xs font-medium">{selectedPalette.name}</p>
                  <p className="text-[10px] text-muted-foreground">{selectedPalette.colors.length} colors active</p>
                </div>
              )}

              {/* Tabs */}
              <div className="flex rounded-md border border-border overflow-hidden text-xs mb-3">
                {(["builtin", "lospec", "custom"] as PaletteTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setPaletteTab(tab)}
                    className={`flex-1 py-1.5 capitalize transition-colors ${
                      paletteTab === tab
                        ? "bg-primary text-primary-foreground"
                        : "bg-background hover:bg-muted"
                    }`}
                  >
                    {tab === "builtin" ? "Built-in" : tab === "lospec" ? "Lospec" : "Custom"}
                  </button>
                ))}
              </div>

              {/* Built-in palettes */}
              {paletteTab === "builtin" && (
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
                  {allLospecPalettes.map((palette) => (
                    <PaletteCard
                      key={palette.slug ?? palette.name}
                      palette={palette}
                      selected={selectedPalette?.name === palette.name}
                      onClick={() =>
                        selectedPalette?.name === palette.name
                          ? clearPalette()
                          : applyPalette(palette)
                      }
                    />
                  ))}
                </div>
              )}

              {/* Lospec fetch */}
              {paletteTab === "lospec" && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Paste a palette name or URL from{" "}
                    <a
                      href="https://lospec.com/palette-list"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      lospec.com/palette-list
                    </a>
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={lospecInput}
                      onChange={(e) => { setLospecInput(e.target.value); setLospecError(null); }}
                      onKeyDown={(e) => e.key === "Enter" && fetchLospec()}
                      placeholder="e.g. pico-8 or full URL"
                      className="flex-1 text-xs px-2.5 py-1.5 rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <Button
                      size="sm"
                      onClick={fetchLospec}
                      disabled={isFetchingPalette || !lospecInput.trim()}
                      className="text-xs"
                    >
                      {isFetchingPalette ? (
                        <span className="w-3 h-3 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin inline-block" />
                      ) : (
                        "Load"
                      )}
                    </Button>
                  </div>
                  {lospecError && (
                    <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">{lospecError}</p>
                  )}
                  {fetchedPalettes.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Loaded</p>
                      {fetchedPalettes.map((p) => (
                        <PaletteCard
                          key={p.slug ?? p.name}
                          palette={p}
                          selected={selectedPalette?.name === p.name}
                          onClick={() =>
                            selectedPalette?.name === p.name ? clearPalette() : applyPalette(p)
                          }
                        />
                      ))}
                    </div>
                  )}
                  <div className="text-[11px] text-muted-foreground bg-muted/50 rounded-md p-2.5 leading-relaxed space-y-1">
                    <p className="font-medium">How to use:</p>
                    <p>1. Browse <span className="font-mono">lospec.com/palette-list</span></p>
                    <p>2. Copy the palette slug (e.g. <span className="font-mono">sweetie-16</span>) or the full URL</p>
                    <p>3. Paste it above and click Load</p>
                  </div>
                </div>
              )}

              {/* Custom hex input */}
              {paletteTab === "custom" && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Paste any hex colors separated by spaces, commas, or newlines.
                  </p>
                  <textarea
                    value={customHexInput}
                    onChange={(e) => setCustomHexInput(e.target.value)}
                    placeholder={"#ff004d #ffa300 #ffec27\n#00e436 #29adff ..."}
                    rows={5}
                    className="w-full text-xs px-2.5 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary font-mono resize-none"
                  />
                  {/* Live preview */}
                  {customHexInput.trim() && (() => {
                    const colors = parseHexList(customHexInput);
                    return colors.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {colors.map((c, i) => <ColorSwatch key={i} color={c} />)}
                        <span className="text-[10px] text-muted-foreground self-center ml-1">{colors.length} colors</span>
                      </div>
                    ) : null;
                  })()}
                  <Button
                    size="sm"
                    className="w-full text-xs"
                    onClick={applyCustomHex}
                    disabled={!customHexInput.trim()}
                  >
                    Apply Custom Palette
                  </Button>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main canvas area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-background">
          {!originalUrl ? (
            <div
              className={`flex-1 flex flex-col items-center justify-center p-8 transition-colors ${
                isDragging ? "bg-primary/5 border-2 border-dashed border-primary rounded-xl m-4" : ""
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <div className="max-w-md text-center space-y-6">
                <div className="mx-auto w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
                  <svg className="w-10 h-10 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Drop an image here</h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    AI edge detection preserves outlines — pick a palette from the sidebar to control the exact colors used.
                  </p>
                </div>
                <Button onClick={() => fileInputRef.current?.click()} size="lg">
                  Choose Image
                </Button>
                <p className="text-xs text-muted-foreground">Supports JPG, PNG, WebP, GIF</p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Toolbar */}
              <div className="border-b border-border px-4 py-2 flex items-center gap-3 shrink-0">
                <div className="flex rounded-lg border border-border overflow-hidden text-sm">
                  <button
                    onClick={() => setShowOriginal(false)}
                    className={`px-3 py-1.5 transition-colors ${!showOriginal ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                  >
                    Pixel Art
                  </button>
                  <button
                    onClick={() => setShowOriginal(true)}
                    className={`px-3 py-1.5 transition-colors ${showOriginal ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                  >
                    Original
                  </button>
                </div>
                {selectedPalette && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 border border-primary/20 text-xs text-primary font-medium">
                    <div className="flex gap-0.5">
                      {selectedPalette.colors.slice(0, 8).map((c, i) => (
                        <ColorSwatch key={i} color={c} />
                      ))}
                    </div>
                    {selectedPalette.name}
                  </div>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
                >
                  Change image
                </button>
                {isProcessing && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </div>

              {/* Image display */}
              <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:20px_20px]">
                {showOriginal ? (
                  <img src={originalUrl} alt="Original" className="max-w-full max-h-full object-contain shadow-xl rounded-sm" style={{ imageRendering: "auto" }} />
                ) : resultUrl ? (
                  <img src={resultUrl} alt="Pixel Art" className="max-w-full max-h-full object-contain shadow-xl rounded-sm" style={{ imageRendering: "pixelated" }} />
                ) : (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">Generating pixel art...</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      <canvas ref={hiddenCanvasRef} className="hidden" />
    </div>
  );
}
