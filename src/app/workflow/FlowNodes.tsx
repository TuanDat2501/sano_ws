// src/app/workflow/FlowNodes.tsx
import { Handle, Position } from '@xyflow/react';

// Hình Thoi (Quyết định / Rẽ nhánh)
export const DiamondNode = ({ data, selected }: any) => {
  return (
    <div className={`relative w-24 h-24 flex items-center justify-center bg-white border-2 transition-all ${selected ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'border-slate-800'}`} style={{ transform: 'rotate(45deg)', borderRadius: '4px' }}>
      <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 bg-blue-500 rounded-sm" style={{ transform: 'rotate(-45deg) translate(-12px, -12px)' }} />
      <Handle type="target" position={Position.Left} className="w-2.5 h-2.5 bg-blue-500 rounded-sm" style={{ transform: 'rotate(-45deg) translate(-12px, 12px)' }} id="left" />
      
      {/* Quay chữ ngược lại cho thẳng */}
      <div style={{ transform: 'rotate(-45deg)' }} className="text-[10px] font-bold text-slate-800 text-center select-none pointer-events-none">
        {data.label}
      </div>

      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 bg-red-500 rounded-sm" style={{ transform: 'rotate(-45deg) translate(12px, -12px)' }} id="right" />
      <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 bg-red-500 rounded-sm" style={{ transform: 'rotate(-45deg) translate(12px, 12px)' }} />
    </div>
  );
};

// Hình Tròn (Bắt đầu / Kết thúc)
export const CircleNode = ({ data, selected }: any) => {
  return (
    <div className={`relative w-20 h-20 flex items-center justify-center bg-white border-2 rounded-full transition-all ${selected ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'border-slate-800'}`}>
      <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 bg-blue-500 rounded-sm" />
      <div className="text-xs font-bold text-slate-800 text-center select-none px-2">{data.label}</div>
      <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 bg-slate-400 rounded-sm" />
    </div>
  );
};

// Hình Chữ Nhật bo góc (Tiêu chuẩn)
export const StandardNode = ({ data, selected }: any) => {
  return (
    <div className={`relative min-w-[120px] px-4 py-3 flex items-center justify-center bg-white border-2 rounded-xl transition-all ${selected ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'border-slate-800'}`}>
      <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 bg-blue-500 rounded-sm" />
      <div className="text-xs font-bold text-slate-800 text-center select-none">{data.label}</div>
      <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 bg-slate-400 rounded-sm" />
    </div>
  );
};

// Gom lại để ném vào React Flow
export const nodeTypes = {
  diamond: DiamondNode,
  circle: CircleNode,
  standard: StandardNode,
};