import { useRef, useState, useCallback, useEffect } from "react";
import { convertToPixelArt, detectFaceRegions, DEFAULT_OPTIONS, PixelArtOptions, FaceRegion } from "@/lib/pixelArt";
import { BUILTIN_PALETTES, LospecPalette, fetchLospecPalette, parseHexList } from "@/lib/lospecPalettes";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STYLE_PRESETS = [
  { name: "8-bit Classic", blockSize: 8, paletteSize: 16, edgeStrength: 0.35, outlineEdges: true, detailBoost: 0.5, minBlockSize: 2 },
  { name: "16-bit Sharp", blockSize: 5, paletteSize: 32, edgeStrength: 0.3, outlineEdges: true, detailBoost: 0.7, minBlockSize: 2 },
  { name: "Chunky Retro", blockSize: 14, paletteSize: 12, edgeStrength: 0.45, outlineEdges: true, detailBoost: 0.4, minBlockSize: 3 },
  { name: "Hi-Res Detail", blockSize: 3, paletteSize: 64, edgeStrength: 0.25, outlineEdges: false, detailBoost: 0.9, minBlockSize: 1 },
  { name: "Mosaic", blockSize: 20, paletteSize: 8, edgeStrength: 0.5, outlineEdges: false, detailBoost: 0.2, minBlockSize: 4 },
  { name: "Portrait", blockSize: 6, paletteSize: 48, edgeStrength: 0.28, outlineEdges: true, detailBoost: 0.85, minBlockSize: 2 },
];

type PaletteTab = "builtin" | "lospec" | "custom";

function ColorSwatch({ color }: { color: [number, number, number] }) {
  const hex = `#${color.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  return <div className="w-4 h-4 rounded-sm border border-black/10 shrink-0" style={{ backgroundColor: hex }} title={hex} />;
}

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
  options, faceApiAvailable, faceDetecting, faceRegions, originalUrl,
  activeStylePreset, selectedPalette, paletteTab, lospecInput, lospecError,
  isFetchingPalette, customHexInput, allLospecPalettes,
  updateOption, applyStylePreset, setPaletteTab, setLospecInput, setLospecError,
  fetchLospec, setCustomHexInput, applyCustomHex, applyPalette, clearPalette,
}: {
  options: PixelArtOptions;
  faceApiAvailable: boolean | null;
  faceDetecting: boolean;
  faceRegions: FaceRegion[];
  originalUrl: string | null;
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

      {/* Face Detection Status */}
      <div className="rounded-lg border border-border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Face & Detail AI</p>
          {faceApiAvailable === true && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 border border-green-500/20 font-medium">API Active</span>
          )}
          {faceApiAvailable === false && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border font-medium">Fallback</span>
          )}
        </div>
        {faceDetecting && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
            Detecting faces &amp; features…
          </div>
        )}
        {!faceDetecting && faceRegions.length > 0 && (
          <div className="text-xs text-primary font-medium flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
            {faceRegions.length} face{faceRegions.length > 1 ? "s" : ""} detected
          </div>
        )}
        {!faceDetecting && faceRegions.length === 0 && originalUrl && (
          <p className="text-xs text-muted-foreground">No faces found — using multi-scale detail map</p>
        )}
        {!originalUrl && (
          <p className="text-xs text-muted-foreground">Detects eyes, nose, mouth, fur texture automatically</p>
        )}
        <div className="space-y-2 pt-1">
          <div className="flex justify-between items-center">
            <Label className="text-xs font-medium">Detail Boost</Label>
            <Badge variant="secondary" className="font-mono text-xs">{Math.round(options.detailBoost * 100)}%</Badge>
          </div>
          <Slider min={0} max={1} step={0.05} value={[options.detailBoost]} onValueChange={([v]) => updateOption("detailBoost", v)} />
          <p className="text-[10px] text-muted-foreground">How aggressively to zoom into fine features</p>
        </div>
        <div className="space-y-2 pt-1">
          <div className="flex justify-between items-center">
            <Label className="text-xs font-medium">Min Pixel Size</Label>
            <Badge variant="secondary" className="font-mono text-xs">{options.minBlockSize}px</Badge>
          </div>
          <Slider min={1} max={8} step={1} value={[options.minBlockSize]} onValueChange={([v]) => updateOption("minBlockSize", v)} />
          <p className="text-[10px] text-muted-foreground">Smallest pixel allowed in detail areas</p>
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

      {/* Edge Strength */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label className="text-sm font-medium">Edge Sensitivity</Label>
          <Badge variant="secondary" className="font-mono text-xs">{Math.round(options.edgeStrength * 100)}%</Badge>
        </div>
        <Slider min={0.05} max={0.9} step={0.05} value={[options.edgeStrength]} onValueChange={([v]) => updateOption("edgeStrength", v)} />
        <p className="text-xs text-muted-foreground">Sobel + Laplacian multi-scale edge detection</p>
      </div>

      {/* Toggles */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="outline" className="text-sm font-medium cursor-pointer">Edge Outlines</Label>
            <p className="text-xs text-muted-foreground">Darken detected edge pixels</p>
          </div>
          <Switch id="outline" checked={options.outlineEdges} onCheckedChange={(v) => updateOption("outlineEdges", v)} />
        </div>
        {options.outlineEdges && (
          <div className="flex items-center justify-between pl-1">
            <Label htmlFor="outlineColor" className="text-sm text-muted-foreground">Outline Color</Label>
            <input id="outlineColor" type="color" value={options.outlineColor}
              onChange={(e) => updateOption("outlineColor", e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent" />
          </div>
        )}
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="contrast" className="text-sm font-medium cursor-pointer">Enhance Contrast</Label>
            <p className="text-xs text-muted-foreground">Boost light/dark separation</p>
          </div>
          <Switch id="contrast" checked={options.enhanceContrast} onCheckedChange={(v) => updateOption("enhanceContrast", v)} />
        </div>
      </div>

      {/* Palette Picker */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Color Palette</p>
          {selectedPalette && (
            <button onClick={clearPalette} className="text-[10px] text-muted-foreground hover:text-destructive transition-colors">Clear</button>
          )}
        </div>
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
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
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
              rows={5} className="w-full text-xs px-2.5 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary font-mono resize-none" />
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
  const [showOriginal, setShowOriginal] = useState(false);
  const [activeStylePreset, setActiveStylePreset] = useState<string | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);

  const [faceRegions, setFaceRegions] = useState<FaceRegion[]>([]);
  const [faceDetecting, setFaceDetecting] = useState(false);
  const [faceApiAvailable, setFaceApiAvailable] = useState<boolean | null>(null);

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
  const faceRegionsRef = useRef<FaceRegion[]>([]);

  useEffect(() => {
    setFaceApiAvailable("FaceDetector" in window);
  }, []);

  const processImage = useCallback((img: HTMLImageElement, opts: PixelArtOptions, regions: FaceRegion[]) => {
    const canvas = hiddenCanvasRef.current;
    if (!canvas) return;
    setIsProcessing(true);
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    setTimeout(() => {
      const result = convertToPixelArt(canvas, opts, regions);
      setResultUrl(result.toDataURL("image/png"));
      setIsProcessing(false);
    }, 50);
  }, []);

  const scheduleProcess = useCallback((opts: PixelArtOptions, regions?: FaceRegion[]) => {
    if (!imageRef.current) return;
    if (processingTimer.current) clearTimeout(processingTimer.current);
    processingTimer.current = setTimeout(() => {
      processImage(imageRef.current!, opts, regions ?? faceRegionsRef.current);
    }, 300);
  }, [processImage]);

  const runFaceDetection = useCallback(async (canvas: HTMLCanvasElement, img: HTMLImageElement, opts: PixelArtOptions) => {
    setFaceDetecting(true);
    const regions = await detectFaceRegions(canvas);
    faceRegionsRef.current = regions;
    setFaceRegions(regions);
    setFaceDetecting(false);
    processImage(img, opts, regions);
  }, [processImage]);

  const loadFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setOriginalUrl(url);
    setResultUrl(null);
    setFaceRegions([]);
    faceRegionsRef.current = [];

    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      const canvas = hiddenCanvasRef.current!;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      runFaceDetection(canvas, img, options);
    };
    img.src = url;
  }, [options, runFaceDetection]);

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
    const next = { ...options, blockSize: preset.blockSize, paletteSize: preset.paletteSize, edgeStrength: preset.edgeStrength, outlineEdges: preset.outlineEdges, detailBoost: preset.detailBoost, minBlockSize: preset.minBlockSize };
    setOptions(next);
    setActiveStylePreset(preset.name);
    scheduleProcess(next);
  };

  const applyPalette = useCallback((palette: LospecPalette | null) => {
    setSelectedPalette(palette);
    const next = { ...options, customPalette: palette?.colors };
    setOptions(next);
    scheduleProcess(next);
  }, [options, scheduleProcess]);

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
    options, faceApiAvailable, faceDetecting, faceRegions, originalUrl,
    activeStylePreset, selectedPalette, paletteTab, lospecInput, lospecError,
    isFetchingPalette, customHexInput, allLospecPalettes,
    updateOption, applyStylePreset, setPaletteTab, setLospecInput, setLospecError,
    fetchLospec, setCustomHexInput, applyCustomHex, applyPalette, clearPalette,
  };

  return (
    <div className="min-h-screen max-w-full bg-background text-foreground flex flex-col overflow-hidden">
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
        {/* Sidebar — desktop always visible, mobile hidden */}
        <aside className="hidden md:flex flex-col w-72 border-r border-border bg-card shrink-0 overflow-y-auto">
          <SidebarContent {...sidebarProps} />
        </aside>

        {/* Main area */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Mobile controls drawer */}
          {controlsOpen && (
            <div className="md:hidden flex flex-col border-b border-border bg-card overflow-y-auto" style={{ maxHeight: "55vh" }}>
              <SidebarContent {...sidebarProps} />
            </div>
          )}

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
                    Face AI runs automatically — eyes, nose, mouth, and fine textures get extra pixel detail.
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
                  <button onClick={() => setShowOriginal(false)}
                    className={`px-3 py-1.5 transition-colors ${!showOriginal ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>
                    Pixel Art
                  </button>
                  <button onClick={() => setShowOriginal(true)}
                    className={`px-3 py-1.5 transition-colors ${showOriginal ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>
                    Original
                  </button>
                </div>
                {faceRegions.length > 0 && (
                  <span className="text-xs flex items-center gap-1 text-green-600 font-medium">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                    {faceRegions.length} face{faceRegions.length > 1 ? "s" : ""}
                  </span>
                )}
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
                {(isProcessing || faceDetecting) && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                    <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    {faceDetecting ? "Detecting…" : "Processing…"}
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </div>

              {/* Image display */}
              <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:20px_20px]">
                {showOriginal ? (
                  <img src={originalUrl} alt="Original" className="max-w-full max-h-full object-contain shadow-xl rounded-sm" style={{ imageRendering: "auto" }} />
                ) : resultUrl ? (
                  <img src={resultUrl} alt="Pixel Art" className="max-w-full max-h-full object-contain shadow-xl rounded-sm" style={{ imageRendering: "pixelated" }} />
                ) : (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">{faceDetecting ? "Detecting faces…" : "Generating pixel art…"}</span>
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
