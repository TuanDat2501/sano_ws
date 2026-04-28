"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Save, Loader2, Sparkles, ListChecks } from "lucide-react";
import { createPortal } from "react-dom";
import { useToast } from "@/app/component/ToastProvider";

// 🚀 BỘ DATA MẪU CHUẨN SANO TV
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

export default function SampleCriteriaDrawer({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    const [mounted, setMounted] = useState(false);
    const [groups, setGroups] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const { showToast } = useToast();

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        if (isOpen) {
            fetchSample();
        }
    }, [isOpen]);

    const fetchSample = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/settings/sample-criteria");
            const data = await res.json();
            if (data.criteria) {
                setGroups(JSON.parse(data.criteria));
            } else {
                setGroups([]);
            }
        } catch (error) {
            console.error("Lỗi fetch mẫu:", error);
            setGroups([]);
        } finally {
            setIsLoading(false);
        }
    };

    // 🚀 HÀM NẠP DỮ LIỆU MẪU
    const handleLoadMockData = () => {
        if (groups.length > 0) {
            const confirmOverride = confirm("Sếp có chắc chắn muốn nạp đè Tiêu chuẩn mẫu Sano TV lên cấu hình hiện tại?");
            if (!confirmOverride) return;
        }
        setGroups(getMockCriteria());
    };

    const totalWeight = groups.reduce((sum, g) => sum + Number(g.weight || 0), 0);

    const handleSave = async () => {
        if (totalWeight !== 100) {
            showToast("error", "Tổng trọng số phải bằng 100%");
            return;
        }

        setIsSaving(true);
        try {
            const res = await fetch("/api/settings/sample-criteria", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ criteria: JSON.stringify(groups) })
            });
            if (res.ok) {
                showToast("success", "Đã cập nhật Tiêu chuẩn mẫu hệ thống!");
                onClose();
            }
        } catch (error) {
            showToast("error", "Lỗi lưu dữ liệu");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen || !mounted) return null;

    return createPortal(
        <>
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100000]" onClick={onClose} />
            <div className="fixed top-0 right-0 h-full w-full md:w-[600px] bg-white shadow-2xl z-[100001] flex flex-col animate-slide-in-right">
                
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-600 text-white shadow-md">
                    <div>
                        <h2 className="text-xl font-black flex items-center gap-2">
                            <Sparkles /> Bộ Tiêu Chuẩn Mẫu Hệ Thống
                        </h2>
                        <p className="text-xs font-bold mt-1 opacity-80 uppercase tracking-widest">Dùng để áp dụng nhanh cho các dự án mới</p>
                    </div>
                    <button onClick={onClose} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"><X size={20}/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative">
                    {isLoading ? (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center gap-3">
                            <Loader2 className="animate-spin text-indigo-600" size={40} />
                            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Đang tải cấu hình...</p>
                        </div>
                    ) : (
                        <>
                            {/* 🚀 BOX NẠP TIÊU CHUẨN TỰ ĐỘNG */}
                            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-inner">
                                <div>
                                    <h4 className="text-sm font-black text-indigo-900 flex items-center gap-2"><ListChecks size={18} /> Tiêu Chuẩn</h4>
                                    <p className="text-[11px] text-indigo-600 font-medium mt-1">Đã được tinh chỉnh tối ưu cho Retention & Satisfaction. Gồm 5 tầng với tổng 100% điểm.</p>
                                </div>
                                <button 
                                    onClick={handleLoadMockData}
                                    className="shrink-0 w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
                                >
                                    <Sparkles size={16} /> Nạp Tự Động
                                </button>
                            </div>

                            {groups.length === 0 && (
                                <div className="text-center py-10">
                                    <ListChecks size={40} className="mx-auto text-slate-300 mb-3" />
                                    <p className="text-sm font-bold text-slate-500">Hệ thống chưa có tiêu chuẩn mẫu.<br/>Hãy bấm "Nạp Tự Động" để dùng bản Sano TV!</p>
                                </div>
                            )}

                            {groups.map((group) => (
                                <div key={group.id} className="bg-white rounded-[24px] p-5 border-2 border-slate-100 relative group shadow-sm">
                                    <button 
                                        onClick={() => setGroups(groups.filter(g => g.id !== group.id))}
                                        className="absolute -top-3 -right-3 bg-white text-slate-400 hover:text-red-600 p-2 rounded-xl border border-slate-200 shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                                    ><Trash2 size={16} /></button>

                                    <div className="flex gap-4 mb-4">
                                        <div className="flex-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên Tầng Đánh Giá</label>
                                            <input 
                                                className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-black outline-none focus:border-indigo-500 text-slate-800"
                                                value={group.name} placeholder="TÊN NHÓM TIÊU CHÍ..."
                                                onChange={e => setGroups(groups.map(g => g.id === group.id ? {...g, name: e.target.value.toUpperCase()} : g))}
                                            />
                                        </div>
                                        <div className="w-24">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tỷ trọng</label>
                                            <input 
                                                type="number" className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-black text-center outline-none focus:border-indigo-500 text-slate-800"
                                                value={group.weight} placeholder="%"
                                                onChange={e => setGroups(groups.map(g => g.id === group.id ? {...g, weight: parseInt(e.target.value) || 0} : g))}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {group.standards.map((std: string, sIdx: number) => (
                                            <div key={sIdx} className="flex gap-2 items-start">
                                                <div className="w-6 h-8 flex items-center justify-center text-xs font-black text-slate-300">{sIdx + 1}.</div>
                                                <input 
                                                    className="flex-1 bg-slate-50 border border-slate-100 rounded-lg p-2.5 text-xs font-bold text-slate-700 outline-none focus:border-indigo-400 focus:bg-white"
                                                    value={std} placeholder="Mô tả tiêu chí..."
                                                    onChange={e => {
                                                        const newStds = [...group.standards];
                                                        newStds[sIdx] = e.target.value;
                                                        setGroups(groups.map(g => g.id === group.id ? {...g, standards: newStds} : g));
                                                    }}
                                                />
                                                <button onClick={() => {
                                                    const newStds = group.standards.filter((_: any, i: number) => i !== sIdx);
                                                    setGroups(groups.map(g => g.id === group.id ? {...g, standards: newStds} : g));
                                                }} className="p-2 text-slate-300 hover:text-red-500 mt-0.5"><Trash2 size={14} /></button>
                                            </div>
                                        ))}
                                        <div className="pl-8 pt-2">
                                            <button 
                                                onClick={() => setGroups(groups.map(g => g.id === group.id ? {...g, standards: [...g.standards, ""]} : g))}
                                                className="w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-[10px] font-black text-indigo-500 hover:bg-indigo-50 transition-all uppercase"
                                            >+ Thêm tiêu chí con</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            
                            {groups.length > 0 && (
                                <button 
                                    onClick={() => setGroups([...groups, { id: Date.now(), name: "", weight: 0, standards: [""] }])}
                                    className="w-full border-2 border-dashed border-slate-300 p-5 rounded-[24px] text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all font-black text-xs uppercase flex justify-center gap-2"
                                ><Plus size={16}/> Thêm nhóm tầng mới</button>
                            )}
                        </>
                    )}
                </div>

                <div className="p-6 border-t border-slate-100 bg-white">
                    <div className={`mb-4 p-3 rounded-2xl flex items-center justify-between border-2 transition-all ${totalWeight === 100 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                        <span className="text-xs font-black uppercase tracking-widest ml-2">Tổng điểm tỷ trọng:</span>
                        <span className="text-xl font-black mr-2">{totalWeight}% / 100%</span>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={onClose} className="flex-1 bg-slate-100 text-slate-600 font-black py-4 rounded-2xl active:scale-95 transition-all">Đóng</button>
                        <button 
                            onClick={handleSave} disabled={isSaving || isLoading || totalWeight !== 100}
                            className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />} LƯU BỘ KHUNG CHUẨN
                        </button>
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
}