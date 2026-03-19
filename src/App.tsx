/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, Component, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  Camera, 
  X,
  LogOut,
  Palette,
  Check,
  Share2
} from 'lucide-react';
import { format, addDays, subDays, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, isToday } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { getPaletteSync } from 'colorthief';
import confetti from 'canvas-confetti';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toJpeg } from 'html-to-image';

import { auth, db, signIn, logout } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  Timestamp 
} from 'firebase/firestore';
import { NICHE_COLORS, AestheticColor, DailyGridData } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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

const rgbToHex = (r: number, g: number, b: number) => {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
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

const GUEST_ID = 'public_guest';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [viewMonth, setViewMonth] = useState(new Date());
  const [allGrids, setAllGrids] = useState<Record<string, DailyGridData>>({});
  const [isExtracting, setIsExtracting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'dailyGrids'), where('userId', '==', GUEST_ID));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Record<string, DailyGridData> = {};
      snapshot.forEach((doc) => {
        const grid = doc.data() as DailyGridData;
        data[grid.date] = grid;
      });
      setAllGrids(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const dateKey = format(currentDate, 'yyyy-MM-dd');
  const currentGrid = allGrids[dateKey];

  const handleSaveGrid = async (updates: Partial<DailyGridData>) => {
    const docId = `${GUEST_ID}_${dateKey}`;
    const newGrid: DailyGridData = {
      userId: GUEST_ID,
      date: dateKey,
      color: currentGrid?.color || NICHE_COLORS[Math.floor(Math.random() * NICHE_COLORS.length)],
      images: currentGrid?.images || Array(9).fill(''),
      ...updates
    };
    await setDoc(doc(db, 'dailyGrids', docId), newGrid);
  };

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
    if (!cardRef.current) return;
    setIsExporting(true);
    
    // Wait for state update to hide buttons
    setTimeout(async () => {
      try {
        const dataUrl = await toJpeg(cardRef.current!, {
          quality: 0.95,
          backgroundColor: '#fdfcfb',
          pixelRatio: 2,
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
    }, 100);
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
      
      // Extract colors if all images are present or just update
      handleSaveGrid({ images: newImages });
    };
    reader.readAsDataURL(file);
  };

  const extractColors = async () => {
    if (!currentGrid || currentGrid.images.filter(img => img).length === 0) return;
    setIsExtracting(true);
    
    try {
      const activeImages = currentGrid.images.filter(img => img);
      const imgElement = new Image();
      
      imgElement.onload = () => {
        try {
          console.log('Image loaded, starting extraction');
          const palette = getPaletteSync(imgElement, { colorCount: 5 });
          console.log('Palette extracted:', palette);
          
          if (palette) {
            const colors = palette.map((c: any) => ({
              hex: c.hex(),
              name: '提取色'
            }));
            handleSaveGrid({ extractedColors: colors });
          }
        } catch (e) {
          console.error('ColorThief error', e);
        } finally {
          setIsExtracting(false);
        }
      };

      imgElement.onerror = () => {
        console.error('Image load failed for color extraction');
        setIsExtracting(false);
      };

      imgElement.crossOrigin = 'Anonymous';
      imgElement.src = activeImages[0];
    } catch (err) {
      console.error('Color extraction failed', err);
      setIsExtracting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#fdfcfb]">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="w-12 h-12 rounded-full border-2 border-black/10 border-t-black/40"
        />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen w-full max-w-md mx-auto bg-[#fdfcfb] flex flex-col pb-24 relative paper-shadow border-x border-black/5" ref={cardRef}>
        {/* Header */}
        <header className="p-8 flex items-center justify-between sticky top-0 z-20 bg-[#fdfcfb]/90 backdrop-blur-md border-b border-black/5">
        <div className="flex items-center gap-6">
          {!isExporting && (
            <button 
              onClick={() => {
                setViewMonth(currentDate);
                setShowCalendar(true);
              }}
              className="p-2.5 rounded-full hover:bg-black/5 transition-all duration-300"
            >
              <CalendarIcon size={22} strokeWidth={1} />
            </button>
          )}
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-400 mb-1">
              {format(currentDate, 'EEEE', { locale: zhCN })}
            </span>
            <span className="text-2xl font-serif italic font-light tracking-tight">
              {format(currentDate, 'MMMM do', { locale: zhCN })}
            </span>
          </div>
        </div>
        {!isExporting && (
          <button 
            onClick={handleExport}
            className="p-2.5 rounded-full hover:bg-black/5 transition-all duration-300 text-neutral-400"
          >
            <Share2 size={22} strokeWidth={1} />
          </button>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 px-8 py-10 space-y-12">
        <div className="text-center space-y-3 mb-12">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center">
              <Palette size={18} className="text-white" strokeWidth={1.5} />
            </div>
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
              {!isExporting && (
                <button 
                  onClick={handleRandomColor}
                  className="p-3 rounded-full glass-dark hover:bg-black/10 transition-all duration-300"
                  title="随机颜色"
                >
                  <RefreshCw size={18} strokeWidth={1} />
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Grid Section */}
        <section className="relative">
          {/* Frosted Glass Background for Grid */}
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
            {!isExporting && (
              <button 
                onClick={extractColors}
                disabled={isExtracting || !currentGrid?.images?.some(img => img)}
                className="text-[10px] font-mono uppercase tracking-widest px-4 py-2 rounded-full glass-dark hover:bg-black/10 disabled:opacity-20 transition-all duration-500 flex items-center gap-2"
              >
                {isExtracting && <RefreshCw size={10} className="animate-spin" />}
                {isExtracting ? '提取中...' : '生成色卡'}
              </button>
            )}
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
      </main>

      {/* Navigation Footer */}
      {!isExporting && (
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
      )}

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

              <div className="grid grid-cols-7 gap-2">
                {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                  <div key={d} className="text-center text-[10px] font-mono text-neutral-400 py-2">{d}</div>
                ))}
                
                {(() => {
                  const start = startOfMonth(viewMonth);
                  const end = endOfMonth(viewMonth);
                  const days = eachDayOfInterval({ start, end });
                  
                  // Padding for start of month
                  const padding = Array(start.getDay()).fill(null);
                  
                  return [...padding, ...days].map((day, i) => {
                    if (!day) return <div key={`pad-${i}`} className="aspect-square" />;
                    
                    const dKey = format(day, 'yyyy-MM-dd');
                    const grid = allGrids[dKey];
                    const isSelected = isSameDay(day, currentDate);
                    const isTodayDate = isToday(day);
                    
                    return (
                      <button
                        key={dKey}
                        onClick={() => {
                          setCurrentDate(day);
                          setShowCalendar(false);
                        }}
                        className={cn(
                          "aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 relative transition-all group",
                          isSelected ? "bg-black text-white shadow-xl scale-105 z-10" : "hover:bg-black/5",
                          isTodayDate && !isSelected && "border border-black/10"
                        )}
                      >
                        <span className={cn(
                          "text-xs font-mono",
                          isSelected ? "text-white font-bold" : "text-neutral-500",
                          isTodayDate && !isSelected && "text-black font-bold"
                        )}>
                          {format(day, 'd')}
                        </span>
                        {grid?.color && (
                          <div 
                            className={cn(
                              "w-1.5 h-1.5 rounded-full shadow-sm transition-transform group-hover:scale-125",
                              isSelected ? "bg-white" : ""
                            )}
                            style={!isSelected ? { backgroundColor: grid.color.hex } : {}}
                          />
                        )}
                      </button>
                    );
                  });
                })()}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </ErrorBoundary>
  );
}
