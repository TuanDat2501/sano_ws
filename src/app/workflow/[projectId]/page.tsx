"use client";

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { 
  ReactFlow, MiniMap, Controls, Background, useNodesState, useEdgesState, addEdge, 
  Connection, ReactFlowProvider, useReactFlow ,BackgroundVariant,Node, Edge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Save, ArrowLeft } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { useToast } from "@/app/component/ToastProvider";
import { nodeTypes } from '../FlowNodes';
import Sidebar from '../Sidebar';

// Import Sidebar và Custom Nodes vừa tạo


// Khởi tạo 1 khối ban đầu
const initialNodes = [
  { id: 'start', type: 'circle', data: { label: 'Bắt Đầu' }, position: { x: 250, y: 50 } },
];

// 🚀 TÁCH RIÊNG COMPONENT BÀN VẼ ĐỂ SỬ DỤNG ĐƯỢC HOOK useReactFlow()
function FlowCanvas({ projectId, projectName, isSaving, handleSaveWorkflow }: any) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { screenToFlowPosition } = useReactFlow(); // Tính tọa độ màn hình sang tọa độ Canvas
  
  // Logic nối dây
  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } }, eds)), [setEdges]);

  // Logic kéo thả: Cho phép thẻ div nhận item drop
  const onDragOver = useCallback((event: any) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Logic kéo thả: Bắt item khi thả chuột ra
  const onDrop = useCallback(
    (event: any) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      const label = event.dataTransfer.getData('application/label');

      // Nếu thả bậy bạ thì bỏ qua
      if (typeof type === 'undefined' || !type) return;

      // Tính toán vị trí chuột để đặt khối xuống chính xác
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: `node_${Date.now()}`,
        type,
        position,
        data: { label: `${label}` },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes],
  );

  return (
    <div className="flex flex-1 h-full relative">
      {/* THANH CÔNG CỤ BÊN TRÁI */}
      <Sidebar />

      {/* BÀN VẼ Ở GIỮA */}
      <div className="flex-1 h-full bg-slate-50 relative" onDragOver={onDragOver} onDrop={onDrop}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes} // Nhúng thư viện hình dáng vào đây
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
// TRANG GIAO DIỆN CHÍNH (BỌC PROVIDER)
// ==========================================
export default function ProjectWorkflowPage() {
  const router = useRouter();
  const params = useParams();
  const { showToast } = useToast();
  const projectId = params.projectId as string;

  const [projectName, setProjectName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Gọi API load tên dự án... (Tạm thời mock ở đây, sếp ráp API thật vào nhé)
    setProjectName("Dự án Video");
  }, [projectId]);

  const handleSaveWorkflow = async () => {
    setIsSaving(true);
    // Logic gọi API save...
    setTimeout(() => {
        showToast("success", "Đã lưu quy trình!");
        setIsSaving(false);
    }, 1000);
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
            <p className="text-base font-bold text-slate-900">{projectName || "Đang tải..."}</p>
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

      {/* 🚀 BẮT BUỘC BỌC REACTFLOWPROVIDER ĐỂ DÙNG DRAG & DROP */}
      <ReactFlowProvider>
        <FlowCanvas 
            projectId={projectId} 
            projectName={projectName} 
            isSaving={isSaving} 
            handleSaveWorkflow={handleSaveWorkflow} 
        />
      </ReactFlowProvider>
    </div>
  );
}