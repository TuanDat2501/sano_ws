"use client";

import { useState, useEffect, useCallback } from "react";
import { Network, Loader2 } from "lucide-react";
import ReactFlow, { Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState } from "reactflow";
import "reactflow/dist/style.css"; // Bắt buộc phải có để React Flow hiển thị mượt
import dagre from "dagre";
import CustomNode from "./CustomNode";
import { useToast } from "@/app/component/ToastProvider";

// Đăng ký Custom Node vừa tạo
const nodeTypes = {
    custom: CustomNode,
};

// 🧠 HÀM TỰ ĐỘNG DÀN LAYOUT SƠ ĐỒ (XẾP CÂY) BẰNG DAGRE
const getLayoutedElements = (nodes: any[], edges: any[], direction = 'TB') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    
    // Kích thước ước tính của một Node để căn lề
    const nodeWidth = 200;
    const nodeHeight = 100;

    dagreGraph.setGraph({ rankdir: direction });

    nodes.forEach((node) => { dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight }); });
    edges.forEach((edge) => { dagreGraph.setEdge(edge.source, edge.target); });

    dagre.layout(dagreGraph);

    nodes.forEach((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        node.targetPosition = 'top';
        node.sourcePosition = 'bottom';
        // Tính toán lại vị trí tâm của Node
        node.position = {
            x: nodeWithPosition.x - nodeWidth / 2,
            y: nodeWithPosition.y - nodeHeight / 2,
        };
        return node;
    });

    return { nodes, edges };
};

export default function OrgChartPage() {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    
    // Các State của React Flow
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    useEffect(() => {
        Promise.all([
            fetch("/api/teams").then(res => res.ok ? res.json() : []),
            fetch("/api/departments").then(res => res.ok ? res.json() : []),
            fetch("/api/users").then(res => res.ok ? res.json() : [])
        ]).then(([teamsData, deptsData, usersData]) => {
            
            const initialNodes: any[] = [];
            const initialEdges: any[] = [];

            // 🚀 BƯỚC 1: NHẬN DIỆN BAN GIÁM ĐỐC
            // Lấy ra các user là sếp
            const bgdUsers = usersData.filter((u: any) => u.role === "BAN_GIAM_DOC");
            // Lấy ra ID của Team và Phòng Ban chứa các sếp này để lát nữa "giấu" đi khỏi sơ đồ
            const bgdTeamIds = bgdUsers.map((u: any) => u.teamId).filter(Boolean);
            const bgdDeptIds = bgdTeamIds.map((tid: string) => teamsData.find((t:any) => t.id === tid)?.departmentId).filter(Boolean);

            // 🚀 BƯỚC 2: TẠO NODE GỐC (ROOT)
            const rootId = "root_bgd";
            initialNodes.push({
                id: rootId,
                type: 'custom',
                data: { label: "Ban Giám Đốc", role: "Điều hành", borderColor: "border-red-500", textColor: "text-red-500" },
                position: { x: 0, y: 0 } 
            });

            // 🚀 BƯỚC 3: MÓC TRỰC TIẾP CÁC SẾP VÀO NODE GỐC
            bgdUsers.forEach((user: any) => {
                const userNodeId = `user_${user.id}`;
                initialNodes.push({
                    id: userNodeId,
                    type: 'custom',
                    data: { 
                        label: user.fullName, 
                        role: user.role === "ADMIN" ? "Giám Đốc" : "Phó Giám Đốc", 
                        borderColor: 'border-red-300', 
                        textColor: 'text-red-600',
                        // Cố ý không để target cho các sếp
                    },
                    position: { x: 0, y: 0 }
                });
                initialEdges.push({ id: `e_${rootId}-${userNodeId}`, source: rootId, target: userNodeId, type: 'smoothstep', animated: true });
            });

            // 🚀 BƯỚC 4: VẼ CÁC PHÒNG BAN (Bỏ qua Phòng của Ban Giám Đốc)
            deptsData.filter((d: any) => !bgdDeptIds.includes(d.id)).forEach((dept: any) => {
                const deptNodeId = `dept_${dept.id}`;
                initialNodes.push({
                    id: deptNodeId,
                    type: 'custom',
                    data: { label: dept.name, role: "Phòng Ban", borderColor: "border-slate-800", textColor: "text-slate-800" }, // Đổi màu xám đen cho giống mockup
                    position: { x: 0, y: 0 }
                });
                initialEdges.push({ id: `e_${rootId}-${deptNodeId}`, source: rootId, target: deptNodeId, type: 'smoothstep' });
            });

            // 🚀 BƯỚC 5: VẼ CÁC TEAM (Bỏ qua Team của Ban Giám Đốc)
            teamsData.filter((t: any) => !bgdTeamIds.includes(t.id)).forEach((team: any) => {
                const teamNodeId = `team_${team.id}`;
                const parentId = team.departmentId && !bgdDeptIds.includes(team.departmentId) 
                                 ? `dept_${team.departmentId}` 
                                 : rootId; // Nếu không có phòng ban thì móc thẳng lên Root
                
                initialNodes.push({
                    id: teamNodeId,
                    type: 'custom',
                    data: { label: team.name, role: "Team", borderColor: "border-slate-800", textColor: "text-red-500" },
                    position: { x: 0, y: 0 }
                });
                initialEdges.push({ id: `e_${parentId}-${teamNodeId}`, source: parentId, target: teamNodeId, type: 'smoothstep' });
            });

            // 🚀 BƯỚC 6: VẼ NHÂN SỰ BÊN DƯỚI (Trừ các sếp đã vẽ ở bước 3)
            usersData.filter((u: any) => u.role !== "BAN_GIAM_DOC" && u.role !== "ADMIN").forEach((user: any) => {
                const userNodeId = `user_${user.id}`;
                const parentId = user.teamId && !bgdTeamIds.includes(user.teamId) ? `team_${user.teamId}` : rootId;
                                 
                // 🚀 Lấy số liệu từ cục stats mới ở Backend
                const actual = user.currentWeekStats?.actual || 0;
                const target = user.currentWeekStats?.target || 0;

                initialNodes.push({
                    id: userNodeId,
                    type: 'custom',
                    data: { 
                        label: user.fullName, 
                        role: user.role, 
                        // Hiển thị dạng: Thực tế / Chỉ tiêu
                        target: `${actual} / ${target} bài`, 
                        borderColor: user.role === 'LEADER' ? 'border-blue-300' : 'border-slate-800', 
                        textColor: user.role === 'LEADER' ? 'text-blue-600' : 'text-slate-800' 
                    },
                    position: { x: 0, y: 0 }
                });
                initialEdges.push({ id: `e_${parentId}-${userNodeId}`, source: parentId, target: userNodeId, type: 'smoothstep' });
            });

            // GỌI DAGRE TÍNH TOẠ ĐỘ
            const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(initialNodes, initialEdges);
            
            setNodes(layoutedNodes);
            setEdges(layoutedEdges);
            setLoading(false);

        }).catch(() => {
            showToast("error", "Lỗi tải dữ liệu Sơ đồ");
            setLoading(false);
        });
    }, []);

    // Sự kiện nối dây bằng tay (Dành cho sau này sếp muốn tự kéo nối)
    const onConnect = useCallback((params: any) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

    return (
        <div className="h-full flex flex-col p-4 md:p-8 animate-fade-in bg-slate-50 relative overflow-hidden">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 mb-6 z-10 relative">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <Network className="text-red-600" size={32} />
                        Sơ Đồ <span className="text-red-600">Tổ Chức</span>
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Vuốt chuột để Zoom. Kéo thả để xem tổng quan bộ máy (Powered by React Flow).</p>
                </div>
            </div>

            {/* VÙNG VẼ CANVAS CỦA REACT FLOW */}
            <div className="flex-1 bg-white rounded-[32px] border border-slate-200 shadow-xl overflow-hidden relative z-0">
                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 font-medium gap-3">
                        <Loader2 size={32} className="animate-spin text-red-500" /> Đang tính toán toạ độ sơ đồ...
                    </div>
                ) : (
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        nodeTypes={nodeTypes}
                        fitView // Tự động Zoom vừa vặn màn hình lúc mới load
                        attributionPosition="bottom-right"
                        className="bg-slate-50/50"
                    >
                        {/* Background chấm bi */}
                        <Background color="#cbd5e1" gap={20} size={1} />
                        {/* Các nút Zoom In, Zoom Out ở góc */}
                        <Controls className="!bg-white !shadow-lg !border-slate-200 !rounded-xl overflow-hidden" />
                        {/* Bản đồ mini thu nhỏ ở góc phải dưới */}
                        <MiniMap className="!bg-white !border-slate-200 !rounded-xl !shadow-lg" />
                    </ReactFlow>
                )}
            </div>
        </div>
    );
}