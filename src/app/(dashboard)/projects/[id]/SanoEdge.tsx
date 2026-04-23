"use client";

import { 
  BaseEdge, 
  EdgeLabelRenderer, 
  EdgeProps, 
  getSmoothStepPath, 
  useReactFlow 
} from 'reactflow';

export default function SanoEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
}: EdgeProps) {
  // Tính toán đường đi vuông góc (Smoothstep) và lấy tọa độ chính giữa dây (labelX, labelY)
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });

  const { setEdges } = useReactFlow();

  // Hàm cập nhật data.label khi sếp gõ chữ vào dây
  const onEdgeLabelChange = (evt: any) => {
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.id === id) {
          return { ...edge, data: { ...edge.data, label: evt.target.value } };
        }
        return edge;
      })
    );
  };

  return (
    <>
      {/* 1. Vẽ sợi dây và mũi tên */}
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      
      {/* 2. Vẽ ô Input nổi lên trên chính giữa sợi dây */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all', // 🚀 BẮT BUỘC để click vào gõ chữ được
          }}
          className="nodrag nopan"
        >
          <input
            value={data?.label || ''}
            onChange={onEdgeLabelChange}
            placeholder="Ghi chú..."
            className="w-24 bg-white/90 backdrop-blur-sm text-[10px] font-black text-slate-600 px-2 py-1 rounded-lg border border-slate-200 outline-none text-center shadow-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all placeholder:font-medium"
          />
        </div>
      </EdgeLabelRenderer>
    </>
  );
}