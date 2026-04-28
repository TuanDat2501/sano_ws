"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, ListChecks, Save, Loader2, Sparkles } from "lucide-react";
import { createPortal } from "react-dom";

interface CriteriaDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string | null;
    onSave: (criteria: any) => Promise<void>;
}

// 🚀 BỘ DATA MẪU CHUẨN ĐƯỢC CHUYỂN THÀNH HÀM ĐỂ TẠO ID MỚI MỖI KHI BẤM
const getMockCriteria = () => [
  {
    id: Date.now() + 1, name: 'I. CONTENT: CẢM XÚC & GIÁ TRỊ (RETENTION & SATISFACTION)', weight: 30,
    standards: [
      'Tạo ít nhất 1 cảm xúc rõ ràng (tò mò/sợ/bất ngờ...) từ sớm và duy trì',
      'Mang lại 1 giá trị rõ ràng (hiểu mới, góc nhìn khác, bài học) và mở dần',
      'Người xem thấy "tự hào/thông thái" khi share & chạm đúng "nỗi đau"',
      'Có thể tóm gọn giá trị video bằng 1 câu'
    ]
  },
  {
    id: Date.now() + 2, name: 'II. CONTENT: CÂU CHUYỆN & NHỊP KỂ (FLOW)', weight: 20,
    standards: [
      'Hook 3s đầu có "biến" hoặc câu hỏi gây tò mò cực độ (Khớp Thumbnail/Title)',
      'Mỗi đoạn đều có vấn đề/xung đột, thông tin được bóc tách theo lớp',
      'Nhịp kể phù hợp, có điểm nghỉ thở, không lan man',
      'Kết thúc tạo dư âm (suy nghĩ, ám ảnh, tò mò)'
    ]
  },
  {
    id: Date.now() + 3, name: 'III. EDITOR: HÌNH ẢNH & CẢM XÚC (POLISHING)', weight: 25,
    standards: [
      'Pattern Interrupt: Thay đổi góc máy, zoom, text mỗi 2-3s chống nhàm chán',
      'Pacing chuẩn: Cắt nhanh (kịch tính) & Slow-mo (lắng đọng) đúng chỗ',
      'Text/Sub nhấn mạnh đúng Keyword quan trọng',
      'Edit làm cảm xúc mạnh hơn, có khoảnh khắc "đắt giá" để nhớ'
    ]
  },
  {
    id: Date.now() + 4, name: 'IV. EDITOR: ÂM THANH & SFX', weight: 15,
    standards: [
      'Nhạc nền hỗ trợ cảm xúc (cao trào/hạ nhịp đúng lúc), không lấn Voice',
      'SFX nhấn mạnh đúng thông tin, không lạm dụng gây giật mình',
      'Âm thanh môi trường (Ambience) mượt, không giả tạo'
    ]
  },
  {
    id: Date.now() + 5, name: 'V. QLK CHỐT DUYỆT: TÍNH HÀNH ĐỘNG & THẢO LUẬN', weight: 10,
    standards: [
      'Tính nhận diện: Tắt tiếng vẫn hiểu, che logo vẫn nhận ra kênh nhà',
      'Tính hành động: Xem xong biết phải làm gì (Like/Share/Comment/Follow)',
      'Tính thảo luận: Video gây tranh cãi nhẹ hoặc khiến khán giả phải comment'
    ]
  }
];

export default function CriteriaDrawer({ isOpen, onClose, projectId, onSave }: CriteriaDrawerProps) {
    const [mounted, setMounted] = useState(false);
    const [groups, setGroups] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [projectName, setProjectName] = useState("");

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        const fetchProjectCriteria = async () => {
            if (!isOpen || !projectId) return;

            setIsLoading(true);
            try {
                const res = await fetch(`/api/projects/${projectId}`);
                if (!res.ok) throw new Error();
                const data = await res.json();
                
                setProjectName(data.name);

                if (data.criteria) {
                    const saved = typeof data.criteria === 'string' ? JSON.parse(data.criteria) : data.criteria;
                    setGroups(saved);
                } else {
                    setGroups([]); // Nếu chưa có thì để mảng rỗng để hiển thị nút Add Mẫu
                }
            } catch (error) {
                console.error("LỖI FETCH CRITERIA:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProjectCriteria();
    }, [isOpen, projectId]);

    if (!isOpen || !mounted) return null;

    const totalWeight = groups.reduce((sum, g) => sum + Number(g.weight || 0), 0);

    const updateGroup = (id: number, field: string, value: any) => {
        setGroups(groups.map(g => g.id === id ? { ...g, [field]: value } : g));
    };

    const handleSave = async () => {
        if (totalWeight !== 100) return;
        setIsSaving(true);
        await onSave(groups);
        setIsSaving(false);
    };

    // 🚀 HÀM NẠP TIÊU CHUẨN MẪU
    const handleLoadMockData = () => {
        if (groups.length > 0) {
            const confirmOverride = confirm("Sếp có chắc chắn muốn ghi đè toàn bộ tiêu chuẩn hiện tại bằng Tiêu Chuẩn Mẫu không?");
            if (!confirmOverride) return;
        }
        setGroups(getMockCriteria());
    };

    const drawerContent = (
        <>
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100000]" onClick={onClose} />
            <div className="fixed top-0 right-0 h-full w-full md:w-[550px] bg-white shadow-2xl z-[100001] flex flex-col animate-slide-in-right">
                
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                            <ListChecks className="text-red-600" /> Sườn điểm dự án
                        </h2>
                        <p className="text-xs text-slate-500 font-bold mt-1 uppercase truncate max-w-[300px]">
                            {isLoading ? "Đang tải dữ liệu..." : projectName}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} className="p-2.5 bg-white text-slate-400 hover:text-red-600 rounded-xl border border-slate-200 shadow-sm"><X size={20}/></button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative">
                    {isLoading ? (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center gap-3">
                            <Loader2 className="animate-spin text-red-600" size={40} />
                            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Đang đồng bộ dữ liệu...</p>
                        </div>
                    ) : (
                        <>
                            {/* 🚀 NÚT NẠP TIÊU CHUẨN MẪU TỰ ĐỘNG */}
                            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-inner">
                                <div>
                                    <h4 className="text-sm font-black text-indigo-800">Dùng tiêu chuẩn mẫu Sano TV?</h4>
                                    <p className="text-[11px] text-indigo-600 font-medium mt-0.5">Hệ thống sẽ tự động tạo 5 nhóm tiêu chí với tổng trọng số 100%.</p>
                                </div>
                                <button 
                                    onClick={handleLoadMockData}
                                    className="shrink-0 w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
                                >
                                    <Sparkles size={16} /> Nạp Tự Động
                                </button>
                            </div>

                            {groups.length === 0 && (
                                <div className="text-center py-10">
                                    <ListChecks size={40} className="mx-auto text-slate-300 mb-3" />
                                    <p className="text-sm font-bold text-slate-500">Chưa có tiêu chí nào. Hãy bấm nạp tự động hoặc tự tạo mới.</p>
                                </div>
                            )}

                            {groups.map((group) => (
                                <div key={group.id} className="bg-white rounded-[24px] p-5 border-2 border-slate-100 relative group shadow-sm hover:shadow-md transition-all">
                                    <button 
                                        onClick={() => setGroups(groups.filter(g => g.id !== group.id))}
                                        className="absolute -top-3 -right-3 bg-white text-slate-400 hover:text-red-600 p-2 rounded-xl border border-slate-200 shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <Trash2 size={16} />
                                    </button>

                                    <div className="flex gap-4 mb-5">
                                        <div className="flex-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên nhóm / Tầng đánh giá</label>
                                            <input 
                                                className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-black outline-none focus:border-red-500 focus:bg-white transition-all text-slate-800"
                                                value={group.name} onChange={e => updateGroup(group.id, 'name', e.target.value.toUpperCase())}
                                            />
                                        </div>
                                        <div className="w-24">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Trọng số %</label>
                                            <input 
                                                type="number" className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-black outline-none focus:border-red-500 text-center text-slate-800"
                                                value={group.weight} onChange={e => updateGroup(group.id, 'weight', parseInt(e.target.value) || 0)}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {group.standards.map((std: string, sIdx: number) => (
                                            <div key={sIdx} className="flex gap-2">
                                                <input 
                                                    className="flex-1 bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-400 focus:bg-white"
                                                    value={std}
                                                    onChange={e => {
                                                        const newStds = [...group.standards];
                                                        newStds[sIdx] = e.target.value;
                                                        updateGroup(group.id, 'standards', newStds);
                                                    }}
                                                />
                                                <button 
                                                    onClick={() => {
                                                        const newStds = group.standards.filter((_: any, i: number) => i !== sIdx);
                                                        updateGroup(group.id, 'standards', newStds);
                                                    }}
                                                    className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                        <button 
                                            onClick={() => updateGroup(group.id, 'standards', [...group.standards, ""])}
                                            className="w-full py-2 border-2 border-dashed border-slate-100 rounded-xl text-[10px] font-black text-blue-500 hover:bg-blue-50 transition-all uppercase"
                                        >
                                            + Thêm tiêu chí con
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {groups.length > 0 && (
                                <button 
                                    onClick={() => setGroups([...groups, { id: Date.now(), name: "", weight: 0, standards: [""] }])}
                                    className="w-full border-2 border-dashed border-slate-200 p-5 rounded-[24px] text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-white transition-all font-black text-xs flex items-center justify-center gap-2 uppercase tracking-widest"
                                >
                                    <Plus size={20} /> Thêm Nhóm Tầng Mới
                                </button>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 bg-white">
                    <div className={`mb-5 p-4 rounded-2xl flex items-center justify-between border-2 transition-all ${totalWeight === 100 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                        <span className="text-xs font-black uppercase tracking-widest">Tổng tỉ trọng:</span>
                        <span className="text-xl font-black">{totalWeight}% / 100%</span>
                    </div>
                    
                    <div className="flex gap-3">
                        <button onClick={onClose} className="flex-1 bg-slate-100 text-slate-600 font-black py-4 rounded-2xl active:scale-95 transition-all">Đóng</button>
                        <button 
                            onClick={handleSave}
                            disabled={totalWeight !== 100 || isSaving || isLoading}
                            className="flex-[2] bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-red-600/30 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-all"
                        >
                            {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                            LƯU CẤU HÌNH
                        </button>
                    </div>
                </div>
            </div>
        </>
    );

    return createPortal(drawerContent, document.body);
}