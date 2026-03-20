/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, Component, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  X,
  Share2
} from 'lucide-react';
import { format, addDays, subDays, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, isToday } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import confetti from 'canvas-confetti';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toJpeg } from 'html-to-image';
import { NICHE_COLORS, AestheticColor, DailyGridData } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Local Storage Helpers ---

const STORAGE_KEY = 'colorgrid_data';

function loadAllGrids(): Record<string, DailyGridData> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load data from localStorage', e);
  }
  return {};
}

function saveAllGrids(grids: Record<string, DailyGridData>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(grids));
  } catch (e) {
    console.error('Failed to save data to localStorage', e);
  }
}

// --- Helpers ---

const resizeImage = (base64: string, maxWidth = 400): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const ratio = img.width / img.height;
      const width = Math.min(img.width, maxWidth);
      const height = width / ratio;
      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
  });
};

// --- Components ---

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: any }> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center space-y-4">
          <h2 className="text-xl font-serif">出错了</h2>
          <p className="text-sm text-neutral-500">{this.state.error?.message || '未知错误'}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 glass rounded-xl">重试</button>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

export default function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [viewMonth, setViewMonth] = useState(new Date());
  const [allGrids, setAllGrids] = useState<Record<string, DailyGridData>>(() => loadAllGrids());
  const [isExporting, setIsExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Persist to localStorage whenever allGrids changes
  useEffect(() => {
    saveAllGrids(allGrids);
  }, [allGrids]);

  const dateKey = format(currentDate, 'yyyy-MM-dd');
  const currentGrid = allGrids[dateKey];

  const handleSaveGrid = useCallback((updates: Partial<DailyGridData>) => {
    setAllGrids(prev => {
      const existing = prev[dateKey];
      const newGrid: DailyGridData = {
        userId: 'local',
        date: dateKey,
        color: existing?.color || NICHE_COLORS[Math.floor(Math.random() * NICHE_COLORS.length)],
        images: existing?.images || Array(9).fill(''),
        ...updates
      };
      return { ...prev, [dateKey]: newGrid };
    });
  }, [dateKey]);

  const handleRandomColor = () => {
    const randomColor = NICHE_COLORS[Math.floor(Math.random() * NICHE_COLORS.length)];
    handleSaveGrid({ color: randomColor });
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: [randomColor.hex]
    });
  };

  const handleExport = async () => {
    if (!exportRef.current) return;
    setIsExporting(true);
    
    await new Promise(r => setTimeout(r, 200));
    
    try {
      const dataUrl = await toJpeg(exportRef.current!, {
        quality: 0.95,
        backgroundColor: '#fdfcfb',
        pixelRatio: 2,
        width: 400,
        style: {
          transform: 'none',
          position: 'static',
        }
      });
      
      const link = document.createElement('a');
      link.download = `ColorGrid-${format(currentDate, 'yyyyMMdd')}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const resized = await resizeImage(base64);
      const newImages = [...(currentGrid?.images || Array(9).fill(''))];
      newImages[index] = resized;
      handleSaveGrid({ images: newImages });
    };
    reader.readAsDataURL(file);
  };

  const extractColors = async () => {
    if (!currentGrid || currentGrid.images.filter(img => img).length === 0) return;
    
    const activeImages = currentGrid.images.filter(img => img);
    
    // Collect pixels from ALL images
    const allPixels: [number, number, number][] = [];
    
    const loadImage = (src: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    };
    
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      for (const src of activeImages) {
        const img = await loadImage(src);
        const size = 150;
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);
        
        const imageData = ctx.getImageData(0, 0, size, size).data;
        for (let i = 0; i < imageData.length; i += 4) {
          const r = imageData[i];
          const g = imageData[i + 1];
          const b = imageData[i + 2];
          const a = imageData[i + 3];
          // Skip near-white, near-black, and transparent pixels
          if (a < 128) continue;
          const brightness = r + g + b;
          if (brightness < 30 || brightness > 735) continue;
          // Skip very low saturation (grayish) pixels
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          if (max - min < 15 && brightness > 100 && brightness < 650) continue;
          allPixels.push([r, g, b]);
        }
      }
      
      if (allPixels.length === 0) return;
      
      // Median Cut algorithm for color quantization
      type ColorBox = { pixels: [number, number, number][] };
      
      const getRange = (pixels: [number, number, number][], channel: number) => {
        let min = 255, max = 0;
        for (const p of pixels) {
          if (p[channel] < min) min = p[channel];
          if (p[channel] > max) max = p[channel];
        }
        return max - min;
      };
      
      const splitBox = (box: ColorBox): [ColorBox, ColorBox] => {
        const { pixels } = box;
        const rangeR = getRange(pixels, 0);
        const rangeG = getRange(pixels, 1);
        const rangeB = getRange(pixels, 2);
        
        // Split along the channel with the widest range
        let sortChannel = 0;
        if (rangeG >= rangeR && rangeG >= rangeB) sortChannel = 1;
        else if (rangeB >= rangeR && rangeB >= rangeG) sortChannel = 2;
        
        pixels.sort((a, b) => a[sortChannel] - b[sortChannel]);
        const mid = Math.floor(pixels.length / 2);
        return [
          { pixels: pixels.slice(0, mid) },
          { pixels: pixels.slice(mid) }
        ];
      };
      
      const getAvgColor = (pixels: [number, number, number][]): [number, number, number] => {
        let rSum = 0, gSum = 0, bSum = 0;
        for (const [r, g, b] of pixels) {
          rSum += r; gSum += g; bSum += b;
        }
        const n = pixels.length;
        return [Math.round(rSum / n), Math.round(gSum / n), Math.round(bSum / n)];
      };
      
      // Subsample if too many pixels for performance
      let sampledPixels = allPixels;
      if (allPixels.length > 50000) {
        const step = Math.ceil(allPixels.length / 50000);
        sampledPixels = allPixels.filter((_, i) => i % step === 0);
      }
      
      // Start with one box, split until we have 5
      let boxes: ColorBox[] = [{ pixels: sampledPixels }];
      while (boxes.length < 5) {
        // Find the box with the largest volume to split
        let maxVolIdx = 0;
        let maxVol = 0;
        for (let i = 0; i < boxes.length; i++) {
          const vol = getRange(boxes[i].pixels, 0) + getRange(boxes[i].pixels, 1) + getRange(boxes[i].pixels, 2);
          if (vol > maxVol && boxes[i].pixels.length > 1) {
            maxVol = vol;
            maxVolIdx = i;
          }
        }
        if (maxVol === 0) break;
        const [a, b] = splitBox(boxes[maxVolIdx]);
        boxes.splice(maxVolIdx, 1, a, b);
      }
      
      // Sort boxes by pixel count (most dominant first)
      boxes.sort((a, b) => b.pixels.length - a.pixels.length);
      
      // Color naming helper
      const getColorName = (r: number, g: number, b: number): string => {
        const h = (() => {
          const rr = r / 255, gg = g / 255, bb = b / 255;
          const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
          if (max === min) return 0;
          let hue = 0;
          const d = max - min;
          if (max === rr) hue = ((gg - bb) / d + (gg < bb ? 6 : 0)) * 60;
          else if (max === gg) hue = ((bb - rr) / d + 2) * 60;
          else hue = ((rr - gg) / d + 4) * 60;
          return hue;
        })();
        const brightness = (r + g + b) / 3;
        const sat = Math.max(r, g, b) - Math.min(r, g, b);
        
        if (sat < 20) {
          if (brightness < 60) return '炭黑';
          if (brightness < 120) return '灰色';
          if (brightness < 180) return '银灰';
          return '象牙';
        }
        if (brightness < 50) return '深色';
        
        if (h < 15 || h >= 345) return brightness > 180 ? '粉红' : '红色';
        if (h < 40) return brightness > 180 ? '杏色' : '橙色';
        if (h < 65) return brightness > 180 ? '鹅黄' : '金色';
        if (h < 80) return '黄绿';
        if (h < 160) return brightness > 180 ? '薄荷' : '绿色';
        if (h < 200) return brightness > 180 ? '天蓝' : '青色';
        if (h < 260) return brightness > 180 ? '浅蓝' : '蓝色';
        if (h < 290) return brightness > 180 ? '薰衣草' : '紫色';
        if (h < 345) return brightness > 180 ? '玫粉' : '品红';
        return '彩色';
      };
      
      const colors: AestheticColor[] = boxes.slice(0, 5).map(box => {
        const [r, g, b] = getAvgColor(box.pixels);
        const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
        return { hex, name: getColorName(r, g, b) };
      });
      
      handleSaveGrid({ extractedColors: colors });
    } catch (e) {
      console.error('Color extraction error', e);
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen w-full max-w-md mx-auto bg-[#fdfcfb] flex flex-col pb-24 relative paper-shadow border-x border-black/5">
        {/* Header */}
        <header className="p-8 flex items-center justify-between sticky top-0 z-20 bg-[#fdfcfb]/90 backdrop-blur-md border-b border-black/5">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => {
              setViewMonth(currentDate);
              setShowCalendar(true);
            }}
            className="p-2.5 rounded-full hover:bg-black/5 transition-all duration-300"
          >
            <CalendarIcon size={22} strokeWidth={1} />
          </button>
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-400 mb-1">
              {format(currentDate, 'EEEE', { locale: zhCN })}
            </span>
            <span className="text-2xl font-serif italic font-light tracking-tight">
              {format(currentDate, 'MMMM do', { locale: zhCN })}
            </span>
          </div>
        </div>
        <button 
          onClick={handleExport}
          disabled={isExporting}
          className="p-2.5 rounded-full hover:bg-black/5 transition-all duration-300 text-neutral-400 disabled:opacity-50"
        >
          {isExporting ? <RefreshCw size={22} strokeWidth={1} className="animate-spin" /> : <Share2 size={22} strokeWidth={1} />}
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-8 py-10 space-y-12">
        <div className="text-center space-y-3 mb-12">
          <div className="flex items-center justify-center gap-2 mb-1">
            <h1 className="text-4xl font-serif italic tracking-tighter font-medium">ColorGrid</h1>
          </div>
          <p className="text-[11px] font-serif italic text-neutral-400 tracking-widest">每一天的色彩都值得被记录。</p>
          <div className="h-px w-12 bg-black/10 mx-auto mt-4" />
        </div>

        {/* Color Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div 
                className="w-12 h-12 rounded-full shadow-inner transition-all duration-700 border border-black/5"
                style={{ backgroundColor: currentGrid?.color?.hex || '#f3f4f6' }}
              />
              <div className="flex flex-col">
                <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">今日主色</span>
                <h2 className="text-2xl font-serif italic tracking-tight">
                  {currentGrid?.color?.name || '未选择颜色'}
                </h2>
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={handleRandomColor}
                className="p-3 rounded-full glass-dark hover:bg-black/10 transition-all duration-300"
                title="随机颜色"
              >
                <RefreshCw size={18} strokeWidth={1} />
              </button>
            </div>
          </div>
        </section>

        {/* Grid Section */}
        <section className="relative">
          <div className="absolute -inset-3 rounded-2xl overflow-hidden pointer-events-none transition-all duration-1000">
            <div 
              className="absolute inset-0 transition-all duration-1000 opacity-25 blur-2xl"
              style={{ 
                background: currentGrid?.color?.hex 
                  ? `radial-gradient(circle at center, ${currentGrid.color.hex} 0%, transparent 85%)` 
                  : 'transparent' 
              }}
            />
            <div className="absolute inset-0 backdrop-blur-md bg-white/5 border border-white/10" />
          </div>
          
          <div className="relative grid grid-cols-3 gap-2 aspect-square">
            {Array(9).fill(0).map((_, i) => (
              <div key={i} className="relative group aspect-square">
                <label className="block w-full h-full cursor-pointer">
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={(e) => handleUpload(i, e)}
                  />
                  <motion.div 
                    whileHover={{ scale: 1.05, rotate: 1 }}
                    whileTap={{ scale: 0.95, rotate: -1 }}
                    onClick={() => {
                      if (currentGrid?.images?.[i]) {
                        confetti({
                          particleCount: 30,
                          spread: 50,
                          origin: { x: 0.5, y: 0.5 },
                          colors: [currentGrid.color.hex]
                        });
                      }
                    }}
                    className={cn(
                      "w-full h-full rounded-xl overflow-hidden glass flex items-center justify-center transition-all duration-500 shadow-sm hover:shadow-md",
                      !currentGrid?.images?.[i] && "border-dashed border-2 border-black/5"
                    )}
                  >
                    {currentGrid?.images?.[i] ? (
                      <img 
                        src={currentGrid.images[i]} 
                        className="w-full h-full object-cover" 
                        alt={`Grid ${i}`}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Plus size={20} className="text-neutral-300" strokeWidth={1} />
                    )}
                  </motion.div>
                </label>
                {currentGrid?.images?.[i] && (
                  <button 
                    onClick={() => {
                      const newImages = [...currentGrid.images];
                      newImages[i] = '';
                      handleSaveGrid({ images: newImages });
                    }}
                    className="absolute top-1 right-1 p-1 bg-black/20 backdrop-blur-md rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Color Extraction Section */}
        <section className="space-y-8 pb-12">
          <div className="flex items-center justify-between border-b border-black/5 pb-4">
            <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-400">灵感色卡</h3>
            <button 
              onClick={extractColors}
              disabled={!currentGrid?.images?.some(img => img)}
              className="text-[10px] font-mono uppercase tracking-widest px-4 py-2 rounded-full glass-dark hover:bg-black/10 disabled:opacity-20 transition-all duration-500 flex items-center gap-2"
            >
              生成色卡
            </button>
          </div>

          <div className="grid grid-cols-5 gap-4">
            {(currentGrid?.extractedColors || Array(5).fill(null)).map((c, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex flex-col items-center gap-3"
              >
                <div 
                  className="w-full aspect-square rounded-full shadow-sm border border-black/5 transition-all duration-700"
                  style={{ backgroundColor: c?.hex || '#f3f4f6' }}
                />
                <div className="text-center space-y-1">
                  <p className="text-[9px] font-mono text-neutral-400 tracking-tighter">{c?.hex || '----'}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Palette Section - 调色盘 */}
        {(() => {
          // 统计所有打卡日的颜色占比
          const colorStats: Record<string, { color: AestheticColor; count: number }> = {};
          (Object.values(allGrids) as DailyGridData[]).forEach(grid => {
            if (grid?.color?.hex) {
              const key = grid.color.hex;
              if (colorStats[key]) {
                colorStats[key].count++;
              } else {
                colorStats[key] = { color: grid.color, count: 1 };
              }
            }
          });
          const sortedColors = Object.values(colorStats).sort((a, b) => b.count - a.count);
          const totalDays = sortedColors.reduce((sum, c) => sum + c.count, 0);

          if (sortedColors.length === 0) return null;

          // 生成环形图的 conic-gradient
          let gradientParts: string[] = [];
          let accPercent = 0;
          sortedColors.forEach((item) => {
            const percent = (item.count / totalDays) * 100;
            gradientParts.push(`${item.color.hex} ${accPercent}% ${accPercent + percent}%`);
            accPercent += percent;
          });
          const conicGradient = `conic-gradient(${gradientParts.join(', ')})`;

          return (
            <section className="space-y-6 pb-8">
              <div className="flex items-center border-b border-black/5 pb-4">
                <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-400">调色盘 · 色彩足迹</h3>
              </div>
              
              <div className="flex items-start gap-6">
                {/* 环形色盘 */}
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8, rotate: -90 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="relative flex-shrink-0"
                >
                  <div 
                    className="w-28 h-28 rounded-full shadow-lg border border-white/30"
                    style={{ background: conicGradient }}
                  />
                  <div className="absolute inset-3 rounded-full bg-[#fdfcfb] shadow-inner flex flex-col items-center justify-center">
                    <span className="text-xl font-serif italic font-medium leading-none">{totalDays}</span>
                    <span className="text-[8px] font-mono text-neutral-400 mt-0.5">天打卡</span>
                  </div>
                </motion.div>

                {/* 颜色排行列表 */}
                <div className="flex-1 space-y-2 min-w-0">
                  {sortedColors.slice(0, 6).map((item, i) => {
                    const percent = ((item.count / totalDays) * 100).toFixed(1);
                    return (
                      <motion.div
                        key={item.color.hex}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08, duration: 0.5 }}
                        className="flex items-center gap-2.5 group"
                      >
                        <div 
                          className="w-5 h-5 rounded-md shadow-sm border border-black/5 flex-shrink-0 transition-transform group-hover:scale-110"
                          style={{ backgroundColor: item.color.hex }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] font-serif text-neutral-600 truncate">{item.color.name}</span>
                            <span className="text-[9px] font-mono text-neutral-400 ml-2 flex-shrink-0">{percent}%</span>
                          </div>
                          <div className="h-1 rounded-full bg-black/5 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${percent}%` }}
                              transition={{ delay: i * 0.08 + 0.3, duration: 0.6, ease: 'easeOut' }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: item.color.hex }}
                            />
                          </div>
                        </div>
                        <span className="text-[9px] font-mono text-neutral-300 flex-shrink-0">{item.count}天</span>
                      </motion.div>
                    );
                  })}
                  {sortedColors.length > 6 && (
                    <p className="text-[9px] font-mono text-neutral-300 text-center pt-1">
                      还有 {sortedColors.length - 6} 种颜色...
                    </p>
                  )}
                </div>
              </div>
            </section>
          );
        })()}

        {/* Developer Credit */}
        <div className="text-center text-[11px] text-neutral-300 pt-4 pb-2">
          开发者：风系魔法师鸽鸽（小红书同名）
        </div>
      </main>

      {/* Navigation Footer */}
      <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-6 z-30">
        <div className="glass rounded-3xl p-2 flex items-center justify-between shadow-lg">
          <button 
            onClick={() => setCurrentDate(subDays(currentDate, 1))}
            className="p-3 rounded-2xl hover:bg-black/5 transition-colors"
          >
            <ChevronLeft size={20} strokeWidth={1.5} />
          </button>
          
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-mono uppercase tracking-tighter text-neutral-400">
              {isToday(currentDate) ? '今天' : format(currentDate, 'yyyy.MM.dd')}
            </span>
          </div>

          <button 
            onClick={() => setCurrentDate(addDays(currentDate, 1))}
            className="p-3 rounded-2xl hover:bg-black/5 transition-colors"
          >
            <ChevronRight size={20} strokeWidth={1.5} />
          </button>
        </div>
      </footer>

      {/* Calendar Modal */}
      <AnimatePresence>
        {showCalendar && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#fdfcfb]/95 backdrop-blur-xl p-6 overflow-y-auto"
          >
            <div className="max-w-md mx-auto space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <h2 className="text-3xl font-serif italic">日历回顾</h2>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 mt-1">
                    {format(viewMonth, 'yyyy MMMM', { locale: zhCN })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center glass rounded-full p-1 mr-2">
                    <button 
                      onClick={() => setViewMonth(subDays(startOfMonth(viewMonth), 1))}
                      className="p-2 rounded-full hover:bg-black/5 transition-colors"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button 
                      onClick={() => setViewMonth(addDays(endOfMonth(viewMonth), 1))}
                      className="p-2 rounded-full hover:bg-black/5 transition-colors"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                  <button 
                    onClick={() => setShowCalendar(false)}
                    className="p-2 rounded-full glass-dark"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                  <div key={d} className="text-center text-[10px] font-mono text-neutral-400 py-2 font-medium">{d}</div>
                ))}
                
                {(() => {
                  const start = startOfMonth(viewMonth);
                  const end = endOfMonth(viewMonth);
                  const days = eachDayOfInterval({ start, end });
                  const padding = Array(start.getDay()).fill(null);
                  
                  return [...padding, ...days].map((day, i) => {
                    if (!day) return <div key={`pad-${i}`} className="aspect-square" />;
                    
                    const dKey = format(day, 'yyyy-MM-dd');
                    const grid = allGrids[dKey];
                    const isSelected = isSameDay(day, currentDate);
                    const isTodayDate = isToday(day);
                    const hasColor = !!grid?.color;
                    const hasImages = grid?.images?.some(img => img);
                    
                    return (
                      <motion.button
                        key={dKey}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setCurrentDate(day);
                          setShowCalendar(false);
                        }}
                        className={cn(
                          "aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all duration-300 overflow-hidden",
                          isSelected 
                            ? "shadow-lg scale-105 z-10 ring-2 ring-black/20" 
                            : hasColor 
                              ? "shadow-sm hover:shadow-md" 
                              : "hover:bg-black/5",
                          isTodayDate && !isSelected && "ring-1 ring-black/15"
                        )}
                        style={
                          isSelected 
                            ? { backgroundColor: grid?.color?.hex || '#2c2c2c' }
                            : hasColor 
                              ? { backgroundColor: grid.color.hex + '25' } 
                              : {}
                        }
                      >
                        {/* 有颜色时显示底部色条 */}
                        {hasColor && !isSelected && (
                          <div 
                            className="absolute bottom-0 left-0 right-0 h-1 rounded-b-xl"
                            style={{ backgroundColor: grid.color.hex }}
                          />
                        )}
                        
                        <span className={cn(
                          "text-xs font-mono relative z-10 leading-none",
                          isSelected ? "text-white font-bold text-sm" : "text-neutral-600",
                          isTodayDate && !isSelected && "text-black font-bold",
                          hasColor && !isSelected && "font-medium"
                        )}>
                          {format(day, 'd')}
                        </span>
                        
                        {/* 打卡图片指示点 */}
                        {hasImages && !isSelected && (
                          <div className="absolute top-1 right-1">
                            <div 
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: grid?.color?.hex || '#a3a3a3' }}
                            />
                          </div>
                        )}
                        
                        {/* 选中日期的色名 */}
                        {isSelected && grid?.color && (
                          <span className="text-[7px] text-white/70 font-mono mt-0.5 leading-none truncate max-w-full px-1">
                            {grid.color.name}
                          </span>
                        )}
                      </motion.button>
                    );
                  });
                })()}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

    {/* Offscreen Export Card */}
    {isExporting && (
      <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
        <div 
          ref={exportRef}
          style={{ 
            width: '400px', 
            backgroundColor: '#fdfcfb',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          <div style={{ padding: '32px 32px 24px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#a3a3a3' }}>
                {format(currentDate, 'EEEE', { locale: zhCN })}
              </span>
              <span style={{ fontSize: '24px', fontStyle: 'italic', fontWeight: 300, letterSpacing: '-0.025em', fontFamily: 'Georgia, serif' }}>
                {format(currentDate, 'MMMM do', { locale: zhCN })}
              </span>
            </div>
          </div>
          <div style={{ padding: '24px 32px 32px' }}>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h1 style={{ fontSize: '32px', fontStyle: 'italic', fontWeight: 500, letterSpacing: '-0.05em', fontFamily: 'Georgia, serif', margin: '0 0 8px' }}>ColorGrid</h1>
              <p style={{ fontSize: '11px', fontStyle: 'italic', color: '#a3a3a3', letterSpacing: '0.1em', fontFamily: 'Georgia, serif', margin: 0 }}>每一天的色彩都值得被记录。</p>
              <div style={{ height: '1px', width: '48px', backgroundColor: 'rgba(0,0,0,0.1)', margin: '16px auto 0' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: currentGrid?.color?.hex || '#f3f4f6', border: '1px solid rgba(0,0,0,0.05)', flexShrink: 0 }} />
              <div>
                <span style={{ fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a3a3a3', display: 'block' }}>今日主色</span>
                <span style={{ fontSize: '22px', fontStyle: 'italic', fontFamily: 'Georgia, serif', letterSpacing: '-0.025em' }}>
                  {currentGrid?.color?.name || '未选择颜色'}
                </span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '32px' }}>
              {Array(9).fill(0).map((_, i) => (
                <div key={i} style={{ aspectRatio: '1', borderRadius: '12px', overflow: 'hidden', backgroundColor: currentGrid?.images?.[i] ? 'transparent' : '#f5f5f4', border: currentGrid?.images?.[i] ? 'none' : '2px dashed rgba(0,0,0,0.05)' }}>
                  {currentGrid?.images?.[i] && (
                    <img src={currentGrid.images[i]} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt={`Grid ${i}`} />
                  )}
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '24px' }}>
              <h3 style={{ fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#a3a3a3', margin: '0 0 16px' }}>灵感色卡</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
                {(currentGrid?.extractedColors || Array(5).fill(null)).map((c, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '100%', aspectRatio: '1', borderRadius: '50%', backgroundColor: c?.hex || '#f3f4f6', border: '1px solid rgba(0,0,0,0.05)' }} />
                    <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#a3a3a3' }}>{c?.hex || '----'}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ textAlign: 'center', paddingTop: '20px', fontSize: '14px', color: '#c0c0c0' }}>
              开发者：风系魔法师鸽鸽（小红书同名）
            </div>
          </div>
        </div>
      </div>
    )}

    </ErrorBoundary>
  );
}
