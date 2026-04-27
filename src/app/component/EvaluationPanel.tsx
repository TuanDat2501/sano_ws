"use client";

// 🚀 Đã import thêm UserCircle2
import { CheckCircle2, AlertTriangle, Loader2, ClipboardCheck, ArrowRight, Settings, UserCircle2 } from "lucide-react";
import { useState, useMemo, useEffect } from "react";

interface EvaluationPanelProps {
  task: any;
  onCancel: () => void;
  onSubmit: (score: number, criteriaData: any, note: string) => Promise<void>;
}

export default function EvaluationPanel({ task, onCancel, onSubmit }: EvaluationPanelProps) {
  const [checkedStandards, setCheckedStandards] = useState<Record<string, boolean>>({});
  const [kaizenNote, setKaizenNote] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);

  useEffect(() => {
    if (task?.evaluation) {
        const evalData = task.evaluation;
        setKaizenNote(evalData.kaizenNote || '');
        try {
            const savedCriteria = typeof evalData.criteria === 'string' 
                ? JSON.parse(evalData.criteria) 
                : evalData.criteria;
            
            if (savedCriteria && savedCriteria.checkedStandards) {
                setCheckedStandards(savedCriteria.checkedStandards);
            }
        } catch (error) {
            console.error("Lỗi load lại dữ liệu đã chấm:", error);
        }
    }
  }, [task]);

  const criteriaList = useMemo(() => {
    if (!task?.project?.criteria) return [];
    try {
        const parsed = typeof task.project.criteria === 'string' ? JSON.parse(task.project.criteria) : task.project.criteria;
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
  }, [task]);

  const currentScore = useMemo(() => {
    if (criteriaList.length === 0) return 0;
    
    let totalScore = 0;
    criteriaList.forEach((group: any) => {
      const totalItems = group.standards?.length || 0;
      if (totalItems === 0) return;

      let checkedItems = 0;
      group.standards.forEach((std: string, idx: number) => {
         const uniqueId = `${group.id}-${idx}`;
         if (checkedStandards[uniqueId]) checkedItems++;
      });

      totalScore += (checkedItems / totalItems) * (Number(group.weight) / 10);
    });
    
    return Number(totalScore.toFixed(1));
  }, [checkedStandards, criteriaList]);

  const handleStandardToggle = (uniqueId: string) => {
    setCheckedStandards(prev => ({ ...prev, [uniqueId]: !prev[uniqueId] }));
  };

  const isPass = currentScore >= 7;
  const isSubmitDisabled = isEvaluating || (!isPass && kaizenNote.trim().length < 5);

  const handleSubmit = async () => {
    setIsEvaluating(true);
    try {
      await onSubmit(currentScore, { criteriaList, checkedStandards }, kaizenNote);
    } finally {
      setIsEvaluating(false); 
    }
  };

  if (criteriaList.length === 0) {
      return (
          <div className="flex flex-col h-full bg-slate-50 items-center justify-center p-6 text-center animate-fade-in relative z-10">
              <div className="w-20 h-20 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center mb-4 shadow-inner">
                  <Settings size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">Chưa có Sườn điểm!</h3>
              <p className="text-sm text-slate-500 font-medium mb-6">
                  Dự án <strong>{task?.project?.name}</strong> chưa được thiết lập Tiêu chuẩn đánh giá. Vui lòng nhờ Leader vào mục Danh sách dự án để cấu hình trước khi chấm điểm.
              </p>
              <button onClick={onCancel} className="px-6 py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-black transition-all active:scale-95">
                  Quay lại Chat
              </button>
          </div>
      );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 animate-fade-in relative z-10">
      
      {/* 🚀 HEADER ĐÃ ĐƯỢC LÀM LẠI UI */}
      <div className={`p-5 md:p-6 text-white flex justify-between items-start shrink-0 shadow-md z-20 transition-colors duration-500 ${isPass ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
        <div className="flex-1 pr-4">
          <h3 className="font-black text-lg md:text-xl flex items-center gap-2">
            <ClipboardCheck size={22} className="shrink-0" /> Phiếu Chấm Điểm
          </h3>
          <p className="text-white/80 text-xs md:text-sm font-medium mt-1 truncate">
            Dự án: {task.project?.name || 'Chưa rõ'}
          </p>

          {/* 🚀 BOX HIỂN THỊ NGƯỜI ĐÃ CHẤM (Chỉ hiện khi đã có điểm) */}
          {task?.evaluation && (
             <div className="mt-3 inline-flex items-center gap-1.5 bg-black/10 hover:bg-black/20 transition-colors px-2.5 py-1.5 rounded-lg text-[10px] md:text-xs font-medium border border-white/20 backdrop-blur-sm w-max">
                <UserCircle2 size={14} className="opacity-90 shrink-0" />
                <span>
                    Đã chấm bởi <strong className="font-black text-white">{task.evaluation.evaluator?.fullName || "Quản lý"}</strong>
                </span>
                <span className="opacity-70 ml-0.5">
                    - {new Date(task.evaluation.createdAt).toLocaleDateString('vi-VN')}
                </span>
             </div>
          )}
        </div>

        {/* 🚀 Cục Điểm Số */}
        <div className="text-right shrink-0">
          <p className="text-[10px] font-black uppercase text-white/70 tracking-widest mb-0.5">Tổng Điểm</p>
          <div className="text-4xl md:text-5xl font-black tabular-nums tracking-tight leading-none">
            {currentScore} <span className="text-lg md:text-xl text-white/70 font-bold">/10</span>
          </div>
        </div>
      </div>

      {/* Form Checklist */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar">
        {criteriaList.map((group: any) => (
          <div key={group.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-100/50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
              <span className="font-black text-xs text-slate-700 uppercase">{group.name}</span>
              <span className="text-[10px] font-black text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200">Trọng số: {group.weight}%</span>
            </div>
            <div className="p-2">
              {group.standards?.map((stdText: string, idx: number) => {
                const uniqueId = `${group.id}-${idx}`;
                return (
                    <div 
                        key={idx} 
                        onClick={() => handleStandardToggle(uniqueId)}
                        className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all hover:bg-slate-50 ${checkedStandards[uniqueId] ? 'bg-indigo-50/40' : ''}`}
                    >
                        <div className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${checkedStandards[uniqueId] ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'}`}>
                            {checkedStandards[uniqueId] && <CheckCircle2 size={14} strokeWidth={3} />}
                        </div>
                        <span className={`text-sm font-medium transition-colors ${checkedStandards[uniqueId] ? 'text-indigo-900 font-bold' : 'text-slate-600'}`}>
                            {stdText}
                        </span>
                    </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Ghi chú Kaizen */}
        <div className={`border rounded-2xl p-4 transition-colors ${!isPass && kaizenNote.trim().length < 5 ? 'bg-red-50 border-red-300' : 'bg-orange-50 border-orange-200'}`}>
          <label className={`flex items-center gap-2 text-xs font-black uppercase mb-2 ${!isPass && kaizenNote.trim().length < 5 ? 'text-red-700' : 'text-orange-800'}`}>
            <AlertTriangle size={14} /> Ghi chú Cải tiến (Kaizen) {!isPass && <span className="text-red-500">* (Bắt buộc)</span>}
          </label>
          <textarea
            value={kaizenNote} onChange={(e) => setKaizenNote(e.target.value)}
            placeholder={isPass ? "Nhận xét thêm (Không bắt buộc)..." : "Ghi rõ lỗi để Editor/Content sửa (Ít nhất 5 ký tự)..."}
            className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-700"
            rows={3}
          />
        </div>
      </div>

      {/* Nút Action */}
      <div className="p-4 md:p-6 bg-white border-t border-slate-200 shrink-0 flex gap-3">
         <button onClick={onCancel} className="px-4 py-4 rounded-2xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-all">
            Hủy
         </button>
         <button
          onClick={handleSubmit} disabled={isSubmitDisabled}
          className={`flex-1 font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl text-white text-base 
            ${isSubmitDisabled ? 'bg-slate-300 shadow-none text-slate-500 cursor-not-allowed' : 
              (isPass ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30' : 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/30')}`}
        >
          {isEvaluating ? <Loader2 className="animate-spin" size={18} /> : (
            // Thay đổi Text một chút cho mượt nếu đã từng chấm
            task?.evaluation ? (isPass ? <>Cập Nhật Điểm (Pass) <CheckCircle2 size={18}/></> : <>Cập Nhật Lỗi (Làm Lại) <ArrowRight size={18}/></>)
            : (isPass ? <>Duyệt Video (Pass) <CheckCircle2 size={18}/></> : <>Yêu Cầu Làm Lại <ArrowRight size={18}/></>)
          )}
        </button>
      </div>
    </div>
  );
}