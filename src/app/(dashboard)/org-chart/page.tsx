"use client";

import { useState, useEffect, useCallback } from "react";
import { Network, Loader2 } from "lucide-react";
import ReactFlow, { Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState } from "reactflow";
import "reactflow/dist/style.css"; 
import dagre from "dagre";
import CustomNode from "./CustomNode";
import { useToast } from "@/app/component/ToastProvider";
import OrgNodeDrawer from "./OrgNodeDrawer";
import PermissionGuard from "@/app/component/PermissionGuard";

const nodeTypes = {
    custom: CustomNode,
};

const getLayoutedElements = (nodes: any[], edges: any[], direction = 'TB') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    
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
    
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [selectedNodeData, setSelectedNodeData] = useState<any>(null);

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    const onNodeClick = useCallback((event: React.MouseEvent, node: any) => {
        console.log(node)
        setSelectedNodeData(node.data);
        setIsDrawerOpen(true);
    }, []);

    useEffect(() => {
        Promise.all([
            fetch("/api/teams").then(res => res.ok ? res.json() : []),
            fetch("/api/departments").then(res => res.ok ? res.json() : []),
            fetch("/api/users/org-chart").then(async res => {
                if (!res.ok) return [];
                const data = await res.json();
                // Vì API mới trả thẳng ra mảng user luôn nên không cần data.users nữa
                return data.filter((u: any) => u.isActive === true);
            })
        ]).then(([teamsData, deptsData, usersData]) => {
            const initialNodes: any[] = [];
            const initialEdges: any[] = [];
            
            const bgdUsers = usersData.filter((u: any) => u.role === "BAN_GIAM_DOC" );
            const bgdTeamIds = bgdUsers.map((u: any) => u.teamId).filter(Boolean);
            const bgdDeptIds = bgdTeamIds.map((tid: string) => teamsData.find((t:any) => t.id === tid)?.departmentId).filter(Boolean);

            const rootId = "root_bgd";
            initialNodes.push({
                id: rootId, type: 'custom', position: { x: 0, y: 0 },
                data: { label: "Ban Giám Đốc", role: "Điều hành", borderColor: "border-red-500", textColor: "text-red-500", isSystemNode: true }
            });

            bgdUsers.forEach((user: any) => {
                const userNodeId = `user_${user.id}`;
                initialNodes.push({
                    id: userNodeId, type: 'custom', position: { x: 0, y: 0 },
                    data: { 
                        label: user.fullName, role: user.role === "ADMIN" ? "Giám Đốc" : "Phó Giám Đốc", 
                        borderColor: 'border-red-300', textColor: 'text-red-600', fullUserObj: user 
                    }
                });
                initialEdges.push({ id: `e_${rootId}-${userNodeId}`, source: rootId, target: userNodeId, type: 'smoothstep', animated: true });
            });

            deptsData.filter((d: any) => !bgdDeptIds.includes(d.id)).forEach((dept: any) => {
                const deptNodeId = `dept_${dept.id}`;
                initialNodes.push({
                    id: deptNodeId, type: 'custom', position: { x: 0, y: 0 },
                    data: { label: dept.name, role: "Phòng Ban", borderColor: "border-slate-800", textColor: "text-slate-800", isSystemNode: true, desc: dept.description }
                });
                initialEdges.push({ id: `e_${rootId}-${deptNodeId}`, source: rootId, target: deptNodeId, type: 'smoothstep' });
            });

            teamsData.filter((t: any) => !bgdTeamIds.includes(t.id)).forEach((team: any) => {
                const teamNodeId = `team_${team.id}`;
                const parentId = team.departmentId && !bgdDeptIds.includes(team.departmentId) ? `dept_${team.departmentId}` : rootId; 
                initialNodes.push({
                    id: teamNodeId, type: 'custom', position: { x: 0, y: 0 },
                    data: { label: team.name, role: "Team", borderColor: "border-slate-800", textColor: "text-slate-800", isSystemNode: true, desc: team.description }
                });
                initialEdges.push({ id: `e_${parentId}-${teamNodeId}`, source: parentId, target: teamNodeId, type: 'smoothstep' });
            });

            usersData.filter((u: any) => u.role !== "BAN_GIAM_DOC" && u.role !== "ADMIN").forEach((user: any) => {
                const userNodeId = `user_${user.id}`;
                const parentId = user.teamId && !bgdTeamIds.includes(user.teamId) ? `team_${user.teamId}` : rootId;
                const actual = user.currentWeekStats?.actual || 0;
                const target = user.currentWeekStats?.target || 0;

                initialNodes.push({
                    id: userNodeId, type: 'custom', position: { x: 0, y: 0 },
                    data: { 
                        label: user.fullName, role: user.role, actual: actual, target: target,
                        avatar: user.avatarUrl || null,
                        borderColor: user.role === 'LEADER' ? 'border-blue-300' : 'border-slate-200', 
                        textColor: user.role === 'LEADER' ? 'text-blue-600' : 'text-slate-500',
                        fullUserObj: user,
                        targetPosition: 'left' // 🚀 Ra lệnh cho node này cắm cổng bên trái
                    }
                });
                initialEdges.push({ id: `e_${parentId}-${userNodeId}`, source: parentId, target: userNodeId, type: 'smoothstep' });
            });

            // =================================================================
            // 🚀 BẮT ĐẦU THUẬT TOÁN CUSTOM LAYOUT XƯƠNG CÁ (VERTICAL TREE)
            // =================================================================
            
            // 1. Tách mảng: Chỉ cho các Node Hệ thống (BGD, Phòng, Team) đi dàn hàng ngang
            const systemNodes = initialNodes.filter(n => n.data.isSystemNode || n.data.role === "Giám Đốc" || n.data.role === "Phó Giám Đốc");
            const systemEdges = initialEdges.filter(e => systemNodes.some(n => n.id === e.source) && systemNodes.some(n => n.id === e.target));

            const userNodes = initialNodes.filter(n => !systemNodes.some(sn => sn.id === n.id));
            const userEdges = initialEdges.filter(e => !systemEdges.some(se => se.id === e.id));

            // 2. Chạy thuật toán Dagre cho bộ khung hệ thống
            const { nodes: layoutedSystemNodes, edges: layoutedSystemEdges } = getLayoutedElements(systemNodes, systemEdges);

            const finalNodes = [...layoutedSystemNodes];
            const finalEdges = [...layoutedSystemEdges];

            // 3. Nhóm các nhân viên theo Team quản lý
            const usersByParent: any = {};
            userEdges.forEach(edge => {
                if (!usersByParent[edge.source]) usersByParent[edge.source] = [];
                const uNode = userNodes.find(n => n.id === edge.target);
                if (uNode) usersByParent[edge.source].push(uNode);
            });

            // 4. Bắt đầu xếp dọc nhân viên dưới hộp Team
            Object.keys(usersByParent).forEach(parentId => {
                const parentNode = layoutedSystemNodes.find((n: any) => n.id === parentId);
                if (!parentNode) return;

                // Tính toán toạ độ xương sống: Tâm của node Team
                const spineX = parentNode.position.x + 100; 
                
                // 🚀 1. KÉO GIÃN TỪ TEAM XUỐNG NGƯỜI ĐẦU TIÊN (Tăng từ 130 lên 160)
                let currentY = parentNode.position.y + 160; 

                usersByParent[parentId].forEach((uNode: any) => {
                    uNode.position = { x: spineX, y: currentY };
                    uNode.targetPosition = 'left';
                    uNode.sourcePosition = 'bottom';
                    finalNodes.push(uNode);

                    const uEdge = userEdges.find(e => e.target === uNode.id);
                    if (uEdge) {
                        uEdge.type = 'smoothstep';
                        uEdge.sourcePosition = 'bottom';
                        uEdge.targetPosition = 'left';
                        finalEdges.push(uEdge);
                    }

                    // 🚀 2. KÉO GIÃN KHOẢNG CÁCH GIỮA TỪNG NGƯỜI (Tăng từ 120 lên 160)
                    // Nếu thấy vẫn sát, sếp có thể tăng số 160 này lên 170 hoặc 180 tùy ý
                    currentY += 160; 
                });
            });

            setNodes(finalNodes); 
            setEdges(finalEdges); 
            setLoading(false);
        }).catch(() => {
            showToast("error", "Lỗi tải dữ liệu Sơ đồ"); 
            setLoading(false);
        });
    }, []);

    const onConnect = useCallback((params: any) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

    return (
        <PermissionGuard moduleId="MENU_ORG_CHART">
        
        <div className="h-full flex flex-col p-3 md:p-6 lg:p-8 animate-fade-in bg-slate-50 relative overflow-hidden">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shrink-0 mb-4 md:mb-6 z-10 relative">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2 md:gap-3">
                        <Network className="text-red-600 w-6 h-6 md:w-8 md:h-8" />
                        Sơ Đồ <span className="text-red-600">Tổ Chức</span>
                    </h1>
                    <p className="text-[11px] md:text-sm text-slate-500 font-medium mt-1">Dùng 2 ngón tay (vuốt chuột) để Zoom. Kéo thả để xem tổng quan bộ máy.</p>
                </div>
            </div>

            {/* VÙNG VẼ CANVAS CỦA REACT FLOW */}
            {/* Bo góc giảm xuống trên mobile (rounded-2xl thay vì 32px) */}
            <div className="flex-1 bg-white rounded-2xl md:rounded-[32px] border border-slate-200 shadow-xl overflow-hidden relative z-0">
                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 font-medium gap-3">
                        <Loader2 size={24} className="animate-spin text-red-500 md:w-8 md:h-8" /> 
                        <span className="text-xs md:text-sm">Đang tính toán toạ độ sơ đồ...</span>
                    </div>
                ) : (
                    <ReactFlow
                        nodesDraggable={false} 
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        nodeTypes={nodeTypes}
                        fitView 
                        attributionPosition="bottom-right"
                        className="bg-slate-50/50"
                        onNodeClick={onNodeClick}
                    >
                        <Background color="#cbd5e1" gap={20} size={1} />
                        <Controls className="!bg-white !shadow-lg !border-slate-200 !rounded-xl overflow-hidden hidden sm:flex" showInteractive={false}/>
                        {/* Ẩn Minimap trên Mobile vì vướng chỗ */}
                        <MiniMap className="!bg-white !border-slate-200 !rounded-xl !shadow-lg hidden md:block" />
                    </ReactFlow>
                )}
            </div>
            
            <OrgNodeDrawer 
                isOpen={isDrawerOpen} 
                onClose={() => setIsDrawerOpen(false)} 
                nodeData={selectedNodeData} 
            />
        </div>
        </PermissionGuard>
    );
}