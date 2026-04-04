"use client";

import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Link as LinkIcon } from "lucide-react";

interface BoardViewProps {
  tasks: any;
  columns: any;
  getTeamColor: (teamId?: string) => any;
  onDragEnd: (result: any) => void;
  onOpenTaskDetail: (task: any) => void;
}

export default function BoardView({ tasks, columns, getTeamColor, onDragEnd, onOpenTaskDetail }: BoardViewProps) {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-6 h-full min-w-max items-start">
        {Object.values(columns).map((column: any) => (
          // THAY ĐỔI QUAN TRỌNG: h-full và flex-col để cột cao bằng màn hình
          <div key={column.id} className={`w-80 flex flex-col h-full ${column.columnBg} rounded-[32px] border ${column.borderColor} shadow-sm shrink-0`}>
            
            {/* Tiêu đề cột (Cố định ở trên) */}
            <div className={`p-5 flex items-center justify-between bg-white/40 backdrop-blur-sm border-b ${column.borderColor} shrink-0`}>
              <div className="flex items-center gap-2">
                <span className={`${column.iconBg} ${column.color} p-1.5 rounded-xl`}>{column.icon}</span>
                <h3 className="font-bold text-slate-800">{column.title}</h3>
              </div>
              <span className={`bg-white ${column.color} shadow-sm font-black px-2.5 py-1 rounded-full text-xs border ${column.borderColor}`}>
                {tasks[column.id] ? tasks[column.id].length : 0}
              </span>
            </div>

            {/* KHU VỰC CHỨA TASK (NƠI XẢY RA PHÉP MÀU CUỘN SCROLL) */}
            {/* flex-1 overflow-y-auto min-h-0: Giúp cột cuộn độc lập, không làm dài trang web */}
            <Droppable droppableId={column.id}>
              {(provided, snapshot) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className={`flex-1 overflow-y-auto min-h-0 p-4 space-y-4 custom-scrollbar transition-colors ${snapshot.isDraggingOver ? "bg-black/5" : ""}`}
                >
                  {tasks[column.id]?.map((task: any, index: number) => (
                    <Draggable key={task.id} draggableId={task.id} index={index}>
                      {(provided, snapshot) => {
                        const teamColor = getTeamColor(task.teamId);
                        return (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`bg-white p-5 rounded-[24px] border-l-[6px] cursor-pointer transition-all ${
                              snapshot.isDragging ? "shadow-2xl shadow-slate-500/20 scale-105 rotate-2 z-50" : "shadow-sm hover:shadow-md"
                            } ${teamColor.border} border-y-slate-100 border-r-slate-100 hover:border-r-slate-300 hover:border-y-slate-300 ${task.isClosed ? 'opacity-50 grayscale hover:opacity-100' : ''}`}
                            onClick={() => onOpenTaskDetail(task)}
                          >
                            <div className="flex justify-between items-start mb-3">
                              <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${teamColor.bg} ${teamColor.text} ${teamColor.border}`}>
                                {task.team?.name || "Team Sano"}
                              </span>
                            </div>
                            
                            <h4 className={`font-bold leading-snug mb-3 ${task.isClosed ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                              {task.title}
                            </h4>

                            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-50 p-2 rounded-xl border border-slate-100 mb-4 truncate">
                              <LinkIcon size={14} className="text-red-500 shrink-0" />
                              <span className="truncate">{task.linkContent}</span>
                            </div>

                            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                              {/* Avatar Content */}
                              <div className="relative" title={`Content: ${task.contentUser?.fullName || "Chưa phân công"}`}>
                                <div className="h-8 w-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-black text-xs shrink-0 border-2 border-white shadow-md">
                                  {task.contentUser ? task.contentUser.fullName.charAt(0) : "?"}
                                </div>
                                <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 bg-orange-500 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-black text-white shadow-sm">C</div>
                              </div>

                              {/* Avatar Editor */}
                              <div className="relative ml-1" title={`Editor: ${task.editorUser?.fullName || "Chưa phân công"}`}>
                                <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black text-xs shrink-0 border-2 border-white shadow-md">
                                  {task.editorUser ? task.editorUser.fullName.charAt(0) : "?"}
                                </div>
                                <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-black text-white shadow-sm">E</div>
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    </Draggable>
                  ))}
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