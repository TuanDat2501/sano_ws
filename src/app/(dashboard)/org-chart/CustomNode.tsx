import { Handle, Position } from "reactflow";

export default function CustomNode({ data }: { data: any }) {
    return (
        <div className={`relative px-4 py-3 rounded-2xl border-2 shadow-lg min-w-[160px] text-center bg-white transition-transform hover:scale-105 ${data.borderColor}`}>
            {/* Cổng kết nối ĐẦU VÀO (Nằm ở trên đỉnh) */}
            <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-slate-300 !border-white" />
            
            <div className={`text-[10px] uppercase font-black tracking-widest mb-1 ${data.textColor}`}>
                {data.role}
            </div>
            <div className="text-sm font-bold text-slate-900">
                {data.label}
            </div>
            
            {/* 🚀 Render KPI Target tuần này */}
            {data.target !== undefined && (
                <div className="mt-2.5 bg-emerald-50 text-emerald-700 text-[11px] font-black px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center justify-center gap-1.5 shadow-sm">
                    🎯 Tuần này: {data.target}
                </div>
            )}

            {/* Cổng kết nối ĐẦU RA (Nằm ở đáy) */}
            <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-slate-300 !border-white" />
        </div>
    );
}