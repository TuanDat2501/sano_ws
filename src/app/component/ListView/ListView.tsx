"use client";

interface ListViewProps {
  filteredTasks: any[];
  columns: any;
  onOpenTaskDetail: (task: any) => void;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

// 🚀 HELPER BỔ SUNG: Render một nhóm Avatar dạng xếp chồng (Stacked) cực gọn
const renderStackedAvatars = (roleTitle: string, mainUser: any, coUsers: any[], colorClass: string, bgClass: string) => {
  // Gộp chính và phụ thành 1 mảng
  const allUsers = [...(mainUser ? [mainUser] : []), ...(coUsers || [])];
  if (allUsers.length === 0) return null;

  // Chỉ hiển thị tối đa 3 avatar, còn lại hiện +N
  const maxVisible = 3;
  const visibleUsers = allUsers.slice(0, maxVisible);
  const hiddenCount = allUsers.length - maxVisible;

  return (
      <div className="relative group cursor-pointer flex items-center mr-2 lg:mr-3" title={`${roleTitle}: ${allUsers.map(u => u.fullName).join(', ')}`}>
          <div className="flex -space-x-2">
              {visibleUsers.map((u, idx) => (
                  // Dùng style inline cho zIndex để tránh lỗi biên dịch của Tailwind
                  <div key={idx} className="relative" style={{ zIndex: 10 - idx }}>
                      {u.avatarUrl ? (
                          <img 
                              src={u.avatarUrl} 
                              alt={u.fullName} 
                              className={`h-6 w-6 md:h-8 md:w-8 rounded-full object-cover border-2 border-white shadow-md ${bgClass} ${colorClass}`} 
                          />
                      ) : (
                          <div className={`h-6 w-6 md:h-8 md:w-8 rounded-full flex items-center justify-center font-black text-[10px] md:text-xs border-2 border-white shadow-md ${bgClass} ${colorClass}`}>
                              {u.fullName?.charAt(0) || "?"}
                          </div>
                      )}
                  </div>
              ))}
              
              {/* Nút cộng số lượng người bị ẩn */}
              {hiddenCount > 0 && (
                  <div className="h-6 w-6 md:h-8 md:w-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[9px] md:text-[10px] border-2 border-white shadow-md z-[1]">
                      +{hiddenCount}
                  </div>
              )}
          </div>
          
          {/* Chữ Mác của Team (C, E, A) nằm đè nhẹ lên Avatar cuối cùng */}
          <div className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 md:h-4 md:w-4 rounded-full border-2 border-white flex items-center justify-center text-[7px] md:text-[8px] font-black text-white shadow-sm z-20 ${colorClass.replace('text-', 'bg-')}`}>
             {roleTitle.charAt(0)}
          </div>
      </div>
  );
};

export default function ListView({ filteredTasks, columns, onOpenTaskDetail, currentPage, setCurrentPage, totalPages, totalItems, itemsPerPage }: ListViewProps) {
  return (
    <div className="bg-white rounded-xl md:rounded-[24px] border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col animate-fade-in">
      
      {/* KHU VỰC BẢNG (CUỘN ĐƯỢC NHỜ flex-1 min-h-0 overflow-y-auto) */}
      <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0 custom-scrollbar">
        {/* min-w-[700px] bắt buộc bảng phải đủ rộng, không bị ép chữ */}
        <table className="w-full text-left text-xs md:text-sm text-slate-600 min-w-[700px] md:min-w-full">
          <thead className="bg-slate-50 text-[10px] md:text-xs uppercase font-black text-slate-500 sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <tr>
              <th className="px-4 md:px-6 py-3 md:py-4">Tên Task</th>
              <th className="px-4 md:px-6 py-3 md:py-4">Trạng thái</th>
              <th className="px-4 md:px-6 py-3 md:py-4">Team</th>
              <th className="px-4 md:px-6 py-3 md:py-4">Nhân sự (C / E / A)</th>
              <th className="px-4 md:px-6 py-3 md:py-4 text-center">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTasks.length === 0 ? (
              <tr><td colSpan={5} className="p-6 md:p-8 text-center text-slate-400 font-medium">Không tìm thấy task nào.</td></tr>
            ) : (
              filteredTasks.map((task) => (
                <tr key={task.id} className={`transition-colors ${task.isClosed ? 'bg-slate-50 opacity-60' : 'hover:bg-slate-50/50'}`}>
                  <td className="px-4 md:px-6 py-3 md:py-4 max-w-[200px] md:max-w-xs truncate" title={task.title}>
                    <span className={`font-bold ${task.isClosed ? 'line-through text-slate-400' : 'text-slate-900'}`}>{task.title}</span>
                    <a href={task.linkContent} target="_blank" rel="noreferrer" className={`block text-[10px] md:text-[11px] font-medium mt-0.5 md:mt-1 truncate ${task.isClosed ? 'text-slate-400 pointer-events-none' : 'text-blue-500 hover:underline'}`}>{task.linkContent}</a>
                  </td>
                  <td className={`px-4 md:px-6 py-3 md:py-4 ${task.isClosed ? 'grayscale' : ''}`}>
                    <span className={`px-2 md:px-3 py-1 rounded-md md:rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-widest ${columns[task.status]?.iconBg} ${columns[task.status]?.color}`}>
                      {columns[task.status]?.title}
                    </span>
                  </td>
                  <td className={`px-4 md:px-6 py-3 md:py-4 font-bold text-[11px] md:text-xs ${task.isClosed ? 'text-slate-400' : 'text-slate-700'}`}>{task.team?.name || 'Sano'}</td>
                  
                  {/* 🚀 ĐÃ SỬA: Thay thế đoạn hiển thị tĩnh bằng hàm renderStackedAvatars */}
                  <td className={`px-4 md:px-6 py-3 md:py-4 ${task.isClosed ? 'grayscale opacity-70' : ''}`}>
                    <div className="flex flex-wrap items-center gap-2">
                        {renderStackedAvatars("Content", task.contentUser, task.coContentUsers, "text-orange-600", "bg-orange-100")}
                        {renderStackedAvatars("Editor", task.editorUser, task.coEditorUsers, "text-blue-600", "bg-blue-100")}
                        {renderStackedAvatars("Animator", task.animatorUser, task.coAnimatorUsers, "text-purple-600", "bg-purple-100")}
                    </div>
                  </td>

                  <td className="px-4 md:px-6 py-3 md:py-4 text-center">
                    <button onClick={() => onOpenTaskDetail(task)} className="text-[11px] md:text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2.5 md:px-3 py-1.5 md:py-1.5 rounded-lg transition-colors active:scale-95">Chi tiết & Log</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* PHÂN TRANG (CỐ ĐỊNH Ở ĐÁY) */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between px-4 md:px-6 py-3 md:py-4 bg-white border-t border-slate-100 shrink-0 gap-3 md:gap-0">
          <span className="text-xs md:text-sm text-slate-500 font-medium text-center sm:text-left">
            Hiển thị <span className="font-bold text-slate-700">{totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</span> - <span className="font-bold text-slate-700">{Math.min(currentPage * itemsPerPage, totalItems)}</span> / <span className="font-bold text-slate-700">{totalItems}</span> task
          </span>
          <div className="flex flex-wrap justify-center gap-1.5 md:gap-1.5">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="px-2.5 md:px-3 py-1.5 rounded-md md:rounded-lg text-xs md:text-sm font-bold bg-slate-50 text-slate-600 disabled:opacity-50 hover:bg-slate-100 active:scale-95">Trước</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button key={page} onClick={() => setCurrentPage(page)} className={`px-3 md:px-3.5 py-1.5 rounded-md md:rounded-lg text-xs md:text-sm font-bold active:scale-95 ${currentPage === page ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>{page}</button>
            ))}
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="px-2.5 md:px-3 py-1.5 rounded-md md:rounded-lg text-xs md:text-sm font-bold bg-slate-50 text-slate-600 disabled:opacity-50 hover:bg-slate-100 active:scale-95">Sau</button>
          </div>
        </div>
      )}
    </div>
  );
}