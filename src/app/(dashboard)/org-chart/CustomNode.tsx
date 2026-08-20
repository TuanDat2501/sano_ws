import { Handle, Position } from "reactflow";
import { Tv } from "lucide-react"; 

export default function CustomNode({ data }: { data: any }) {
    const actual = data.actual ?? 0;
    const target = data.target ?? 0;
    const surplusDetails = data.surplusDetails || []; 
    
    const percent = target > 0 ? Math.round((actual / target) * 100) : 0;
    const barWidth = Math.min(percent, 100); 
    const progressColor = percent >= 100 ? 'bg-emerald-500' : percent >= 50 ? 'bg-amber-400' : 'bg-red-500';

    const initials = data.label ? data.label.charAt(0).toUpperCase() : "?";
    const showAvatar = data.role !== "Điều hành" && data.role !== "Phòng Ban";

    const targetPos = data.targetPosition === 'left' ? Position.Left : Position.Top;

    return (
        <div className={`relative p-3 md:p-3.5 rounded-[18px] border bg-white shadow-sm hover:shadow-xl transition-all w-[240px] md:w-[260px] ${data.borderColor}`}>
            <Handle type="target" position={targetPos} className="!w-2 !h-2 !bg-slate-300 !border-white" />
            
            <div className={`flex items-center ${showAvatar ? 'gap-3' : 'justify-center py-2'} mb-3`}>
                {showAvatar && (
                    data.avatar ? (
                        <img src={data.avatar} alt="avatar" className="w-10 h-10 rounded-full object-cover border-2 border-slate-100 shadow-sm shrink-0" />
                    ) : (
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-white shrink-0 shadow-sm text-sm ${data.role === 'EDITOR' ? 'bg-purple-500' : data.role === 'LEADER' ? 'bg-blue-500' : data.role === 'Kênh' ? 'bg-teal-500' : data.role === 'Team' ? 'bg-amber-500' : 'bg-slate-600'}`}>
                            {data.role === 'Kênh' ? <Tv size={16} /> : initials}
                        </div>
                    )
                )}

                <div className={`${showAvatar ? 'text-left flex-1 min-w-0' : 'text-center'}`}>
                    <p className={`text-[9px] uppercase font-black tracking-widest leading-none mb-1 ${data.textColor}`}>
                        {data.role}
                    </p>
                    <p className="text-[13px] md:text-sm font-bold text-slate-900 truncate leading-tight">
                        {data.label}
                    </p>
                </div>
            </div>
            
            {data.target !== undefined && data.role !== 'Kênh' && (
                <div className="flex flex-col gap-2">
                    
                    <div className="bg-slate-50 p-2 md:p-2.5 rounded-xl border border-slate-100">
                        <div className="flex justify-between items-center text-[10px] font-black mb-1.5">
                            <span className="text-slate-400 uppercase tracking-widest">Tiến độ</span>
                            <span className={percent >= 100 ? 'text-emerald-600' : 'text-slate-700'}>
                                {actual} / {target} <span className="opacity-50">({percent}%)</span>
                            </span>
                        </div>
                        
                        <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                            <div 
                                className={`h-full rounded-full transition-all duration-700 ease-out ${progressColor}`} 
                                style={{ width: `${barWidth}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* 🚀 ĐÃ THIẾT KẾ LẠI: Hiển thị text xếp dọc gọn gàng theo chuẩn hình mẫu */}
                    {surplusDetails.length > 0 && (
                        <div className="flex justify-center mt-1">
                            <div className="flex text-[11px] md:text-xs font-black text-rose-500 leading-tight">
                                <span className="mr-1.5">Dư:</span>
                                <div className="flex flex-col">
                                    {surplusDetails.map((s: any, idx: number) => (
                                        <span key={idx}>
                                            {s.count} bài {s.duration ? s.duration + ' phút' : '? phút'}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-slate-300 !border-white" />
        </div>
    );
}