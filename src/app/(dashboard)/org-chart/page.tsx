"use client";

import { useState, useEffect, useCallback } from "react";
import { Network, Loader2, Save, CalendarDays, AlertCircle } from "lucide-react";
import ReactFlow, { Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState } from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";

import { useToast } from "@/app/component/ToastProvider";

import PermissionGuard from "@/app/component/PermissionGuard";
import CustomNode from "./CustomNode";
import OrgNodeDrawer from "./OrgNodeDrawer";

const nodeTypes = {
    custom: CustomNode,
};

const getLayoutedElements = (nodes: any[], edges: any[], direction = 'TB') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    const nodeWidth = 260; const nodeHeight = 160;
    dagreGraph.setGraph({ rankdir: direction, nodesep: 40, ranksep: 60 });
    nodes.forEach((node) => { dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight }); });
    edges.forEach((edge) => { dagreGraph.setEdge(edge.source, edge.target); });
    dagre.layout(dagreGraph);
    nodes.forEach((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        node.targetPosition = 'top'; node.sourcePosition = 'bottom';
        node.position = { x: nodeWithPosition.x - nodeWidth / 2, y: nodeWithPosition.y - nodeHeight / 2 };
        return node;
    });
    return { nodes, edges };
};

const getAvailableWeeks = (year: number, month: number) => {
    if (!year || !month) return [];
    const totalDays = new Date(year, month, 0, 12, 0, 0).getDate();
    const firstDayOfMonth = new Date(year, month - 1, 1, 12, 0, 0);
    const startDayOfWeek = firstDayOfMonth.getDay();
    const diffToSunday = startDayOfWeek === 0 ? 0 : 7 - startDayOfWeek;
    const firstSunday = 1 + diffToSunday;
    const remainingDays = totalDays - firstSunday;
    const totalWeeks = 1 + Math.ceil(remainingDays / 7);
    return Array.from({ length: totalWeeks }, (_, i) => i + 1);
};

const getCurrentWeekInfo = () => {
    const today = new Date();
    const localTime = today.getTime();
    const localOffset = today.getTimezoneOffset() * 60000;
    const utc = localTime + localOffset;
    const vietnamTime = new Date(utc + (3600000 * 7));

    const year = vietnamTime.getFullYear();
    const month = vietnamTime.getMonth() + 1;
    const date = vietnamTime.getDate();

    const firstDayOfMonth = new Date(year, month - 1, 1, 12, 0, 0);
    const startDayOfWeek = firstDayOfMonth.getDay();
    const diffToSunday = startDayOfWeek === 0 ? 0 : 7 - startDayOfWeek;
    const firstSunday = 1 + diffToSunday;

    let week = 1;
    if (date > firstSunday) {
        week = 2 + Math.floor((date - firstSunday - 1) / 7);
    }
    return { year, month, week };
};

const getWeekDateRange = (year: number, month: number, weekNumber: number) => {
    if (!year || !month || !weekNumber) return "";
    const totalDays = new Date(year, month, 0, 12, 0, 0).getDate();
    const firstDayOfMonth = new Date(year, month - 1, 1, 12, 0, 0);
    const startDayOfWeek = firstDayOfMonth.getDay();
    const diffToSunday = startDayOfWeek === 0 ? 0 : 7 - startDayOfWeek;
    const firstSunday = 1 + diffToSunday;

    let startDay = 1;
    let endDay = firstSunday;

    if (weekNumber > 1) {
        startDay = firstSunday + (weekNumber - 2) * 7 + 1;
        endDay = Math.min(startDay + 6, totalDays);
    }

    const pad = (n: number) => n.toString().padStart(2, '0');
    return `(${pad(startDay)}/${pad(month)} - ${pad(endDay)}/${pad(month)})`;
};

const normalizeGroupRole = (role: string) => {
    if (!role) return 'UNKNOWN';
    const r = String(role).toUpperCase();
    if (r.includes('EDIT')) return 'EDITOR';
    if (r.includes('CONTENT')) return 'CONTENT';
    if (r.includes('IT')) return 'IT';
    if (r.includes('ANIMAT')) return 'ANIMATOR';
    if (['PUBLISHER', 'PUBLISH', 'CHANNEL_MANAGER', 'QUAN_LY', 'QUẢN LÝ', 'QUẢN LÝ KÊNH'].includes(r)) return 'PUBLISHER';
    return r;
};

export default function OrgChartPage() {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [selectedNodeData, setSelectedNodeData] = useState<any>(null);

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    const [isSaving, setIsSaving] = useState(false);
    const [isCurrentWeek, setIsCurrentWeek] = useState(false);
    const [isViewingSaved, setIsViewingSaved] = useState(false);
    const [isUnsavedWarning, setIsUnsavedWarning] = useState(false);

    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(0);
    const [selectedWeek, setSelectedWeek] = useState<number>(0);

    const onNodeClick = useCallback((event: React.MouseEvent, node: any) => {
        let currentId = node.id;
        let foundChannelName = node.data.channelName || "";
        let foundTeamName = node.data.teamName || node.data.fullUserObj?.teamName || node.data.fullUserObj?.team?.name || "";

        if (!foundChannelName || !foundTeamName) {
            let maxDepth = 10;
            let curr = currentId;
            while (maxDepth > 0) {
                const parentEdge = edges.find((e: any) => e.target === curr);
                if (!parentEdge) break;

                const parentNode = nodes.find((n: any) => n.id === parentEdge.source);
                if (!parentNode) break;

                if (!foundChannelName && (parentNode.data.role === "Kênh" || parentNode.data.fullChannelObj)) {
                    foundChannelName = parentNode.data.fullChannelObj?.name || parentNode.data.label || "";
                }

                if (!foundTeamName && parentNode.data.role === "Team") {
                    foundTeamName = parentNode.data.label || "";
                }

                curr = parentNode.id;
                maxDepth--;
            }
        }

        setSelectedNodeData({
            ...node.data,
            nodeId: node.id,
            resolvedChannelName: foundChannelName,
            resolvedTeamName: foundTeamName
        });
        setIsDrawerOpen(true);
    }, [nodes, edges]);

    useEffect(() => {
        const { year, month, week } = getCurrentWeekInfo();
        setSelectedYear(year);
        setSelectedMonth(month);
        setSelectedWeek(week);
    }, []);

    useEffect(() => {
        const { year, month, week } = getCurrentWeekInfo();
        setIsCurrentWeek(selectedYear === year && selectedMonth === month && selectedWeek === week);
    }, [selectedYear, selectedMonth, selectedWeek]);

    const fetchOrgChartData = useCallback((forceLiveGenerate = false, autoSave = false) => {
        if (!selectedMonth || !selectedWeek) return;
        setLoading(true);

        const { year: curY, month: curM, week: curW } = getCurrentWeekInfo();
        const isCurrent = selectedYear === curY && selectedMonth === curM && selectedWeek === curW;

        fetch(`/api/org-chart/save?year=${selectedYear}&month=${selectedMonth}&week=${selectedWeek}`)
            .then(res => res.json())
            .then(savedRes => {
                const hasSavedData = savedRes.data && savedRes.data.chartData;

                if (!isCurrent && !hasSavedData && !forceLiveGenerate) {
                    setNodes([]);
                    setEdges([]);
                    setIsViewingSaved(false);
                    setIsUnsavedWarning(true);
                    setLoading(false);
                    return;
                }

                if (!isCurrent && hasSavedData && !forceLiveGenerate) {
                    setNodes(savedRes.data.chartData.nodes);
                    setEdges(savedRes.data.chartData.edges);
                    setIsViewingSaved(true);
                    setIsUnsavedWarning(false);
                    setLoading(false);
                    return;
                }

                setIsUnsavedWarning(false);
                setIsViewingSaved(false);

                // 🚀 LẤY DỮ LIỆU ĐỒNG BỘ: Users, Channels, và Bảng Bài Dư Kênh Mới
                Promise.all([
                    fetch("/api/teams").then(res => res.ok ? res.json() : []),
                    fetch("/api/departments").then(res => res.ok ? res.json() : []),
                    fetch(`/api/users/org-chart?year=${selectedYear}&month=${selectedMonth}&week=${selectedWeek}`).then(async res => {
                        if (!res.ok) return [];
                        const data = await res.json();
                        return data.filter((u: any) => u.isActive === true);
                    }),
                    fetch("/api/channels").then(async res => {
                        if (!res.ok) return [];
                        const data = await res.json();
                        return data.filter((c: any) => c.status !== "DUNG_HOAT_DONG" && c.status !== "BAY_KENH");
                    }),
                    fetch(`/api/surplus/channel?year=${selectedYear}&month=${selectedMonth}&week=${selectedWeek}`).then(res => res.ok ? res.json() : { data: [] })
                ]).then(async ([teamsData, deptsData, usersData, channelsData, surplusRes]) => {

                    const channelSurpluses = surplusRes.data || [];

                    // HÀM TIỆN ÍCH GOM NHÓM BÀI DƯ THEO PHÚT
                    const aggregateSurplus = (surplusArray: any[]) => {
                        const durCount: Record<number, number> = {};
                        (surplusArray || []).forEach((s: any) => {
                            const d = Number(s.duration) || 0;
                            durCount[d] = (durCount[d] || 0) + (Number(s.count) || 0);
                        });
                        return Object.entries(durCount)
                            .map(([dur, count]) => ({ duration: Number(dur), count: count as number }))
                            .filter(x => x.count >= 0) // 🚀 ĐÃ SỬA: Cho phép số 0 đi qua
                            .sort((a, b) => b.duration - a.duration);
                    };

                    const initialNodes: any[] = [];
                    const initialEdges: any[] = [];

                    const validDeptIds = new Set(deptsData.map((d: any) => d.id));
                    const validTeamIds = new Set(teamsData.map((t: any) => t.id));

                    const bgdUsers = usersData.filter((u: any) => u.role === "BAN_GIAM_DOC");
                    const bgdTeamIds = bgdUsers.map((u: any) => u.teamId).filter(Boolean);
                    const bgdDeptIds = bgdTeamIds.map((tid: string) => teamsData.find((t: any) => t.id === tid)?.departmentId).filter(Boolean);

                    const rootId = "root_bgd";
                    initialNodes.push({
                        id: rootId, type: 'custom', position: { x: 0, y: 0 },
                        data: { label: "SANO MEDIA", role: "Sơ đồ tổ chức", isSystemNode: true, targetPosition: 'top' }
                    });

                    bgdUsers.forEach((user: any) => {
                        const userNodeId = `user_${user.id}`;
                        initialNodes.push({
                            id: userNodeId, type: 'custom', position: { x: 0, y: 0 },
                            data: {
                                label: user.fullName, role: user.role === "ADMIN" ? "Giám Đốc" : "Phó Giám Đốc",
                                fullUserObj: user, targetPosition: 'top'
                            }
                        });
                        initialEdges.push({ id: `e_${rootId}-${userNodeId}`, source: rootId, target: userNodeId, type: 'smoothstep', animated: true });
                    });

                    deptsData.filter((d: any) => !bgdDeptIds.includes(d.id)).forEach((dept: any) => {
                        const deptNodeId = `dept_${dept.id}`;
                        initialNodes.push({
                            id: deptNodeId, type: 'custom', position: { x: 0, y: 0 },
                            data: { label: dept.name, role: "Phòng Ban", isSystemNode: true, desc: dept.description, targetPosition: 'top' }
                        });
                        initialEdges.push({ id: `e_${rootId}-${deptNodeId}`, source: rootId, target: deptNodeId, type: 'smoothstep' });
                    });

                    teamsData.filter((t: any) => !bgdTeamIds.includes(t.id)).forEach((team: any) => {
                        const teamNodeId = `team_${team.id}`;
                        const parentId = team.departmentId && validDeptIds.has(team.departmentId) && !bgdDeptIds.includes(team.departmentId) ? `dept_${team.departmentId}` : rootId;
                        initialNodes.push({
                            id: teamNodeId, type: 'custom', position: { x: 0, y: 0 },
                            data: { label: team.name, role: "Team", isSystemNode: true, desc: team.description, targetPosition: 'top' }
                        });
                        initialEdges.push({ id: `e_${parentId}-${teamNodeId}`, source: parentId, target: teamNodeId, type: 'smoothstep' });
                    });

                    const noTeamId = "no_team";
                    initialNodes.push({
                        id: noTeamId, type: 'custom', position: { x: 0, y: 0 },
                        data: { label: "Chưa phân bổ (No Team)", role: "Phòng Ban", isSystemNode: true, desc: "Nhân sự & Kênh chưa được gắn vào Team cụ thể.", targetPosition: 'top' }
                    });
                    initialEdges.push({ id: `e_${rootId}-${noTeamId}`, source: rootId, target: noTeamId, type: 'smoothstep', animated: true });

                    const groupedUsers: Record<string, any[]> = {};
                    const groupedChannels: Record<string, any[]> = {};

                    channelsData.forEach((channel: any) => {
                        const pId = channel.teamId && validTeamIds.has(channel.teamId) && !bgdTeamIds.includes(channel.teamId) ? `team_${channel.teamId}` : noTeamId;
                        if (!groupedChannels[pId]) groupedChannels[pId] = [];
                        groupedChannels[pId].push(channel);
                    });

                    usersData.filter((u: any) => u.role !== "BAN_GIAM_DOC" && u.role !== "ADMIN").forEach((user: any) => {
                        let pId = user.teamId && validTeamIds.has(user.teamId) && !bgdTeamIds.includes(user.teamId) ? `team_${user.teamId}` : noTeamId;
                        if (!groupedUsers[pId]) groupedUsers[pId] = [];
                        groupedUsers[pId].push(user);
                    });

                    const allParentIds = new Set([...Object.keys(groupedUsers), ...Object.keys(groupedChannels)]);

                    allParentIds.forEach(parentId => {
                        const users = groupedUsers[parentId] || [];
                        const channels = groupedChannels[parentId] || [];

                        const leaders = users.filter(u => u.role === 'LEADER');
                        let lastLeaderId = parentId;
                        const defaultLeader = leaders.length > 0 ? leaders[0] : null;

                        leaders.forEach(u => {
                            const uId = `user_${u.id}`;
                            const leaderKPIs = (u.currentWeekStats?.targetDetails || []).filter((td: any) => {
                                return !td.channelId || td.jobCategory === 'LEADER';
                            });

                            initialNodes.push({
                                id: uId, type: 'custom', position: { x: 0, y: 0 },
                                data: {
                                    label: u.fullName, role: u.role,
                                    targetDetails: leaderKPIs,
                                    fullUserObj: u, targetPosition: 'top'
                                }
                            });
                            initialEdges.push({ id: `e_${lastLeaderId}-${uId}`, source: lastLeaderId, target: uId, type: 'smoothstep' });
                            lastLeaderId = uId;
                        });

                        if (channels.length > 0) {
                            const membersByChannel: Record<string, any[]> = {};
                            channels.forEach(c => membersByChannel[c.id] = []);

                            const unassigned: any[] = [];

                            users.forEach(u => {
                                const userChannels = new Set((u.channelMemberships || []).map((uc: any) => uc.channelId));
                                const kpiChannels = new Set((u.currentWeekStats?.targetDetails || []).map((td: any) => td.channelId).filter(Boolean));

                                const allChannelsForUser = new Set([...userChannels, ...kpiChannels]);

                                let assignedToAtLeastOne = false;
                                allChannelsForUser.forEach((cId: any) => {
                                    if (membersByChannel[cId]) {
                                        const ucs = (u.channelMemberships || []).filter((x: any) => x.channelId === cId);
                                        if (ucs.length > 0) {
                                            ucs.forEach((uc: any) => {
                                                membersByChannel[cId].push({ ...u, roleOnChannel: uc.roleOnChannel });
                                            });
                                        } else {
                                            membersByChannel[cId].push({ ...u, roleOnChannel: null });
                                        }
                                        assignedToAtLeastOne = true;
                                    }
                                });

                                if (!assignedToAtLeastOne && u.role !== 'LEADER') {
                                    unassigned.push(u);
                                }
                            });

                            const channelsByQlk = new Map<string, any[]>();
                            const qlkUsers = new Map<string, any>();
                            const channelsWithoutQlk: any[] = [];

                            channels.forEach(c => {
                                const cMembers = membersByChannel[c.id] || [];
                                let qlk = cMembers.find(u => {
                                    const r = String(u.roleOnChannel || u.role).toUpperCase();
                                    return ['PUBLISHER', 'PUBLISH', 'CHANNEL_MANAGER', 'QUAN_LY', 'QUẢN LÝ', 'QUẢN LÝ KÊNH'].includes(r);
                                });

                                if (!qlk && defaultLeader) {
                                    qlk = defaultLeader;
                                }

                                if (qlk) {
                                    if (!channelsByQlk.has(qlk.id)) {
                                        channelsByQlk.set(qlk.id, []);
                                        qlkUsers.set(qlk.id, qlk);
                                    }
                                    channelsByQlk.get(qlk.id)!.push(c);
                                } else {
                                    channelsWithoutQlk.push(c);
                                }
                            });

                            const processChannelMembers = (c: any, cNodeId: string, excludeUserId: string | null) => {
                                let lastNodeId = cNodeId;
                                const roleGroups: Record<string, any[]> = {};

                                const cMembers = membersByChannel[c.id] || [];
                                cMembers.forEach(u => {
                                    const rolesForUser = new Set<string>();

                                    if (u.roleOnChannel) {
                                        rolesForUser.add(normalizeGroupRole(u.roleOnChannel));
                                    }

                                    const userTargets = u.currentWeekStats?.targetDetails || [];
                                    userTargets.filter((td: any) => td.channelId === c.id).forEach((td: any) => {
                                        if (td.jobCategory) rolesForUser.add(normalizeGroupRole(td.jobCategory));
                                    });

                                    if (rolesForUser.size === 0) {
                                        rolesForUser.add(normalizeGroupRole(u.role || 'UNKNOWN'));
                                    }

                                    if (u.id === excludeUserId) {
                                        rolesForUser.delete('PUBLISHER');
                                    }

                                    rolesForUser.forEach(role => {
                                        if (role === 'PUBLISHER') return;

                                        if (!roleGroups[role]) roleGroups[role] = [];
                                        if (!roleGroups[role].find(x => x.id === u.id)) {
                                            roleGroups[role].push(u);
                                        }
                                    });
                                });

                                const roleOrder = ['EDITOR', 'ANIMATOR', 'CONTENT'];
        
                                const sortedRoles = Object.keys(roleGroups).sort((a, b) => {
                                    const rankA = roleOrder.indexOf(a);
                                    const rankB = roleOrder.indexOf(b);
                                    return (rankA === -1 ? 99 : rankA) - (rankB === -1 ? 99 : rankB);
                                });
        
                                sortedRoles.forEach(role => {
                                    const groupUsers = roleGroups[role];
                                    const uId = `group_${c.id}_${role}`;
        
                                    const groupedData = groupUsers.map(u => {
                                        const userAllTargets = u.currentWeekStats?.targetDetails || [];
                                        const filteredTargets = userAllTargets.filter((td: any) => {
                                            if (td.channelId && td.channelId !== c.id) return false;
                                            const tdJob = normalizeGroupRole(td.jobCategory || td.job || 'CONTENT');
                                            return tdJob === role;
                                        });
        
                                        return {
                                            id: u.id, fullName: u.fullName,
                                            targetDetails: filteredTargets,
                                            fullUserObj: u
                                        };
                                    });
        
                                    const finalGroupedData = groupedData.filter(u => u.targetDetails.length > 0 || u.id !== excludeUserId);
        
                                    // 🚀 ĐỔ SỐ DƯ TỪ BẢNG MỚI VÀO TỪNG NHÓM (KHÔNG GỘP KHÂU NỮA)
                                    const cSurplus = channelSurpluses.find((s: any) => s.channelId === c.id);
                                    let rawNodeSurplus: any[] = [];
                                    if (cSurplus && cSurplus.details) {
                                        rawNodeSurplus = cSurplus.details.filter((d: any) => normalizeGroupRole(d.jobCategory) === role);
                                    }
                                    const nodeSurplusAggregated = aggregateSurplus(rawNodeSurplus);

                                    if (finalGroupedData.length > 0 || nodeSurplusAggregated.length > 0) {
                                        initialNodes.push({
                                            id: uId, type: 'custom', position: { x: 0, y: 0 },
                                            data: { isGroup: true, role: role, users: finalGroupedData, channelName: c.name, targetPosition: 'top', nodeSurplus: nodeSurplusAggregated }
                                        });
                                        initialEdges.push({ id: `e_${lastNodeId}-${uId}`, source: lastNodeId, target: uId, type: 'smoothstep' });
                                        lastNodeId = uId; 
                                    }
                                });
                            };

                            qlkUsers.forEach((qlk, qlkId) => {
                                const qlkNodeId = `qlk_${qlkId}_team_${parentId}`;
                                const qlkTargets = qlk.currentWeekStats?.targetDetails || [];

                                // 🚀 ĐỔ SỐ DƯ TỪ BẢNG MỚI CHO QUẢN LÝ KÊNH
                                const qlkChannelsArr = channelsByQlk.get(qlkId) || [];
                                let qlkSurplusList: any[] = [];
                                qlkChannelsArr.forEach((c: any) => {
                                    const cSurplus = channelSurpluses.find((s: any) => s.channelId === c.id);
                                    if (cSurplus && cSurplus.details) {
                                        const pubSurplus = cSurplus.details.filter((d: any) => d.jobCategory === 'PUBLISHER');
                                        qlkSurplusList = [...qlkSurplusList, ...pubSurplus];
                                    }
                                });

                                initialNodes.push({
                                    id: qlkNodeId, type: 'custom', position: { x: 0, y: 0 },
                                    data: {
                                        label: qlk.fullName, role: 'PUBLISHER',
                                        targetDetails: [],
                                        nodeSurplus: aggregateSurplus(qlkSurplusList),
                                        fullUserObj: qlk, targetPosition: 'top'
                                    }
                                });
                                initialEdges.push({ id: `e_${lastLeaderId}-${qlkNodeId}`, source: lastLeaderId, target: qlkNodeId, type: 'smoothstep' });

                                const qlkChannels = channelsByQlk.get(qlkId) || [];
                                qlkChannels.forEach(c => {
                                    const cId = `channel_${c.id}`;
                                    const channelKpis = qlkTargets.filter((td: any) => {
                                        if (td.channelId !== c.id) return false;
                                        const job = normalizeGroupRole(td.jobCategory || '');
                                        return job === 'PUBLISHER' || job === 'UNKNOWN';
                                    });

                                    initialNodes.push({
                                        id: cId, type: 'custom', position: { x: 0, y: 0 },
                                        data: {
                                            label: c.name, role: "Kênh", targetDetails: channelKpis,
                                            isSystemNode: false, fullChannelObj: c, targetPosition: 'top'
                                        }
                                    });
                                    initialEdges.push({ id: `e_${qlkNodeId}-${cId}`, source: qlkNodeId, target: cId, type: 'smoothstep' });

                                    processChannelMembers(c, cId, qlkId);
                                });
                            });

                            channelsWithoutQlk.forEach(c => {
                                const cId = `channel_${c.id}`;
                                initialNodes.push({
                                    id: cId, type: 'custom', position: { x: 0, y: 0 },
                                    data: {
                                        label: c.name, role: "Kênh",
                                        isSystemNode: false, fullChannelObj: c, targetPosition: 'top'
                                    }
                                });
                                initialEdges.push({ id: `e_${lastLeaderId}-${cId}`, source: lastLeaderId, target: cId, type: 'smoothstep' });

                                processChannelMembers(c, cId, null);
                            });

                            let lastUnassignedId = lastLeaderId;
                            unassigned.forEach(u => {
                                const uId = `user_unassigned_${u.id}`;
                                initialNodes.push({
                                    id: uId, type: 'custom', position: { x: 0, y: 0 },
                                    data: {
                                        label: u.fullName, role: u.role,
                                        targetDetails: u.currentWeekStats?.targetDetails || [],
                                        fullUserObj: u, targetPosition: 'top'
                                    }
                                });
                                initialEdges.push({ id: `e_${lastUnassignedId}-${uId}`, source: lastUnassignedId, target: uId, type: 'smoothstep' });
                                lastUnassignedId = uId;
                            });

                        } else {
                            const members = users.filter(u => u.role !== 'LEADER');
                            let lastNodeId = lastLeaderId;
                            members.forEach(u => {
                                const uId = `user_${u.id}`;
                                initialNodes.push({
                                    id: uId, type: 'custom', position: { x: 0, y: 0 },
                                    data: {
                                        label: u.fullName, role: u.role,
                                        targetDetails: u.currentWeekStats?.targetDetails || [],
                                        fullUserObj: u, targetPosition: 'top'
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

                    if (autoSave) {
                        fetch("/api/org-chart/save", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                year: selectedYear,
                                month: selectedMonth,
                                week: selectedWeek,
                                chartData: { nodes: finalNodes, edges: finalEdges }
                            })
                        }).then(res => {
                            if (res.ok) {
                                setIsViewingSaved(true);
                                setIsUnsavedWarning(false);
                            }
                        });
                    }

                }).catch((err) => {
                    console.error(err);
                    showToast("error", "Lỗi tải dữ liệu Sơ đồ");
                    setLoading(false);
                });
            })
            .catch(err => {
                console.error("Lỗi lấy dữ liệu bản lưu trữ:", err);
                setLoading(false);
            });

    }, [selectedYear, selectedMonth, selectedWeek, setNodes, setEdges]);

    useEffect(() => {
        fetchOrgChartData(false);
    }, [fetchOrgChartData]);

    const handleSaveChart = async () => {
        if (!nodes.length || !edges.length) {
            showToast("error", "Sơ đồ đang trống, không thể lưu.");
            return;
        }

        setIsSaving(true);
        try {
            const res = await fetch("/api/org-chart/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    year: selectedYear,
                    month: selectedMonth,
                    week: selectedWeek,
                    chartData: { nodes, edges }
                })
            });

            if (res.ok) {
                setIsViewingSaved(true);
                setIsUnsavedWarning(false);
                showToast("success", "Đã lưu bản chụp sơ đồ tuần này thành công!");
            } else {
                showToast("error", "Lưu thất bại. Vui lòng thử lại!");
            }
        } catch (error) {
            console.error(error);
            showToast("error", "Lỗi khi lưu sơ đồ.");
        } finally {
            setIsSaving(false);
        }
    };

    const onConnect = useCallback((params: any) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

    return (
        <PermissionGuard moduleId="MENU_ORG_CHART">
            <div className="h-full w-full flex flex-col animate-fade-in bg-white relative overflow-hidden">
                <div className="px-5 py-3 md:px-6 md:py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0 bg-white border-b border-slate-200 z-10 shadow-sm">
                    <div>
                        <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                            <Network className="text-red-600 w-5 h-5 md:w-6 md:h-6" />
                            Sơ Đồ <span className="text-red-600">Tổ Chức</span>
                        </h1>
                        <p className="text-[10px] md:text-xs text-slate-500 font-medium mt-0.5">Dùng 2 ngón tay hoặc con lăn chuột để Zoom. Kéo thả vùng trống để di chuyển.</p>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap sm:flex-nowrap">
                        <div className="bg-slate-100 border border-slate-200 px-2 py-1.5 rounded-lg flex items-center gap-2 shadow-sm flex-1 sm:flex-none">
                            <CalendarDays size={16} className="text-slate-400 ml-1" />
                            <select
                                value={selectedMonth}
                                onChange={(e) => {
                                    setSelectedMonth(Number(e.target.value));
                                    setSelectedWeek(1);
                                }}
                                className="bg-transparent font-bold text-slate-700 text-[11px] md:text-xs outline-none cursor-pointer hover:text-red-600 transition-colors"
                            >
                                {[...Array(12)].map((_, i) => (
                                    <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
                                ))}
                            </select>

                            <span className="text-slate-300 font-medium">/</span>

                            <select
                                value={selectedWeek}
                                onChange={(e) => setSelectedWeek(Number(e.target.value))}
                                className="bg-transparent font-bold text-slate-700 text-[11px] md:text-xs outline-none cursor-pointer hover:text-red-600 transition-colors pr-1"
                            >
                                {getAvailableWeeks(selectedYear, selectedMonth).map((w) => (
                                    <option key={w} value={w}>Tuần {w}</option>
                                ))}
                            </select>

                            {selectedYear && selectedMonth && selectedWeek && (
                                <span className="text-[11px] md:text-xs font-bold text-slate-500 whitespace-nowrap ml-1 border-l border-slate-200 pl-2 hidden md:block">
                                    {getWeekDateRange(selectedYear, selectedMonth, selectedWeek)}
                                </span>
                            )}
                        </div>

                        {isCurrentWeek ? (
                            <span className="bg-blue-100 text-blue-800 border border-blue-200 px-2.5 py-1.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest shadow-sm flex items-center whitespace-nowrap h-[34px]">
                                Đang cập nhật trực tiếp (Live)
                            </span>
                        ) : isViewingSaved ? (
                            <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest shadow-sm flex items-center whitespace-nowrap h-[34px]">
                                Đã lưu bản chụp
                            </span>
                        ) : isUnsavedWarning ? (
                            <span className="bg-rose-100 text-rose-800 border border-rose-200 px-2.5 py-1.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest shadow-sm flex items-center gap-1.5 whitespace-nowrap h-[34px]">
                                <AlertCircle size={14} /> Sơ đồ chưa được lưu
                            </span>
                        ) : (
                            <span className="bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest shadow-sm flex items-center gap-1.5 whitespace-nowrap h-[34px]">
                                <AlertCircle size={14} /> Chưa lưu bản chụp
                            </span>
                        )}

                        <button
                            onClick={() => {
                                if (isUnsavedWarning) {
                                    fetchOrgChartData(true);
                                } else {
                                    handleSaveChart();
                                }
                            }}
                            disabled={loading || isSaving}
                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 h-[34px] rounded-lg flex items-center justify-center gap-1.5 shadow-sm font-bold text-xs md:text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            {isUnsavedWarning ? "Tạo & Hiển thị sơ đồ ngay" : "Lưu Sơ Đồ"}
                        </button>
                    </div>
                </div>

                <div className="flex-1 w-full h-full bg-slate-50 relative z-0">
                    {loading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 font-medium gap-3 bg-white/50 backdrop-blur-sm z-20">
                            <Loader2 size={28} className="animate-spin text-red-500" />
                            <span className="text-sm">Đang tải dữ liệu sơ đồ...</span>
                        </div>
                    ) : isUnsavedWarning ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 font-medium gap-4 bg-white z-20">
                            <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-sm">
                                <AlertCircle size={32} />
                            </div>
                            <div className="text-center">
                                <h2 className="text-lg font-black text-slate-800">Sơ đồ tuần {selectedWeek} tháng {selectedMonth} chưa được lưu</h2>
                                <p className="text-xs text-slate-400 mt-1">Hệ thống chưa ghi nhận bản chụp cấu trúc nhân sự cho tuần này.</p>
                            </div>
                            <button
                                onClick={() => fetchOrgChartData(true)}
                                className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95"
                            >
                                Tạo & Hiển thị sơ đồ ngay
                            </button>
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
                            <Controls className="!bg-white !shadow-md !border-slate-200 !rounded-xl overflow-hidden hidden sm:flex" showInteractive={false} />
                            <MiniMap className="!bg-white !border-slate-200 !rounded-xl !shadow-md hidden md:block" />
                        </ReactFlow>
                    )}
                </div>

                <OrgNodeDrawer
                    isOpen={isDrawerOpen}
                    onClose={() => setIsDrawerOpen(false)}
                    nodeData={selectedNodeData}
                    year={selectedYear}
                    month={selectedMonth}
                    week={selectedWeek}
                    onRefresh={() => fetchOrgChartData(true, true)}
                />
            </div>
        </PermissionGuard>
    );
}