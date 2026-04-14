import { Handle, Position } from "reactflow";

export default function CustomNode({ data }: { data: any }) {
    const actual = data.actual ?? 0;
    const target = data.target ?? 0;
    
    const percent = target > 0 ? Math.round((actual / target) * 100) : 0;
    const barWidth = Math.min(percent, 100); 
    const progressColor = percent >= 100 ? 'bg-emerald-500' : percent >= 50 ? 'bg-amber-400' : 'bg-red-500';

    const initials = data.label ? data.label.charAt(0).toUpperCase() : "?";

    const showAvatar = data.role !== "Điều hành" && data.role !== "Phòng Ban";

    return (
        // Đã ghim chết min-w-[200px] để thuật toán dàn cây (Dagre) không bị lệch toạ độ
        <div className={`relative p-2.5 md:p-3 rounded-xl md:rounded-2xl border bg-white shadow-sm hover:shadow-lg transition-all min-w-[200px] md:min-w-[220px] ${data.borderColor}`}>
            <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-slate-300 !border-white" />
            
            <div className={`flex items-center ${showAvatar ? 'gap-2.5 md:gap-3' : 'justify-center py-1 md:py-2'} mb-2.5 md:mb-3`}>
                
                {showAvatar && (
                    data.avatar ? (
                        <img src={data.avatar} alt="avatar" className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover border border-slate-100 shadow-sm shrink-0" />
                    ) : (
                        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-black text-white shrink-0 shadow-sm text-xs md:text-sm ${data.role === 'EDITOR' ? 'bg-purple-500' : data.role === 'LEADER' ? 'bg-blue-500' : data.role === 'Team' ? 'bg-amber-500' : 'bg-slate-600'}`}>
                            {initials}
                        </div>
                    )
                )}

                <div className={`${showAvatar ? 'text-left flex-1 min-w-0' : 'text-center'}`}>
                    <p className={`text-[8px] md:text-[9px] uppercase font-black tracking-widest leading-none mb-1 md:mb-1.5 truncate ${data.textColor}`}>
                        {data.role}
                    </p>
                    <p className="text-xs md:text-[13px] font-bold text-slate-900 truncate leading-none">
                        {data.label}
                    </p>
                </div>
            </div>
            
            {data.target !== undefined && (
                <div className="bg-slate-50 p-1.5 md:p-2 rounded-lg md:rounded-xl border border-slate-100 mt-1">
                    <div className="flex justify-between text-[9px] md:text-[10px] font-black mb-1 md:mb-1.5">
                        <span className="text-slate-400 uppercase tracking-widest">Tiến độ</span>
                        <span className={percent >= 100 ? 'text-emerald-600' : 'text-slate-700'}>
                            {actual} / {target} <span className="opacity-50">({percent}%)</span>
                        </span>
                    </div>
                    
                    <div className="h-1 md:h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div 
                            className={`h-full rounded-full transition-all duration-700 ease-out ${progressColor}`} 
                            style={{ width: `${barWidth}%` }}
                        ></div>
                    </div>
                </div>
            )}

            <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-slate-300 !border-white" />
        </div>
    );
}