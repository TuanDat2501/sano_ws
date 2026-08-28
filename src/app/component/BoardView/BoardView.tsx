"use client";

import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Link as LinkIcon, RefreshCw } from "lucide-react";

interface BoardViewProps {
  tasks: any;
  columns: any;
  getTeamColor: (teamId?: string) => any;
  onDragEnd: (result: any) => void;
  onOpenTaskDetail: (task: any) => void;
  userRole: string;
  currentUserId: string;
  channelMemberships?: any[]; // 🚀 THÊM PROP NÀY ĐỂ NHẬN DATA TỪ TRANG CHA
}

export default function BoardView({ tasks, columns, getTeamColor, onDragEnd, onOpenTaskDetail, userRole, currentUserId, channelMemberships = [] }: BoardViewProps) {

  // Kiểm tra quyền quản lý cấp cao (Global Manager) - có quyền kéo thả mọi task
  const isGlobalManager = ["ADMIN", "BAN_GIAM_DOC"].includes(userRole);

  const renderStackedAvatars = (roleTitle: string, mainUser: any, coUsers: any[], colorClass: string, bgClass: string) => {
    const allUsers = [...(mainUser ? [mainUser] : []), ...(coUsers || [])];
    if (allUsers.length === 0) return null;

    const maxVisible = 4;
    const visibleUsers = allUsers.slice(0, maxVisible);
    const hiddenCount = allUsers.length - maxVisible;

    return (
        <div className="relative group cursor-pointer flex items-center" title={`${roleTitle}: ${allUsers.map(u => u.fullName).join(', ')}`}>
            <div className="flex -space-x-2 mr-1">
                {visibleUsers.map((u, idx) => (
                    <div key={idx} className={`relative z-[${10 - idx}]`}>
                        {u.avatarUrl ? (
                            <img 
                                src={u.avatarUrl} 
                                alt={u.fullName} 
                                className={`h-6 w-6 md:h-8 md:w-8 rounded-full object-cover border-2 border-white shadow-md ${bgClass} text-${colorClass}`} 
                            />
                        ) : (
                            <div className={`h-6 w-6 md:h-8 md:w-8 rounded-full flex items-center justify-center font-black text-[10px] md:text-xs border-2 border-white shadow-md ${bgClass} ${colorClass}`}>
                                {u.fullName?.charAt(0) || "?"}
                            </div>
                        )}
                    </div>
                ))}
                
                {hiddenCount > 0 && (
                    <div className="h-6 w-6 md:h-8 md:w-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[9px] md:text-[10px] border-2 border-white shadow-md z-[1]">
                        +{hiddenCount}
                    </div>
                )}
            </div>
            
            <div className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 md:h-4 md:w-4 rounded-full border-2 border-white flex items-center justify-center text-[7px] md:text-[9px] font-black text-white shadow-sm z-20 ${colorClass.replace('text-', 'bg-')}`}>
               {roleTitle.charAt(0)}
            </div>
        </div>
    );
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-4 md:gap-6 h-full min-w-max items-start">
        {Object.values(columns).map((column: any) => (
          <div key={column.id} className={`w-[280px] md:w-80 flex flex-col h-full ${column.columnBg} rounded-2xl md:rounded-[32px] border ${column.borderColor} shadow-sm shrink-0`}>

            <div className={`p-3 md:p-5 flex items-center justify-between bg-white/40 backdrop-blur-sm border-b ${column.borderColor} shrink-0`}>
              <div className="flex items-center gap-1.5 md:gap-2">
                <span className={`${column.iconBg} ${column.color} p-1 md:p-1.5 rounded-lg md:rounded-xl scale-90 md:scale-100`}>{column.icon}</span>
                <h3 className="font-bold text-sm md:text-base text-slate-800">{column.title}</h3>
              </div>
              <span className={`bg-white ${column.color} shadow-sm font-black px-2 md:px-2.5 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs border ${column.borderColor}`}>
                {tasks[column.id] ? tasks[column.id].length : 0}
              </span>
            </div>

            <Droppable droppableId={column.id}>
              {(provided, snapshot) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className={`flex-1 overflow-y-auto min-h-0 p-3 md:p-4 space-y-3 md:space-y-4 custom-scrollbar transition-colors ${snapshot.isDraggingOver ? "bg-black/5" : ""}`}
                >
                  {tasks[column.id]?.map((task: any, index: number) => {
                    // Xác định nhân sự được gán vào Task
                    const isMyContent = task.contentId === currentUserId || task.creatorId === currentUserId || task.coContentUsers?.some((u:any) => u.id === currentUserId);
                    const isMyAnimation = task.animatorId === currentUserId || task.coAnimatorUsers?.some((u:any) => u.id === currentUserId);
                    const isMyEdit = task.editorId === currentUserId || task.coEditorUsers?.some((u:any) => u.id === currentUserId);
                    
                    // 🚀 LOGIC QUYỀN KÉO THẢ LINH HOẠT THEO KÊNH
                    let effectiveRole = userRole;
                    if (task.channelId && channelMemberships.length > 0) {
                        const channelRoleObj = channelMemberships.find((cm: any) => cm.channelId === task.channelId);
                        if (channelRoleObj) {
                            effectiveRole = channelRoleObj.roleOnChannel;
                        }
                    }

                    // Nếu bạn là Quản lý kênh đó, hoặc là Leader/Admin toàn cục
                    const hasManagerRights = isGlobalManager || ["LEADER", "PUBLISHER", "CHANNEL_MANAGER"].includes(effectiveRole);

                    // 🚀 CẬP NHẬT: Cho phép kéo thẻ nếu là Manager (Toàn cục hoặc Kênh), HOẶC là người thực thi đúng trạm
                    const isDragDisabled =
                      !hasManagerRights &&
                      !(isMyContent && task.status === "TODO") &&
                      !(isMyAnimation && task.status === "ANIMATION_DOING") &&
                      !(isMyEdit && task.status === "EDIT_DOING");

                    return (
                      <Draggable
                        key={task.id}
                        draggableId={task.id}
                        index={index}
                        isDragDisabled={isDragDisabled}
                      >
                        {(provided, snapshot) => {
                          const teamColor = getTeamColor(task.teamId);
                          return (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`p-4 md:p-5 rounded-[20px] md:rounded-[24px] border-l-[4px] md:border-l-[6px] transition-all 
                                ${snapshot.isDragging ? "shadow-2xl shadow-slate-500/20 scale-105 rotate-2 z-50 bg-white" : "shadow-sm"} 
                                ${teamColor.border} border-y-slate-100 border-r-slate-100 
                                ${isDragDisabled ? 'bg-slate-50/70 opacity-60' : 'bg-white hover:shadow-md hover:border-r-slate-300 hover:border-y-slate-300 cursor-grab'} 
                                ${task.isClosed ? 'opacity-50 grayscale hover:opacity-100' : ''}`
                              }
                              onClick={() => onOpenTaskDetail(task)}
                            >
                              <div className="flex justify-between items-start mb-2 md:mb-3 gap-2">
                                <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest px-2 py-0.5 md:px-2.5 md:py-1 rounded-md md:rounded-lg border shrink-0 ${teamColor.bg} ${teamColor.text} ${teamColor.border}`}>
                                  {task.team?.name || "Team Sano"}
                                </span>

                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                  {task.priority && task.priority !== 'NORMAL' && (
                                    <span
                                      className={`text-[8px] md:text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border shadow-sm ${
                                        task.priority === 'URGENT' ? 'bg-red-600 text-white border-red-700 animate-pulse' :
                                        task.priority === 'HIGH' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                        'bg-slate-100 text-slate-500 border-slate-200'
                                      }`}
                                    >
                                      {task.priority === 'URGENT' ? '🔥 GẤP' : task.priority === 'HIGH' ? 'ƯU TIÊN CAO' : 'THẤP'}
                                    </span>
                                  )}

                                  {task.isRework && (
                                    <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-200 shadow-sm flex items-center gap-1 animate-pulse">
                                      <RefreshCw size={10} strokeWidth={3} /> XÀO LẠI
                                    </span>
                                  )}
                                </div>
                              </div>

                              <h4 className={`font-bold text-sm md:text-base leading-snug mb-2 md:mb-3 ${task.isClosed ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                                {task.title}
                              </h4>

                              {task.linkContent && <div className={`flex items-center gap-1.5 md:gap-2 text-[11px] md:text-xs font-medium p-1.5 md:p-2 rounded-lg md:rounded-xl border mb-3 md:mb-4 truncate ${isDragDisabled ? 'bg-transparent border-transparent text-slate-400' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                <LinkIcon size={12} className="text-red-500 shrink-0 md:w-3.5 md:h-3.5" />
                                <span className="truncate">{task.linkContent}</span>
                              </div>}
                              
                              <div className="flex flex-wrap items-center gap-2 mt-3 md:mt-4 pt-2.5 md:pt-3 border-t border-slate-100/50 opacity-90">
                                {renderStackedAvatars("Content", task.contentUser, task.coContentUsers, "text-orange-600", "bg-orange-100")}
                                {renderStackedAvatars("Editor", task.editorUser, task.coEditorUsers, "text-blue-600", "bg-blue-100")}
                                {renderStackedAvatars("Animator", task.animatorUser, task.coAnimatorUsers, "text-purple-600", "bg-purple-100")}
                                {renderStackedAvatars("Publisher", task.publisherUser, [], "text-rose-600", "bg-rose-100")}
                              </div>
                            </div>
                          );
                        }}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
    
  );
}