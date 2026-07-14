"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { 
  ReactFlow, MiniMap, Controls, Background, useNodesState, useEdgesState, addEdge, 
  Connection, ReactFlowProvider, useReactFlow, BackgroundVariant, Node, Edge,
  ConnectionMode, MarkerType 
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Save, ArrowLeft } from 'lucide-react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useToast } from "@/app/component/ToastProvider";
import { nodeTypes, edgeTypes } from '../FlowNodes';
import Sidebar from '../Sidebar';

// Khởi tạo 1 khối ban đầu (Chỉ dùng khi dự án chưa có data)
const initialNodes: Node[] = [
  { id: 'start', type: 'circle', data: { label: 'Bắt Đầu' }, position: { x: 250, y: 50 } },
];

// ==========================================
// 1. COMPONENT BÀN VẼ (Nhận state từ cha truyền xuống)
// ==========================================
function FlowCanvas({ nodes, edges, onNodesChange, onEdgesChange, setNodes, setEdges }: any) {
  const { screenToFlowPosition } = useReactFlow();
  
  const onConnect = useCallback((params: Connection) => setEdges((eds: Edge[]) => addEdge({ 
    ...params, 
    type: 'editable', 
    data: { label: '' }, 
    animated: true, 
    style: { stroke: '#3b82f6', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15, color: '#3b82f6' }
  }, eds)), [setEdges]);

  const onDragOver = useCallback((event: any) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event: any) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      const label = event.dataTransfer.getData('application/label');
      if (typeof type === 'undefined' || !type) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const newNode = {
        id: `node_${Date.now()}`,
        type,
        position,
        data: { label: `${label}` },
      };
      setNodes((nds: Node[]) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes],
  );

  return (
    <div className="flex flex-1 h-full relative">
      <Sidebar />
      <div className="flex-1 h-full bg-slate-50 relative" onDragOver={onDragOver} onDrop={onDrop}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes} 
          edgeTypes={edgeTypes} 
          connectionMode={ConnectionMode.Loose} 
          deleteKeyCode={['Backspace', 'Delete']} 
          fitView
        >
          <Background color="#e8e8eb" gap={10} size={1} variant={BackgroundVariant.Lines}/>
          <Controls />
          <MiniMap zoomable pannable nodeStrokeColor="#3b82f6" />
        </ReactFlow>
      </div>
    </div>
  );
}

// ==========================================
// 2. TRANG GIAO DIỆN CHÍNH (Quản lý State & Gọi API)
// ==========================================
export default function ProjectWorkflowPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams(); 
  const { showToast } = useToast();
  const projectId = params.projectId as string;
  const passedProjectName = searchParams.get('name') || "Đang tải...";

  const [projectName, setProjectName] = useState(passedProjectName);
  const [isSaving, setIsSaving] = useState(false);

  // 🚀 QUẢN LÝ STATE TẠI ĐÂY ĐỂ LÚC LƯU CÒN LẤY ĐƯỢC DỮ LIỆU
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // 🚀 GỌI API ĐỂ LẤY DATA CŨ KHI VỪA VÀO TRANG
  useEffect(() => {
    if (passedProjectName) setProjectName(passedProjectName);

    const loadWorkflowData = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/workflow`);
        if (res.ok) {
          const data = await res.json();
          // Nếu có data thì load, không thì load khối "Bắt đầu" mặc định
          setNodes(data.workflowNodes?.length > 0 ? data.workflowNodes : initialNodes);
          setEdges(data.workflowEdges?.length > 0 ? data.workflowEdges : []);
        }
      } catch (error) {
        showToast("error", "Không thể tải quy trình cũ!");
      }
    };
    loadWorkflowData();
  }, [projectId, passedProjectName, setNodes, setEdges, showToast]);

  // 🚀 GỌI API PATCH ĐỂ LƯU DATA
  const handleSaveWorkflow = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/workflow`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes, edges }), // Gửi toàn bộ bàn vẽ lên server
      });

      if (!res.ok) throw new Error("Lỗi khi lưu");
      showToast("success", "Đã lưu quy trình thành công!");
    } catch (error) {
      showToast("error", "Lỗi lưu quy trình!");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-screen h-screen bg-slate-50 flex flex-col overflow-hidden">
      {/* HEADER TOOLBAR */}
      <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
          <div>
            <h1 className="text-sm font-black text-slate-400 uppercase tracking-tighter">Thiết lập quy trình</h1>
            <p className="text-base font-bold text-slate-900">{projectName}</p>
          </div>
        </div>

        <button 
          onClick={handleSaveWorkflow} 
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-bold flex items-center gap-2 shadow-md shadow-blue-500/30 transition-all active:scale-95 disabled:opacity-50"
        >
          {isSaving ? "Đang lưu..." : <><Save size={18} /> Lưu Quy Trình</>}
        </button>
      </div>

      <ReactFlowProvider>
        <FlowCanvas 
            nodes={nodes} edges={edges} 
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} 
            setNodes={setNodes} setEdges={setEdges}
        />
      </ReactFlowProvider>
    </div>
  );
}