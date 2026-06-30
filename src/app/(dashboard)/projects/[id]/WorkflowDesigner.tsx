"use client";

import { useState, useCallback, useMemo, useEffect, forwardRef, useImperativeHandle } from 'react';
import ReactFlow, { 
    Background, Controls, ConnectionMode, ReactFlowProvider, addEdge,
    MarkerType, applyNodeChanges, applyEdgeChanges 
} from 'reactflow';
import 'reactflow/dist/style.css';
import SanoNode from './SanoNode';
import SanoEdge from './SanoEdge';
import { Square, ArrowUpRight, Trash2 } from 'lucide-react';

interface WorkflowDesignerProps {
    projectId: string;
    initialNodes: any[]; // 🚀 Nhận data đã parse từ page.tsx
    initialEdges: any[]; // 🚀 Nhận data đã parse từ page.tsx
}

const DesignerCanvas = forwardRef(({ initialNodes, initialEdges }: WorkflowDesignerProps, ref) => {
    // 🚀 Khởi tạo state bằng dữ liệu được truyền từ page xuống
    const [nodes, setNodes] = useState<any[]>(initialNodes || []);
    const [edges, setEdges] = useState<any[]>(initialEdges || []);

    // Cập nhật lại state nếu data từ props thay đổi (ví dụ khi load project mới)
    useEffect(() => {
        setNodes(initialNodes || []);
        setEdges(initialEdges || []);
    }, [initialNodes, initialEdges]);

    // Bộc lộ dữ liệu ra ngoài để nút "Lưu" ở Header của page.tsx có thể lấy được
    useImperativeHandle(ref, () => ({
        getFlowData: () => ({ nodes, edges })
    }));

    const nodeTypes = useMemo(() => ({ sano: SanoNode }), []);
    const edgeTypes = useMemo(() => ({ sanoEdge: SanoEdge }), []);

    // --- LOGIC TƯƠNG TÁC ---
    const onConnect = useCallback((params: any) => {
        setEdges((eds) => addEdge({ 
            ...params, type: 'sanoEdge', animated: false,
            style: { strokeWidth: 2, stroke: '#64748b' },
            markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: '#64748b' },
            data: { label: '' }
        }, eds));
    }, []);

    const onAddNode = () => {
        const id = `node_${Date.now()}`;
        const newNode = {
            id, type: 'sano', position: { x: 100, y: 100 },
            data: { 
                label: 'Bước mới...', color: 'bg-orange-500', criteria: [],
                onChangeLabel: (val: string) => setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, label: val } } : n)),
                onChangeColor: (val: string) => setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, color: val } } : n)),
            },
        };
        setNodes((nds) => nds.concat(newNode));
    };

    const deleteSelected = useCallback(() => {
        setNodes((nds) => nds.filter((node) => !node.selected));
        setEdges((eds) => eds.filter((edge) => !edge.selected));
    }, []);

    // Lắng nghe phím Delete/Backspace để xóa nhanh
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [deleteSelected]);

    return (
        <div className="flex flex-1 w-full h-full min-h-0 gap-4 md:gap-6 relative">
            {/* TOOLBAR BÊN TRÁI */}
            <div className="w-20 bg-white border border-slate-200 rounded-[32px] p-3 shadow-xl flex flex-col items-center gap-6 shrink-0 z-10">
                <div className="flex flex-col gap-4 w-full">
                    <button onClick={onAddNode} className="p-3 w-full flex justify-center bg-slate-100 hover:bg-orange-500 hover:text-white rounded-2xl transition-all active:scale-95 text-slate-600">
                        <Square size={24} />
                    </button>
                    <button className="p-3 w-full flex justify-center bg-slate-900 text-white rounded-2xl shadow-lg cursor-default">
                        <ArrowUpRight size={24} />
                    </button>
                </div>
                <div className="w-full pt-4 border-t border-slate-100">
                    <button onClick={deleteSelected} className="p-3 w-full flex justify-center bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-2xl transition-all active:scale-95">
                        <Trash2 size={24} />
                    </button>
                </div>
            </div>

            {/* BẢNG VẼ CHÍNH */}
            <div className="flex-1 bg-white border-2 border-slate-100 rounded-[40px] overflow-hidden relative shadow-inner">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={(c) => setNodes((nds) => applyNodeChanges(c, nds))}
                    onEdgesChange={(c) => setEdges((eds) => applyEdgeChanges(c, eds))}
                    onConnect={onConnect}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    connectionMode={ConnectionMode.Loose}
                    deleteKeyCode={null}
                    fitView
                >
                    <Background gap={20} color="#e2e8f0" />
                    <Controls className="bg-white border-slate-200 shadow-lg rounded-xl overflow-hidden mb-4 ml-4" />
                </ReactFlow>
            </div>
        </div>
    );
});

DesignerCanvas.displayName = "DesignerCanvas";
// Wrapper bọc Provider để React Flow hoạt động
const WorkflowDesigner = forwardRef((props: any, ref) => {
    return (
        <ReactFlowProvider>
            <DesignerCanvas {...props} ref={ref} />
        </ReactFlowProvider>
    );
});

WorkflowDesigner.displayName = "WorkflowDesigner";
export default WorkflowDesigner;