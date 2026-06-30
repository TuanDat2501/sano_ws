"use client";

import { Handle, Position } from "reactflow";

// Danh sách bảng màu "chuẩn Sano" để sếp chọn
const COLORS = [
    { name: 'Cam', bg: 'bg-orange-500', border: 'border-orange-200' },
    { name: 'Xanh lơ', bg: 'bg-cyan-500', border: 'border-cyan-200' },
    { name: 'Tím', bg: 'bg-purple-500', border: 'border-purple-200' },
    { name: 'Đỏ', bg: 'bg-red-500', border: 'border-red-200' },
    { name: 'Xanh lá', bg: 'bg-emerald-500', border: 'border-emerald-200' },
    { name: 'Xám', bg: 'bg-slate-500', border: 'border-slate-200' },
];

export default function SanoNode({ data }: any) {
    // Lấy màu hiện tại từ data, nếu chưa có thì mặc định là Cam
    const currentColor = COLORS.find(c => c.bg === data.color) || COLORS[0];

    return (
        <div className={`w-56 bg-white rounded-xl shadow-lg border-2 ${currentColor.border} overflow-hidden group transition-all`}>
            {/* Header: Dải màu có thể tùy biến */}
            <div className={`h-2 w-full ${currentColor.bg}`} />
            
            <div className="p-4">
                <input 
                    type="text" 
                    value={data.label} 
                    onChange={(e) => data.onChangeLabel(e.target.value)}
                    className="w-full bg-transparent font-black text-slate-800 text-sm outline-none"
                    placeholder="Tên quy trình..."
                />
                
                {/* BẢNG CHỌN MÀU (Hiện ra khi hover vào node) */}
                <div className="flex gap-1.5 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    {COLORS.map((c) => (
                        <button
                            key={c.bg}
                            onClick={() => data.onChangeColor(c.bg)}
                            className={`w-4 h-4 rounded-full ${c.bg} border border-white shadow-sm hover:scale-125 transition-transform`}
                            title={c.name}
                        />
                    ))}
                </div>
            </div>

            {/* Điểm neo nối dây */}
            <Handle id="t" type="source" position={Position.Top} className="w-5 h-5 bg-blue-500 opacity-0 group-hover:opacity-100 border-2 border-white" />
            <Handle id="r" type="source" position={Position.Right} className="w-5 h-5 bg-blue-500 opacity-0 group-hover:opacity-100 border-2 border-white" />
            <Handle id="b" type="source" position={Position.Bottom} className="w-5 h-5 bg-blue-500 opacity-0 group-hover:opacity-100 border-2 border-white" />
            <Handle id="l" type="source" position={Position.Left} className="w-5 h-5 bg-blue-500 opacity-0 group-hover:opacity-100 border-2 border-white" />
        </div>
    );
}