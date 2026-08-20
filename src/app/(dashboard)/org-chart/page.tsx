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
    
    const nodeWidth = 260; 
    const nodeHeight = 160;

    dagreGraph.setGraph({ rankdir: direction, nodesep: 40, ranksep: 60 });

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
                return data.filter((u: any) => u.isActive === true);
            }),
            fetch("/api/channels").then(res => res.ok ? res.json() : [])
        ]).then(([teamsData, deptsData, usersData, channelsData]) => {
            const initialNodes: any[] = [];
            const initialEdges: any[] = [];
            
            const bgdUsers = usersData.filter((u: any) => u.role === "BAN_GIAM_DOC" );
            const bgdTeamIds = bgdUsers.map((u: any) => u.teamId).filter(Boolean);
            const bgdDeptIds = bgdTeamIds.map((tid: string) => teamsData.find((t:any) => t.id === tid)?.departmentId).filter(Boolean);

            const rootId = "root_bgd";
            initialNodes.push({
                id: rootId, type: 'custom', position: { x: 0, y: 0 },
                data: { label: "Ban Giám Đốc", role: "Điều hành", borderColor: "border-red-500", textColor: "text-red-500", isSystemNode: true, targetPosition: 'top' }
            });

            bgdUsers.forEach((user: any) => {
                const userNodeId = `user_${user.id}`;
                initialNodes.push({
                    id: userNodeId, type: 'custom', position: { x: 0, y: 0 },
                    data: { 
                        label: user.fullName, role: user.role === "ADMIN" ? "Giám Đốc" : "Phó Giám Đốc", 
                        borderColor: 'border-red-300', textColor: 'text-red-600', fullUserObj: user, targetPosition: 'top'
                    }
                });
                initialEdges.push({ id: `e_${rootId}-${userNodeId}`, source: rootId, target: userNodeId, type: 'smoothstep', animated: true });
            });

            deptsData.filter((d: any) => !bgdDeptIds.includes(d.id)).forEach((dept: any) => {
                const deptNodeId = `dept_${dept.id}`;
                initialNodes.push({
                    id: deptNodeId, type: 'custom', position: { x: 0, y: 0 },
                    data: { label: dept.name, role: "Phòng Ban", borderColor: "border-slate-800", textColor: "text-slate-800", isSystemNode: true, desc: dept.description, targetPosition: 'top' }
                });
                initialEdges.push({ id: `e_${rootId}-${deptNodeId}`, source: rootId, target: deptNodeId, type: 'smoothstep' });
            });

            teamsData.filter((t: any) => !bgdTeamIds.includes(t.id)).forEach((team: any) => {
                const teamNodeId = `team_${team.id}`;
                const parentId = team.departmentId && !bgdDeptIds.includes(team.departmentId) ? `dept_${team.departmentId}` : rootId; 
                initialNodes.push({
                    id: teamNodeId, type: 'custom', position: { x: 0, y: 0 },
                    data: { label: team.name, role: "Team", borderColor: "border-slate-800", textColor: "text-slate-800", isSystemNode: true, desc: team.description, targetPosition: 'top' }
                });
                initialEdges.push({ id: `e_${parentId}-${teamNodeId}`, source: parentId, target: teamNodeId, type: 'smoothstep' });
            });

            const noTeamId = "no_team";
            initialNodes.push({
                id: noTeamId, type: 'custom', position: { x: 0, y: 0 },
                data: { label: "Chưa phân bổ (No Team)", role: "Phòng Ban", borderColor: "border-slate-400", textColor: "text-slate-500", isSystemNode: true, desc: "Nhân sự & Kênh chưa được gắn vào Team cụ thể.", targetPosition: 'top' }
            });
            initialEdges.push({ id: `e_${rootId}-${noTeamId}`, source: rootId, target: noTeamId, type: 'smoothstep', animated: true });

            const groupedUsers: Record<string, any[]> = {};
            const groupedChannels: Record<string, any[]> = {};

            channelsData.forEach((channel: any) => {
                const pId = channel.teamId && !bgdTeamIds.includes(channel.teamId) ? `team_${channel.teamId}` : noTeamId;
                if (!groupedChannels[pId]) groupedChannels[pId] = [];
                groupedChannels[pId].push(channel);
            });

            usersData.filter((u: any) => u.role !== "BAN_GIAM_DOC" && u.role !== "ADMIN").forEach((user: any) => {
                let pId = user.teamId && !bgdTeamIds.includes(user.teamId) ? `team_${user.teamId}` : noTeamId;
                if (!groupedUsers[pId]) groupedUsers[pId] = [];
                groupedUsers[pId].push(user);
            });

            const allParentIds = new Set([...Object.keys(groupedUsers), ...Object.keys(groupedChannels)]);

            allParentIds.forEach(parentId => {
                const users = groupedUsers[parentId] || [];
                const channels = groupedChannels[parentId] || [];

                const leaders = users.filter(u => u.role === 'LEADER');
                const members = users.filter(u => u.role !== 'LEADER');

                let lastLeaderId = parentId;

                leaders.forEach(u => {
                    const uId = `user_${u.id}`;
                    initialNodes.push({
                        id: uId, type: 'custom', position: { x: 0, y: 0 },
                        data: { 
                            label: u.fullName, role: u.role, actual: u.currentWeekStats?.actual || 0, target: u.currentWeekStats?.target || 0, 
                            surplusDetails: u.surplusDetails || [], surplusTaskList: u.surplusTaskList || [], 
                            avatar: u.avatarUrl || null, borderColor: 'border-red-300', textColor: 'text-red-600', fullUserObj: u, targetPosition: 'top'
                        }
                    });
                    initialEdges.push({ id: `e_${lastLeaderId}-${uId}`, source: lastLeaderId, target: uId, type: 'smoothstep' });
                    lastLeaderId = uId;
                });

                if (channels.length > 0) {
                    const membersByChannel: Record<string, any[]> = {};
                    channels.forEach(c => membersByChannel[c.id] = []);
                    
                    const unassigned: any[] = [];
                    
                    members.forEach(u => {
                        const userChannels = u.channelMemberships || [];
                        if (userChannels.length > 0) {
                            let assignedToAtLeastOne = false;
                            userChannels.forEach((uc: any) => {
                                if (membersByChannel[uc.channelId]) {
                                    membersByChannel[uc.channelId].push({ ...u, roleOnChannel: uc.roleOnChannel });
                                    assignedToAtLeastOne = true;
                                }
                            });
                            if (!assignedToAtLeastOne) {
                                unassigned.push(u);
                            }
                        } else {
                            unassigned.push(u);
                        }
                    });

                    channels.forEach(c => {
                        const cId = `channel_${c.id}`;
                        initialNodes.push({
                            id: cId, type: 'custom', position: { x: 0, y: 0 },
                            data: { 
                                label: c.name, role: "Kênh", borderColor: "border-teal-300", textColor: "text-teal-600", 
                                isSystemNode: false, fullChannelObj: c, targetPosition: 'top'
                            }
                        });
                        initialEdges.push({ id: `e_${lastLeaderId}-${cId}`, source: lastLeaderId, target: cId, type: 'smoothstep' });

                        let lastNodeId = cId;
                        membersByChannel[c.id].forEach(u => {
                            const uId = `user_${c.id}_${u.id}`; 
                            
                            // 🚀 ĐÃ SỬA: LỌC BÀI DƯ THEO ĐÚNG ID KÊNH (c.id) MÀ NODE NÀY ĐANG NẰM
                            const channelSurplusList = (u.surplusTaskList || []).filter((task: any) => task.channelId === c.id);
                            
                            // Tính toán lại surplusDetails (Thống kê số lượng theo phút) dành riêng cho Kênh này
                            const durCount: Record<number, number> = {};
                            channelSurplusList.forEach((t: any) => {
                                durCount[t.duration] = (durCount[t.duration] || 0) + 1;
                            });
                            const channelSurplusDetails = Object.entries(durCount)
                                .map(([dur, count]) => ({ duration: Number(dur), count: count as number }))
                                .sort((a, b) => b.duration - a.duration);

                            initialNodes.push({
                                id: uId, type: 'custom', position: { x: 0, y: 0 },
                                data: { 
                                    label: u.fullName, role: u.roleOnChannel || u.role, actual: u.currentWeekStats?.actual || 0, target: u.currentWeekStats?.target || 0, 
                                    surplusDetails: channelSurplusDetails, // 🚀 TRUYỀN DATA ĐÃ LỌC
                                    surplusTaskList: channelSurplusList,   // 🚀 TRUYỀN DATA ĐÃ LỌC
                                    avatar: u.avatarUrl || null, borderColor: 'border-slate-200', textColor: 'text-slate-500', fullUserObj: u, targetPosition: 'top'
                                }
                            });
                            initialEdges.push({ id: `e_${lastNodeId}-${uId}`, source: lastNodeId, target: uId, type: 'smoothstep' });
                            lastNodeId = uId;
                        });
                    });

                    let lastUnassignedId = lastLeaderId;
                    unassigned.forEach(u => {
                        const uId = `user_unassigned_${u.id}`;
                        initialNodes.push({
                            id: uId, type: 'custom', position: { x: 0, y: 0 },
                            data: { 
                                label: u.fullName, role: u.role, actual: u.currentWeekStats?.actual || 0, target: u.currentWeekStats?.target || 0, 
                                surplusDetails: u.surplusDetails || [], surplusTaskList: u.surplusTaskList || [], 
                                avatar: u.avatarUrl || null, borderColor: 'border-slate-200', textColor: 'text-slate-500', fullUserObj: u, targetPosition: 'top'
                            }
                        });
                        initialEdges.push({ id: `e_${lastUnassignedId}-${uId}`, source: lastUnassignedId, target: uId, type: 'smoothstep' });
                        lastUnassignedId = uId;
                    });

                } else {
                    let lastNodeId = lastLeaderId;
                    members.forEach(u => {
                        const uId = `user_${u.id}`;
                        initialNodes.push({
                            id: uId, type: 'custom', position: { x: 0, y: 0 },
                            data: { 
                                label: u.fullName, role: u.role, actual: u.currentWeekStats?.actual || 0, target: u.currentWeekStats?.target || 0, 
                                surplusDetails: u.surplusDetails || [], surplusTaskList: u.surplusTaskList || [], 
                                avatar: u.avatarUrl || null, borderColor: 'border-slate-200', textColor: 'text-slate-500', fullUserObj: u, targetPosition: 'top'
                            }
                        });
                        initialEdges.push({ id: `e_${lastNodeId}-${uId}`, source: lastNodeId, target: uId, type: 'smoothstep' });
                        lastNodeId = uId;
                    });
                }
            });

            const { nodes: finalNodes, edges: finalEdges } = getLayoutedElements(initialNodes, initialEdges, 'TB');

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
        <div className="h-full w-full flex flex-col animate-fade-in bg-white relative overflow-hidden">
            <div className="px-5 py-3 md:px-6 md:py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shrink-0 bg-white border-b border-slate-200 z-10 shadow-sm">
                <div>
                    <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <Network className="text-red-600 w-5 h-5 md:w-6 md:h-6" />
                        Sơ Đồ <span className="text-red-600">Tổ Chức</span>
                    </h1>
                    <p className="text-[10px] md:text-xs text-slate-500 font-medium mt-0.5">Dùng 2 ngón tay hoặc con lăn chuột để Zoom. Kéo thả vùng trống để di chuyển.</p>
                </div>
            </div>

            <div className="flex-1 w-full h-full bg-slate-50 relative z-0">
                {loading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 font-medium gap-3 bg-white/50 backdrop-blur-sm z-20">
                        <Loader2 size={28} className="animate-spin text-red-500" /> 
                        <span className="text-sm">Đang tính toán toạ độ sơ đồ...</span>
                    </div>
                ) : (
                    <ReactFlow
                        nodesDraggable={true} 
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        nodeTypes={nodeTypes}
                        fitView 
                        fitViewOptions={{ padding: 0.15, minZoom: 0.1, maxZoom: 1.2 }} 
                        attributionPosition="bottom-right"
                        className="bg-transparent"
                        onNodeClick={onNodeClick}
                    >
                        <Background color="#cbd5e1" gap={20} size={1} />
                        <Controls className="!bg-white !shadow-md !border-slate-200 !rounded-xl overflow-hidden hidden sm:flex" showInteractive={false}/>
                        <MiniMap className="!bg-white !border-slate-200 !rounded-xl !shadow-md hidden md:block" />
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