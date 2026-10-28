import { Handle, Position } from "reactflow";

const translateRole = (role: string) => {
    if (!role) return "";
    const r = String(role).toUpperCase();
    switch (r) {
        case 'LEADER': return 'Leader';
        case 'PUBLISH':
        case 'PUBLISHER':
        case 'QUAN_LY':
        case 'QUẢN LÝ':
        case 'CHANNEL_MANAGER': return 'Quản lý kênh';
        case 'CONTENT': return 'Content';
        case 'EDIT':
        case 'EDITOR': return 'Editor';
        case 'ANIMATOR':
        case 'ANIMATION': return 'Chuyển Động';
        case 'KÊNH': return ''; 
        default: return role;
    }
};

const getBgColor = (role: string) => {
    const r = String(role).toUpperCase();
    if (r === 'KÊNH') return 'bg-[#7ae2e2]'; // Xanh ngọc (Cyan)
    if (r.includes('PUBLISH') || r.includes('MANAGER') || r.includes('QUẢN LÝ') || r.includes('QUAN_LY')) return 'bg-[#fae14f]'; // Vàng
    if (r.includes('EDIT')) return 'bg-[#eed7f8]'; // Tím nhạt
    if (r.includes('CONTENT')) return 'bg-[#d6f2d6]'; // Xanh lá nhạt
    if (r.includes('ANIMAT')) return 'bg-[#ffe4b5]'; // Cam đào
    if (r === 'LEADER') return 'bg-[#facc15]'; 
    if (r === 'SƠ ĐỒ TỔ CHỨC') return 'bg-[#fca5a5]';
    return 'bg-slate-100';
};

export default function CustomNode({ data }: { data: any }) {
    const targetPos = data.targetPosition === 'left' ? Position.Left : Position.Top;
    const bgColor = getBgColor(data.role);

    // ==========================================
    // 1. NODE NHÓM (Gộp nhiều nhân sự cùng Khâu)
    // ==========================================
    if (data.isGroup) {
        const roleName = translateRole(data.role);
        return (
            <div className={`relative px-4 py-3 rounded-xl border border-slate-800 shadow-sm w-[220px] md:w-[240px] ${bgColor} font-['Times_New_Roman',_serif] font-bold text-center`}>
                <Handle type="target" position={targetPos} className="!w-0 !h-0 !border-0 !bg-transparent opacity-0" />
                
                <div className="text-[15px] md:text-[16px] text-black leading-tight mb-2">
                    {roleName}
                </div>

                {data.users.map((u: any, idx: number) => {
                    let kpiStrings: string[] = [];
                    if (u.targetDetails && u.targetDetails.length > 0) {
                        u.targetDetails.forEach((td: any) => {
                            if (td.targetCount > 0) {
                                kpiStrings.push(`KPI: ${td.targetCount} bài ${td.duration || 0} phút${td.isRework ? ' (sửa)' : ''}`);
                            }
                        });
                    }
                    
                    return (
                        <div key={idx} className="mb-2 last:mb-0">
                            <div className="text-[14px] md:text-[15px] text-black leading-tight">
                                {u.fullName}
                            </div>
                            {kpiStrings.map((str, i) => (
                                <div key={i} className="text-[13px] md:text-[14px] text-red-600 leading-tight">
                                    {str}
                                </div>
                            ))}
                            {u.surplusDetails.map((s: any, i: number) => (
                                <div key={i} className="text-[13px] md:text-[14px] text-red-600 leading-tight">
                                    Dư: {s.count} bài {s.duration ? s.duration + ' phút' : ''}
                                </div>
                            ))}
                        </div>
                    );
                })}

                <Handle type="source" position={Position.Bottom} className="!w-0 !h-0 !border-0 !bg-transparent opacity-0" />
            </div>
        );
    }

    // ==========================================
    // 2. NODE ĐƠN LẺ (Kênh, Giám Đốc, Quản lý lẻ)
    // ==========================================
    const roleName = translateRole(data.role);
    let kpiStrings: string[] = [];
    if (data.targetDetails && data.targetDetails.length > 0) {
         data.targetDetails.forEach((td: any) => {
             if (td.targetCount > 0) {
                 kpiStrings.push(`KPI: ${td.targetCount} bài ${td.duration || 0} phút${td.isRework ? ' (sửa)' : ''}`);
             }
         });
    }
    const surplusDetails = data.surplusDetails || [];

    return (
        <div className={`relative px-4 py-3 rounded-xl border border-slate-800 shadow-sm w-[220px] md:w-[240px] ${bgColor} font-['Times_New_Roman',_serif] font-bold text-center`}>
            <Handle type="target" position={targetPos} className="!w-0 !h-0 !border-0 !bg-transparent opacity-0" />
            
            {roleName && data.role !== 'Kênh' && (
                <div className="text-[15px] md:text-[16px] text-black leading-tight mb-1">
                    {roleName}
                </div>
            )}
            
            <div className="text-[15px] md:text-[16px] text-black leading-tight mt-0.5">
                {data.label}
            </div>

            {kpiStrings.map((str, idx) => (
                <div key={idx} className="text-[13px] md:text-[14px] text-red-600 leading-tight mt-0.5">
                    {str}
                </div>
            ))}

            {surplusDetails.map((s: any, idx: number) => (
                <div key={idx} className="text-[13px] md:text-[14px] text-red-600 leading-tight mt-0.5">
                    Dư: {s.count} bài {s.duration ? s.duration + ' phút' : ''}
                </div>
            ))}

            <Handle type="source" position={Position.Bottom} className="!w-0 !h-0 !border-0 !bg-transparent opacity-0" />
        </div>
    );
}