import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const teams = await prisma.team.findMany({
            include: {
                channels: {
                    include: {
                        tasks: {
                            where: { 
                                OR: [{ publishLink: null },{ publishLink: "" }],
                                status: { not: "BACKLOG" }
                            },
                            select: {
                                id: true,
                                title: true,
                                scriptLink: true,
                                animationLink: true,
                                roughProjectLink: true,
                                videoLink: true,
                                publishLink: true,
                                duration: true,
                                note: true
                            }
                        }
                    }
                }
            },
            orderBy: { name: 'asc' }
        });

        const reportData: any[] = [];
        let stt = 1;

        teams.forEach(team => {
            let teamRows: any[] = []; 
            
            team.channels.forEach((channel) => {
                const tasks = channel.tasks || [];

                // 🚀 Lọc task dư: Loại trừ các task đã lên kênh (có Publish Link)
                let surplusTasks = tasks.filter((t: any) => {
                    const hasScript = t.scriptLink && t.scriptLink.trim() !== "";
                    const hasAnim = t.animationLink && t.animationLink.trim() !== "";
                    const hasRough = t.roughProjectLink && t.roughProjectLink.trim() !== "";
                    const hasVideo = t.videoLink && t.videoLink.trim() !== "";
                    const hasPublish = t.publishLink && t.publishLink.trim() !== "";

                    if (hasPublish) return false;
                    return hasScript || hasAnim || hasRough || hasVideo;
                });

                if (surplusTasks.length === 0) {
                    teamRows.push({
                        id: channel.id,
                        channelName: channel.name,
                        isFirstOfChannel: true,
                        channelRowSpan: 1,
                        duration: "",
                        contentCount: 0,
                        animationCount: 0,
                        roughCount: 0,
                        videoCount: 0,
                        notes: []
                    });
                } else {
                    const durationGroups: Record<string, any> = {};
                    
                    surplusTasks.forEach((t: any) => {
                        const d = t.duration || "Không rõ";
                        if (!durationGroups[d]) {
                            durationGroups[d] = { 
                                contentCount: 0, animationCount: 0, roughCount: 0, videoCount: 0, 
                                contentTasks: [], animationTasks: [], roughTasks: [], videoTasks: [], 
                                notesCount: {} 
                            };
                        }
                        
                        const hasScript = t.scriptLink && t.scriptLink.trim() !== "";
                        const hasAnim = t.animationLink && t.animationLink.trim() !== "";
                        const hasRough = t.roughProjectLink && t.roughProjectLink.trim() !== "";
                        const hasVideo = t.videoLink && t.videoLink.trim() !== "";
                        
                        // 🚀 Phân loại theo mức độ hoàn thiện cao nhất
                        if (hasVideo) {
                            durationGroups[d].videoCount++;
                            durationGroups[d].videoTasks.push({ id: t.id, title: t.title });
                        } else if (hasRough) {
                            durationGroups[d].roughCount++;
                            durationGroups[d].roughTasks.push({ id: t.id, title: t.title });
                        } else if (hasAnim) {
                            durationGroups[d].animationCount++;
                            durationGroups[d].animationTasks.push({ id: t.id, title: t.title });
                        } else if (hasScript) {
                            durationGroups[d].contentCount++;
                            durationGroups[d].contentTasks.push({ id: t.id, title: t.title });
                        }
                        
                        if (t.note && t.note.trim() !== "") {
                            const cleanNote = t.note.trim();
                            durationGroups[d].notesCount[cleanNote] = (durationGroups[d].notesCount[cleanNote] || 0) + 1;
                        }
                    });

                    const durations = Object.keys(durationGroups).sort((a,b) => {
                        if (a === "Không rõ") return 1;
                        if (b === "Không rõ") return -1;
                        return Number(a) - Number(b);
                    });

                    durations.forEach((d, dIdx) => {
                        const group = durationGroups[d];
                        const noteStrings = Object.entries(group.notesCount).map(([note, count]) => `${note}: ${count}`);
                        
                        teamRows.push({
                            id: `${channel.id}-${d}`,
                            channelName: channel.name,
                            isFirstOfChannel: dIdx === 0, 
                            channelRowSpan: durations.length, 
                            
                            duration: d === "Không rõ" ? "" : d,

                            contentCount: group.contentCount,
                            contentTasks: group.contentTasks,
                            
                            animationCount: group.animationCount,
                            animationTasks: group.animationTasks,
                            
                            roughCount: group.roughCount,
                            roughTasks: group.roughTasks,
                            
                            videoCount: group.videoCount,
                            videoTasks: group.videoTasks, 
                            
                            notes: noteStrings
                        });
                    });
                }
            });

            if (teamRows.length > 0) {
                teamRows.forEach((row, rIdx) => {
                    reportData.push({
                        ...row,
                        teamName: team.name,
                        stt: rIdx === 0 ? stt++ : "", 
                        isFirstChannelOfTeam: rIdx === 0, 
                        teamRowSpan: teamRows.length 
                    });
                });
            }
        });

        return NextResponse.json(reportData);
    } catch (error) {
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}