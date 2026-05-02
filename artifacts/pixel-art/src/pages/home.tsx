import { useRef, useState, useCallback, useEffect } from "react";
import { convertToPixelArt, DEFAULT_OPTIONS, PixelArtOptions } from "@/lib/pixelArt";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const PRESETS = [
  { name: "8-bit Classic", blockSize: 8, paletteSize: 16, edgeStrength: 0.35, outlineEdges: true },
  { name: "16-bit Sharp", blockSize: 5, paletteSize: 32, edgeStrength: 0.3, outlineEdges: true },
  { name: "Chunky Retro", blockSize: 14, paletteSize: 12, edgeStrength: 0.45, outlineEdges: true },
  { name: "Hi-Res Detail", blockSize: 3, paletteSize: 64, edgeStrength: 0.25, outlineEdges: false },
  { name: "Mosaic", blockSize: 20, paletteSize: 8, edgeStrength: 0.5, outlineEdges: false },
];

export default function Home() {
  const [options, setOptions] = useState<PixelArtOptions>({ ...DEFAULT_OPTIONS });
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const processingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const processImage = useCallback(
    (img: HTMLImageElement, opts: PixelArtOptions) => {
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
    },
    []
  );

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
    setActivePreset(null);
    scheduleProcess(next);
  };

  const applyPreset = (preset: (typeof PRESETS)[0]) => {
    const next = {
      ...options,
      blockSize: preset.blockSize,
      paletteSize: preset.paletteSize,
      edgeStrength: preset.edgeStrength,
      outlineEdges: preset.outlineEdges,
    };
    setOptions(next);
    setActivePreset(preset.name);
    scheduleProcess(next);
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

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between shrink-0">
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
          <div className="p-4 space-y-6">
            {/* Presets */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Presets</p>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => applyPreset(p)}
                    className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                      activePreset === p.name
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
                min={2}
                max={32}
                step={1}
                value={[options.blockSize]}
                onValueChange={([v]) => updateOption("blockSize", v)}
              />
              <p className="text-xs text-muted-foreground">Larger = chunkier pixels</p>
            </div>

            {/* Palette */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-medium">Color Palette</Label>
                <Badge variant="secondary" className="font-mono text-xs">{options.paletteSize} colors</Badge>
              </div>
              <Slider
                min={4}
                max={128}
                step={2}
                value={[options.paletteSize]}
                onValueChange={([v]) => updateOption("paletteSize", v)}
              />
              <p className="text-xs text-muted-foreground">Fewer = more stylized look</p>
            </div>

            {/* Edge Strength */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-medium">Edge Sensitivity</Label>
                <Badge variant="secondary" className="font-mono text-xs">{Math.round(options.edgeStrength * 100)}%</Badge>
              </div>
              <Slider
                min={0.05}
                max={0.9}
                step={0.05}
                value={[options.edgeStrength]}
                onValueChange={([v]) => updateOption("edgeStrength", v)}
              />
              <p className="text-xs text-muted-foreground">AI detects edges via Sobel filter</p>
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
                    Our AI uses Sobel edge detection to find contours and produce crisp, intentional pixel art — not just a blurry downsample.
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
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Change image
                </button>
                {isProcessing && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground ml-auto">
                    <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </div>

              {/* Image display */}
              <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:20px_20px]">
                {showOriginal ? (
                  <img
                    src={originalUrl}
                    alt="Original"
                    className="max-w-full max-h-full object-contain shadow-xl rounded-sm"
                    style={{ imageRendering: "auto" }}
                  />
                ) : resultUrl ? (
                  <img
                    src={resultUrl}
                    alt="Pixel Art"
                    className="max-w-full max-h-full object-contain shadow-xl rounded-sm"
                    style={{ imageRendering: "pixelated" }}
                  />
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
