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
                                id: true,       // 🚀 BỔ SUNG LẤY ID
                                title: true,    // 🚀 BỔ SUNG LẤY TIÊU ĐỀ
                                scriptLink: true,
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
            let teamRows: any[] = []; // Mảng chứa các dòng của 1 Team
            
            team.channels.forEach((channel) => {
                const tasks = channel.tasks || [];

                // Lọc ra các task dư (Content dư HOẶC Video dư)
                let surplusTasks = tasks.filter((t: any) => {
                    const isContent = t.scriptLink && t.scriptLink.trim() !== "" && (!t.videoLink || t.videoLink.trim() === "");
                    const isVideo = t.videoLink && t.videoLink.trim() !== "" && (!t.publishLink || t.publishLink.trim() === "");
                    return isContent || isVideo;
                });

                if (surplusTasks.length === 0) {
                    teamRows.push({
                        id: channel.id,
                        channelName: channel.name,
                        isFirstOfChannel: true,
                        channelRowSpan: 1,
                        videoCount: 0,
                        videoDuration: "",
                        contentCount: 0,
                        contentDuration: "",
                        notes: []
                    });
                } else {
                    // 🚀 BƯỚC QUAN TRỌNG: GOM NHÓM THEO THỜI LƯỢNG (DURATION)
                    const durationGroups: Record<string, any> = {};
                    
                    surplusTasks.forEach((t: any) => {
                        const d = t.duration || "Không rõ";
                        if (!durationGroups[d]) {
                            // 🚀 Thêm mảng videoTasks và contentTasks để chứa thông tin chi tiết
                            durationGroups[d] = { videoCount: 0, contentCount: 0, notesCount: {}, videoTasks: [], contentTasks: [] };
                        }
                        
                        const isContent = t.scriptLink && t.scriptLink.trim() !== "" && (!t.videoLink || t.videoLink.trim() === "");
                        const isVideo = t.videoLink && t.videoLink.trim() !== "" && (!t.publishLink || t.publishLink.trim() === "");
                        
                        // 🚀 Vừa đếm số lượng, vừa nhét thông tin bài vào mảng chi tiết
                        if (isContent) {
                            durationGroups[d].contentCount++;
                            durationGroups[d].contentTasks.push({ id: t.id, title: t.title });
                        }
                        if (isVideo) {
                            durationGroups[d].videoCount++;
                            durationGroups[d].videoTasks.push({ id: t.id, title: t.title });
                        }
                        
                        if (t.note && t.note.trim() !== "") {
                            const cleanNote = t.note.trim();
                            durationGroups[d].notesCount[cleanNote] = (durationGroups[d].notesCount[cleanNote] || 0) + 1;
                        }
                    });

                    // Sắp xếp các thời lượng từ nhỏ đến lớn
                    const durations = Object.keys(durationGroups).sort((a,b) => {
                        if (a === "Không rõ") return 1;
                        if (b === "Không rõ") return -1;
                        return Number(a) - Number(b);
                    });

                    // Chẻ thành nhiều dòng dựa trên số lượng nhóm Thời lượng
                    durations.forEach((d, dIdx) => {
                        const group = durationGroups[d];
                        const noteStrings = Object.entries(group.notesCount).map(([note, count]) => `${note}: ${count}`);
                        
                        teamRows.push({
                            id: `${channel.id}-${d}`,
                            channelName: channel.name,
                            isFirstOfChannel: dIdx === 0, 
                            channelRowSpan: durations.length, 
                            
                            videoCount: group.videoCount,
                            videoTasks: group.videoTasks, // 🚀 Trả về danh sách chi tiết Video dư
                            videoDuration: d === "Không rõ" ? "" : d,
                            
                            contentCount: group.contentCount,
                            contentTasks: group.contentTasks, // 🚀 Trả về danh sách chi tiết Content dư
                            contentDuration: d === "Không rõ" ? "" : d,
                            
                            notes: noteStrings
                        });
                    });
                }
            });

            // Gắn dữ liệu Team vào và đẩy ra kết quả cuối cùng
            if (teamRows.length > 0) {
                teamRows.forEach((row, rIdx) => {
                    reportData.push({
                        ...row,
                        teamName: team.name,
                        stt: rIdx === 0 ? stt++ : "", // STT chỉ hiện ở dòng đầu của Team
                        isFirstChannelOfTeam: rIdx === 0, // Đánh dấu dòng đầu của Team
                        teamRowSpan: teamRows.length // Gộp ô theo toàn bộ số dòng của Team đó
                    });
                });
            }
        });

        return NextResponse.json(reportData);
    } catch (error) {
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}