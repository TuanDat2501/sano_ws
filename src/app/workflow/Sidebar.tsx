import { Square, Circle, Diamond, Database, Type, FileText, Play, Cloud, Equal } from 'lucide-react';

export default function Sidebar() {
  // Gắn mác dữ liệu khi bắt đầu kéo
  const onDragStart = (event: any, nodeType: string, label: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  // Class xài chung cho các ô công cụ (Viền mỏng, bo góc nhẹ, căn giữa)
  const baseItemClass = "w-full py-2 flex items-center justify-center border rounded-md cursor-grab active:cursor-grabbing transition-colors mb-2.5";

  return (
    <aside className="w-56 bg-white border-r border-slate-200 h-full flex flex-col z-10 shadow-sm">
      {/* HEADER CĂN GIỮA */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-center shrink-0">
        <h3 className="font-black text-slate-900 text-[15px]">Shapes (Khối)</h3>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-8">
        
        {/* ================= NHÓM STANDARD ================= */}
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="bg-slate-100 text-slate-400 rounded-md px-1.5 py-0.5">
              <Equal size={10} strokeWidth={3} />
            </div>
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em]">Standard</h4>
          </div>
          
          <div 
            className={`${baseItemClass} border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300`}
            draggable onDragStart={(e) => onDragStart(e, 'standard', 'Văn bản')}
          >
            <Type size={18} />
          </div>
          
          <div 
            className={`${baseItemClass} border-amber-500 text-amber-500 hover:bg-amber-50`}
            draggable onDragStart={(e) => onDragStart(e, 'standard', 'Ghi chú')}
          >
            <FileText size={18} />
          </div>
          
          <div 
            className={`${baseItemClass} bg-emerald-100/50 border-emerald-200 text-emerald-600 hover:bg-emerald-100`}
            draggable onDragStart={(e) => onDragStart(e, 'standard', 'Hành động')}
          >
            <Play size={18} />
          </div>
        </div>

        {/* ================= NHÓM FLOWCHART ================= */}
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="bg-slate-100 text-slate-400 rounded-md px-1.5 py-0.5">
              <Equal size={10} strokeWidth={3} />
            </div>
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em]">Flowchart</h4>
          </div>
          
          <div 
            className={`${baseItemClass} border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300`}
            draggable onDragStart={(e) => onDragStart(e, 'standard', 'Quy trình')}
          >
            <Square size={18} />
          </div>
          
          <div 
            className={`${baseItemClass} border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300`}
            draggable onDragStart={(e) => onDragStart(e, 'diamond', 'Điều kiện')}
          >
            <Diamond size={18} />
          </div>
          
          <div 
            className={`${baseItemClass} border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300`}
            draggable onDragStart={(e) => onDragStart(e, 'circle', 'Bắt đầu / Kết thúc')}
          >
            <Circle size={18} />
          </div>
          
          <div 
            className={`${baseItemClass} border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300`}
            draggable onDragStart={(e) => onDragStart(e, 'standard', 'Dữ liệu')}
          >
            <Database size={18} />
          </div>
          
          <div 
            className={`${baseItemClass} border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300`}
            draggable onDragStart={(e) => onDragStart(e, 'standard', 'Đám mây')}
          >
            <Cloud size={18} />
          </div>
        </div>

      </div>
    </aside>
  );
}