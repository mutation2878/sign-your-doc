
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from './components/Button';
import { Overlay, DocumentAnalysis } from './types';
import { analyzeDocument } from './services/geminiService';

// Icons
const IconUpload = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>;
const IconDownload = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>;
const IconTrash = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>;
const IconSparkles = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>;

const App: React.FC = () => {
  const [baseImage, setBaseImage] = useState<HTMLImageElement | null>(null);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragStartRef = useRef<{ x: number, y: number } | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !baseImage) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(baseImage, 0, 0);

    // AI Suggestions
    if (analysis && analysis.suggestedPlacements.length > 0) {
      analysis.suggestedPlacements.forEach(pos => {
        ctx.beginPath();
        ctx.arc((pos.x / 1000) * canvas.width, (pos.y / 1000) * canvas.height, 12, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
        ctx.fill();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }

    overlays.forEach(ov => {
      const w = ov.image.width * ov.scale;
      const h = ov.image.height * ov.scale;
      if (ov.id === selectedId) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 4;
        ctx.strokeRect(ov.x - 2, ov.y - 2, w + 4, h + 4);
      }
      ctx.drawImage(ov.image, ov.x, ov.y, w, h);
    });
  }, [baseImage, overlays, selectedId, analysis]);

  useEffect(() => { draw(); }, [draw]);

  const handleBaseImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setBaseImage(img);
        if (canvasRef.current) {
          canvasRef.current.width = img.width;
          canvasRef.current.height = img.height;
        }
        setOverlays([]);
        setAnalysis(null);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleOverlayUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!baseImage) {
      alert("請先上傳簽名文件！");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const newOverlay: Overlay = {
          id: Math.random().toString(36).substr(2, 9),
          image: img,
          x: 50,
          y: 50,
          scale: 1,
          name: file.name
        };
        setOverlays(prev => [...prev, newOverlay]);
        setSelectedId(newOverlay.id);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAiAnalysis = async () => {
    if (!baseImage) return;
    setIsAnalyzing(true);
    const tempCanvas = document.createElement('canvas');
    const MAX_DIM = 1024;
    let w = baseImage.width;
    let h = baseImage.height;
    if (w > h && w > MAX_DIM) { h *= MAX_DIM / w; w = MAX_DIM; }
    else if (h > MAX_DIM) { w *= MAX_DIM / h; h = MAX_DIM; }
    tempCanvas.width = w;
    tempCanvas.height = h;
    const ctx = tempCanvas.getContext('2d');
    ctx?.drawImage(baseImage, 0, 0, w, h);
    const result = await analyzeDocument(tempCanvas.toDataURL('image/png'));
    setAnalysis(result);
    setIsAnalyzing(false);
  };

  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const onStart = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getCanvasPos(e);
    let foundId: string | null = null;
    for (let i = overlays.length - 1; i >= 0; i--) {
      const ov = overlays[i];
      const w = ov.image.width * ov.scale;
      const h = ov.image.height * ov.scale;
      if (pos.x >= ov.x && pos.x <= ov.x + w && pos.y >= ov.y && pos.y <= ov.y + h) {
        foundId = ov.id;
        break;
      }
    }
    setSelectedId(foundId);
    if (foundId) {
      setIsDragging(true);
      dragStartRef.current = pos;
    }
  };

  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !selectedId || !dragStartRef.current) return;
    const pos = getCanvasPos(e);
    const dx = pos.x - dragStartRef.current.x;
    const dy = pos.y - dragStartRef.current.y;
    setOverlays(prev => prev.map(ov => ov.id === selectedId ? { ...ov, x: ov.x + dx, y: ov.y + dy } : ov));
    dragStartRef.current = pos;
  };

  const onEnd = () => { setIsDragging(false); dragStartRef.current = null; };

  const deleteOverlay = (id: string) => {
    setOverlays(prev => prev.filter(ov => ov.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const downloadResult = () => {
    if (!baseImage || !canvasRef.current) return;
    const link = document.createElement('a');
    link.download = 'merged_document.png';
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  const selectedOverlay = overlays.find(o => o.id === selectedId);

  return (
    <div className="min-h-screen bg-[#f0f4f8] p-4 flex flex-col items-center">
      <div className="w-full max-w-6xl bg-white rounded-2xl shadow-xl p-8 flex flex-col">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#1e293b] mb-2">多重簽名圖像合併工具</h1>
          <p className="text-[#64748b]">上傳簽名文件和多個簽名圖檔，然後調整位置和大小並下載。</p>
        </div>

        {/* Upload Buttons */}
        <div className="flex flex-col sm:flex-row justify-center items-center gap-6 mb-8">
          <Button 
            className="w-full sm:w-auto min-w-[200px]" 
            variant="primary" 
            onClick={() => (document.getElementById('base-input') as HTMLInputElement)?.click()}
            icon={<span className="text-yellow-400 mr-1">📁</span>}
          >
            上傳簽名文件
          </Button>
          <input id="base-input" type="file" className="hidden" accept="image/*" onChange={handleBaseImageUpload} />

          <Button 
            className="w-full sm:w-auto min-w-[200px]" 
            variant="primary" 
            onClick={() => (document.getElementById('sig-input') as HTMLInputElement)?.click()}
            icon={<span className="text-yellow-400 mr-1">📁</span>}
          >
            上傳簽名圖檔
          </Button>
          <input id="sig-input" type="file" className="hidden" accept="image/png" onChange={handleOverlayUpload} />
          
          <Button 
            variant="ghost" 
            className="text-blue-600 border border-blue-200" 
            onClick={handleAiAnalysis} 
            disabled={!baseImage || isAnalyzing}
            icon={<IconSparkles />}
          >
            {isAnalyzing ? '正在分析...' : 'AI 智慧建議'}
          </Button>
        </div>

        {/* Workspace */}
        <div className="flex flex-col lg:flex-row gap-8 flex-1">
          {/* Main Area */}
          <div className="flex-1 flex flex-col items-center">
            <div className="w-full bg-[#e2e8f0] rounded-xl overflow-hidden shadow-inner flex items-center justify-center min-h-[300px] border-2 border-dashed border-[#9ca3af]">
              {baseImage ? (
                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    onMouseDown={onStart}
                    onMouseMove={onMove}
                    onMouseUp={onEnd}
                    onMouseLeave={onEnd}
                    onTouchStart={onStart}
                    onTouchMove={onMove}
                    onTouchEnd={onEnd}
                    className={`max-w-full block touch-none ${isDragging ? 'cursor-grabbing' : selectedId ? 'cursor-grab' : 'cursor-default'}`}
                    style={{ height: 'auto', maxHeight: '65vh' }}
                  />
                </div>
              ) : (
                <div className="text-center p-12">
                  <p className="text-[#94a3b8] font-medium">尚未上傳文件</p>
                </div>
              )}
            </div>

            {/* AI Result Banner */}
            {analysis && (
              <div className="mt-4 w-full p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
                <div className="mt-1 text-blue-500"><IconSparkles /></div>
                <div>
                  <p className="text-sm font-semibold text-blue-800">AI 文件分析結果：</p>
                  <p className="text-sm text-blue-700">{analysis.description}</p>
                  {analysis.suggestedPlacements.length > 0 && (
                    <p className="text-xs font-bold text-blue-400 mt-1">
                      已在預覽圖中標註 {analysis.suggestedPlacements.length} 個建議區域
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Area: Signature List */}
          {overlays.length > 0 && (
            <div className="w-full lg:w-72 flex flex-col gap-4">
              <h3 className="text-sm font-bold text-[#64748b] uppercase tracking-wider">簽名清單</h3>
              <div className="flex-1 overflow-y-auto max-h-[400px] pr-2 space-y-3">
                {overlays.map((ov, index) => (
                  <div 
                    key={ov.id}
                    onClick={() => setSelectedId(ov.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${selectedId === ov.id ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-[#e2e8f0] bg-white'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white border border-[#e2e8f0] rounded-lg p-1 flex items-center justify-center">
                        <img src={ov.image.src} className="max-w-full max-h-full object-contain" alt="" />
                      </div>
                      <span className="text-sm font-medium text-[#1e293b]">簽名 #{index + 1}</span>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); deleteOverlay(ov.id); }}
                      className="p-1.5 text-[#94a3b8] hover:text-red-500 transition-colors"
                    >
                      <IconTrash />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="mt-8 pt-8 border-t border-[#e2e8f0] flex flex-col md:flex-row items-center justify-center gap-8">
          <div className="flex items-center gap-4 w-full max-w-md">
            <span className="text-[#64748b] font-medium whitespace-nowrap">大小：</span>
            <input 
              type="range" 
              min="0.1" 
              max="2.5" 
              step="0.01" 
              disabled={!selectedId}
              value={selectedOverlay?.scale || 1} 
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setOverlays(prev => prev.map(ov => ov.id === selectedId ? { ...ov, scale: val } : ov));
              }}
              className="flex-1 h-2 bg-[#e2e8f0] rounded-lg appearance-none cursor-pointer accent-[#22c55e] disabled:opacity-50"
            />
            <span className="text-sm font-bold text-[#1e293b] min-w-[40px]">
              {selectedOverlay ? `${Math.round(selectedOverlay.scale * 100)}%` : '1x'}
            </span>
          </div>

          <Button 
            className="bg-[#22c55e] hover:bg-[#16a34a] text-white px-8 py-3 rounded-full shadow-lg shadow-green-100 transform active:scale-95 transition-all font-bold"
            onClick={downloadResult}
            disabled={!baseImage}
            icon={<span className="mr-1">⬇️</span>}
          >
            下載圖片
          </Button>
        </div>
      </div>
      
      {/* Version Tag */}
      <div className="mt-4 text-[10px] text-[#94a3b8] font-bold tracking-widest uppercase">
        SignMaster v2.5 • AI Powered
      </div>
    </div>
  );
};

export default App;
