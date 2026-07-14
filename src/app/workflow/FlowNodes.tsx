import { Handle, Position, useReactFlow, BaseEdge, getBezierPath, EdgeProps } from '@xyflow/react';

// ==========================================
// 1. CUSTOM EDGE (ĐƯỜNG NỐI CÓ TEXT SỬA ĐƯỢC)
// ==========================================
export const EditableEdge = ({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, data, selected
}: EdgeProps) => {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  const onEdgeLabelChange = (evt: any) => {
    setEdges((eds) => eds.map((edge) => {
      if (edge.id === id) {
        // 🚀 ĐÃ SỬA: Trả về một object Edge mới hoàn toàn để React Flow chịu render lại
        return { ...edge, data: { ...edge.data, label: evt.target.value } };
      }
      return edge;
    }));
  };

  // Kiểm tra xem đã có chữ bên trong chưa
  const hasLabel = data?.label && (data.label as string).trim() !== '';

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      
      {(selected || hasLabel) && (
        <foreignObject
          width={100} height={40}
          x={labelX - 50} y={labelY - 20}
          className="nodrag nopan overflow-visible z-50"
          requiredExtensions="http://www.w3.org/1999/xhtml"
        >
          <div className="flex flex-col items-center justify-center h-full">
            {selected ? (
              <input
                value={data?.label as string || ''}
                onChange={onEdgeLabelChange}
                onKeyDown={(e) => e.stopPropagation()} // Chặn phím delete
                placeholder="Gõ chú thích..."
                autoFocus 
                className="w-[80px] bg-white border border-blue-400 text-[10px] text-center rounded-md px-1 py-0.5 outline-none shadow-[0_0_10px_rgba(59,130,246,0.3)] text-slate-900 font-bold"
              />
            ) : (
              <div className="bg-white border border-slate-200 text-[10px] font-bold text-center rounded-md px-2 py-0.5 shadow-sm text-slate-700">
                {data?.label as string}
              </div>
            )}
          </div>
        </foreignObject>
      )}
    </>
  );
};


// ==========================================
// 2. CÁC HÀM TIỆN ÍCH DÙNG CHUNG
// ==========================================
const useNodeActions = (id: string) => {
  const { setNodes } = useReactFlow();
  
  const onLabelChange = (evt: any) => {
    setNodes((nds) => nds.map((node) => {
      if (node.id === id) {
        // 🚀 ĐÃ SỬA: Trả về một object Node mới hoàn toàn
        return { ...node, data: { ...node.data, label: evt.target.value } };
      }
      return node;
    }));
  };

  return { onLabelChange };
};


// ==========================================
// 3. CUSTOM NODES
// ==========================================

// Hình Thoi (Quyết định / Rẽ nhánh)
export const DiamondNode = ({ id, data, selected }: any) => {
  const { onLabelChange } = useNodeActions(id);

  return (
    <div className={`relative w-24 h-24 flex items-center justify-center bg-white border-2 transition-all ${selected ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'border-slate-800'}`} style={{ transform: 'rotate(45deg)', borderRadius: '4px' }}>
      <Handle type="source" position={Position.Top} className="w-2.5 h-2.5 bg-slate-400 rounded-sm" style={{ transform: 'rotate(-45deg) translate(-12px, -12px)' }} id="t" />
      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 bg-slate-400 rounded-sm" style={{ transform: 'rotate(-45deg) translate(12px, -12px)' }} id="r" />
      <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 bg-slate-400 rounded-sm" style={{ transform: 'rotate(-45deg) translate(12px, 12px)' }} id="b" />
      <Handle type="source" position={Position.Left} className="w-2.5 h-2.5 bg-slate-400 rounded-sm" style={{ transform: 'rotate(-45deg) translate(-12px, 12px)' }} id="l" />
      
      <div style={{ transform: 'rotate(-45deg)' }} className="w-[120%] absolute flex justify-center">
         <input
          value={data.label}
          onChange={onLabelChange}
          onKeyDown={(e) => e.stopPropagation()} 
          className="nodrag text-[10px] font-bold text-slate-800 text-center bg-transparent outline-none w-full"
        />
      </div>
    </div>
  );
};

// Hình Tròn (Bắt đầu / Kết thúc)
export const CircleNode = ({ id, data, selected }: any) => {
  const { onLabelChange } = useNodeActions(id);

  return (
    <div className={`relative w-20 h-20 flex items-center justify-center bg-white border-2 rounded-full transition-all ${selected ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'border-slate-800'}`}>
      <Handle type="source" position={Position.Top} id="t" className="w-2.5 h-2.5 bg-slate-400 rounded-sm" />
      <Handle type="source" position={Position.Right} id="r" className="w-2.5 h-2.5 bg-slate-400 rounded-sm" />
      <Handle type="source" position={Position.Bottom} id="b" className="w-2.5 h-2.5 bg-slate-400 rounded-sm" />
      <Handle type="source" position={Position.Left} id="l" className="w-2.5 h-2.5 bg-slate-400 rounded-sm" />

      <input
        value={data.label}
        onChange={onLabelChange}
        onKeyDown={(e) => e.stopPropagation()} 
        className="nodrag text-xs font-bold text-slate-800 text-center bg-transparent outline-none w-full px-1"
      />
    </div>
  );
};

// Hình Chữ Nhật bo góc (Tiêu chuẩn)
export const StandardNode = ({ id, data, selected }: any) => {
  const { onLabelChange } = useNodeActions(id);

  return (
    <div className={`relative min-w-[120px] px-4 py-3 flex items-center justify-center bg-white border-2 rounded-xl transition-all ${selected ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'border-slate-800'}`}>
      <Handle type="source" position={Position.Top} id="t" className="w-2.5 h-2.5 bg-slate-400 rounded-sm" />
      <Handle type="source" position={Position.Right} id="r" className="w-2.5 h-2.5 bg-slate-400 rounded-sm" />
      <Handle type="source" position={Position.Bottom} id="b" className="w-2.5 h-2.5 bg-slate-400 rounded-sm" />
      <Handle type="source" position={Position.Left} id="l" className="w-2.5 h-2.5 bg-slate-400 rounded-sm" />

      <input
        value={data.label}
        onChange={onLabelChange}
        onKeyDown={(e) => e.stopPropagation()} 
        className="nodrag text-xs font-bold text-slate-800 text-center bg-transparent outline-none w-full"
      />
    </div>
  );
};

// Gom lại để ném vào React Flow
export const nodeTypes = {
  diamond: DiamondNode,
  circle: CircleNode,
  standard: StandardNode,
};

// Gom Custom Edge
export const edgeTypes = {
  editable: EditableEdge,
};