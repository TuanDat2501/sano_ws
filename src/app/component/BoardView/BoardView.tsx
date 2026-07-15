"use client";

import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Link as LinkIcon } from "lucide-react";

interface BoardViewProps {
  tasks: any;
  columns: any;
  getTeamColor: (teamId?: string) => any;
  onDragEnd: (result: any) => void;
  onOpenTaskDetail: (task: any) => void;
  userRole: string;
}

export default function BoardView({ tasks, columns, getTeamColor, onDragEnd, onOpenTaskDetail, userRole }: BoardViewProps) {

  const isManager = ["ADMIN", "BAN_GIAM_DOC", "LEADER"].includes(userRole);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      {/* Giảm gap trên mobile để các cột gần nhau hơn */}
      <div className="flex gap-4 md:gap-6 h-full min-w-max items-start">
        {Object.values(columns).map((column: any) => (
          // Bóp width của cột từ 320px (w-80) xuống 280px trên mobile để lộ một phần cột bên cạnh
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
                    const isDragDisabled =
                      !isManager &&
                      !(userRole === "CONTENT" && task.status === "TODO") &&
                      !(userRole === "EDITOR" && task.status === "DOING") &&
                      !(userRole === "CHANNEL_MANAGER" && task.status === "REVIEW");

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
                              // Giảm padding card trên mobile (p-4 thay vì p-5)
                              className={`p-4 md:p-5 rounded-[20px] md:rounded-[24px] border-l-[4px] md:border-l-[6px] transition-all 
                                ${snapshot.isDragging ? "shadow-2xl shadow-slate-500/20 scale-105 rotate-2 z-50 bg-white" : "shadow-sm"} 
                                ${teamColor.border} border-y-slate-100 border-r-slate-100 
                                ${isDragDisabled ? 'bg-slate-50/70 opacity-60' : 'bg-white hover:shadow-md hover:border-r-slate-300 hover:border-y-slate-300 cursor-grab'} 
                                ${task.isClosed ? 'opacity-50 grayscale hover:opacity-100' : ''}`
                              }
                              onClick={() => onOpenTaskDetail(task)}
                            >
                              <div className="flex justify-between items-start mb-2 md:mb-3">
                                <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest px-2 py-0.5 md:px-2.5 md:py-1 rounded-md md:rounded-lg border ${teamColor.bg} ${teamColor.text} ${teamColor.border}`}>
                                  {task.team?.name || "Team Sano"}
                                </span>
                              </div>

                              <h4 className={`font-bold text-sm md:text-base leading-snug mb-2 md:mb-3 ${task.isClosed ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                                {task.title}
                              </h4>

                              <div className={`flex items-center gap-1.5 md:gap-2 text-[11px] md:text-xs font-medium p-1.5 md:p-2 rounded-lg md:rounded-xl border mb-3 md:mb-4 truncate ${isDragDisabled ? 'bg-transparent border-transparent text-slate-400' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                <LinkIcon size={12} className="text-red-500 shrink-0 md:w-3.5 md:h-3.5" />
                                <span className="truncate">{task.linkContent}</span>
                              </div>

                              <div className="flex items-center gap-1.5 md:gap-2 mt-3 md:mt-4 pt-2.5 md:pt-3 border-t border-slate-100/50">
                                {/* Avatar Content */}
                                {task.contentUser &&
                                  <div className="relative" title={`Content: ${task.contentUser?.fullName || "Chưa phân công"}`}>
                                  <div className={`h-6 w-6 md:h-8 md:w-8 rounded-full flex items-center justify-center font-black text-[10px] md:text-xs shrink-0 border border-white shadow-md ${isDragDisabled ? 'bg-slate-200 text-slate-400' : 'bg-orange-100 text-orange-600'}`}>
                                    {task.contentUser ? task.contentUser.fullName.charAt(0) : "?"}
                                  </div>
                                  <div className={`absolute -bottom-0.5 -right-0.5 md:-bottom-1 md:-right-1 h-3 w-3 md:h-3.5 md:w-3.5 rounded-full border md:border-2 border-white flex items-center justify-center text-[6px] md:text-[8px] font-black text-white shadow-sm ${isDragDisabled ? 'bg-slate-400' : 'bg-orange-500'}`}>C</div>
                                </div>
                                }
                                

                                {/* Avatar Editor */}
                                {task.editorUser &&
                                  <div className="relative ml-0.5 md:ml-1" title={`Editor: ${task.editorUser?.fullName || "Chưa phân công"}`}>
                                  <div className={`h-6 w-6 md:h-8 md:w-8 rounded-full flex items-center justify-center font-black text-[10px] md:text-xs shrink-0 border border-white shadow-md ${isDragDisabled ? 'bg-slate-200 text-slate-400' : 'bg-blue-100 text-blue-600'}`}>
                                    {task.editorUser ? task.editorUser.fullName.charAt(0) : "?"}
                                  </div>
                                  <div className={`absolute -bottom-0.5 -right-0.5 md:-bottom-1 md:-right-1 h-3 w-3 md:h-3.5 md:w-3.5 rounded-full border md:border-2 border-white flex items-center justify-center text-[6px] md:text-[8px] font-black text-white shadow-sm ${isDragDisabled ? 'bg-slate-400' : 'bg-blue-500'}`}>E</div>
                                </div>
                                }
                                

                                {task.animatorUser &&
                                  <div className="relative ml-0.5 md:ml-1" title={`Chuyển động: ${task.animatorUser?.fullName || "Chưa phân công"}`}>
                                    <div className={`h-6 w-6 md:h-8 md:w-8 rounded-full flex items-center justify-center font-black text-[10px] md:text-xs shrink-0 border border-white shadow-md ${isDragDisabled ? 'bg-slate-200 text-slate-400' : 'bg-blue-100 text-blue-600'}`}>
                                      {task.animatorUser ? task.animatorUser?.fullName.charAt(0) : "?"}
                                    </div>
                                    <div className={`absolute -bottom-0.5 -right-0.5 md:-bottom-1 md:-right-1 h-3 w-3 md:h-3.5 md:w-3.5 rounded-full border md:border-2 border-white flex items-center justify-center text-[6px] md:text-[8px] font-black text-white shadow-sm ${isDragDisabled ? 'bg-slate-400' : 'bg-blue-500'}`}>A</div>
                                  </div>
                                }

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