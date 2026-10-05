import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// 🚀 IMPORT HÀM GET TỪ API KPI CỦA BẠN (Sửa lại đường dẫn này cho đúng với dự án)
import { GET as getKpiApi } from "@/app/api/kpi/route"; 

function getCurrentWeekInfo() {
    const d = new Date();
    d.setHours(0,0,0,0);
    const dayOfWeek = d.getDay();
    const diffToThursday = dayOfWeek === 0 ? -3 : 4 - dayOfWeek;
    const thursday = new Date(d);
    thursday.setDate(d.getDate() + diffToThursday);
    
    const targetYear = thursday.getFullYear();
    const targetMonth = thursday.getMonth() + 1;
    
    const firstDayOfMonth = new Date(targetYear, targetMonth - 1, 1);
    const firstDayOfWeek = firstDayOfMonth.getDay();
    const diffToMonday = firstDayOfWeek === 0 ? -6 : 1 - firstDayOfWeek;
    const startOfFirstWeek = new Date(targetYear, targetMonth - 1, 1 + diffToMonday);
    
    const thursdayOfFirstWeek = new Date(startOfFirstWeek);
    thursdayOfFirstWeek.setDate(startOfFirstWeek.getDate() + 3);
    if (thursdayOfFirstWeek.getMonth() !== targetMonth - 1) {
        startOfFirstWeek.setDate(startOfFirstWeek.getDate() + 7);
    }
    
    const diffTime = d.getTime() - startOfFirstWeek.getTime();
    const weekNumber = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000)) + 1;
    
    return { year: targetYear, month: targetMonth, week: weekNumber > 0 ? weekNumber : 1 };
}

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const currentInfo = getCurrentWeekInfo();
        const year = currentInfo.year;
        const month = currentInfo.month;
        const currentWeekNumber = currentInfo.week;

        // =========================================================
        // 1. GỌI API KPI ĐỂ LẤY SỐ LIỆU CHUẨN MỚI NHẤT
        // =========================================================
        const kpiUrl = new URL(req.url);
        kpiUrl.searchParams.set("teamId", "ALL");
        kpiUrl.searchParams.set("year", year.toString());
        kpiUrl.searchParams.set("month", month.toString());
        kpiUrl.searchParams.set("week", currentWeekNumber.toString());

        const kpiReq = new Request(kpiUrl.toString(), {
            method: "GET",
            headers: req.headers,
        });

        let kpiList: any[] = [];
        try {
            const kpiRes = await getKpiApi(kpiReq);
            if (kpiRes.ok) {
                const kpiData = await kpiRes.json();
                kpiList = kpiData.kpiList || [];
            }
        } catch (error) {
            console.error("Lỗi khi gọi nội bộ API KPI:", error);
        }

        // =========================================================
        // 2. LẤY DỮ LIỆU USER & HÀNG TỒN (Chỉ dành riêng cho Chart)
        // =========================================================
        const users = await prisma.user.findMany({
            where: { isActive: true },
            select: {
                id: true, fullName: true, username: true, role: true, avatarUrl: true, teamId: true,
                team: { select: { name: true } }, isActive: true,
                channelMemberships: {
                    where: { channel: { status: { not: "DUNG_HOAT_DONG" } } },
                    select: { channelId: true, roleOnChannel: true }
                }
            }
        });

        const surplusTasks = await prisma.task.findMany({
            where: {
                isClosed: false,
                OR: [{ publishLink: null }, { publishLink: "" }],
                status: { not: "BACKLOG" }
            },
            select: {
                id: true, title: true, status: true, // 🚀 Bổ sung lấy Status
                channelId: true,
                contentId: true, editorId: true, animatorId: true, duration: true,
                coContentUsers: { select: { id: true } },
                coEditorUsers: { select: { id: true } },
                coAnimatorUsers: { select: { id: true } },
                // 🚀 Bổ sung đầy đủ các trường Link để soi chiếu
                scriptLink: true, storyboardLink: true, englishScriptLink: true, audioLink: true, 
                animationLink: true, roughProjectLink: true, videoLink: true, publishLink: true, 
                channel: { select: { name: true, avatarUrl: true } } 
            }
        });

        const userSurplusDetails: Record<string, Record<number, number>> = {};
        const userSurplusList: Record<string, any[]> = {}; 
        
        surplusTasks.forEach(t => {
            const hasPublish = t.publishLink && t.publishLink.trim() !== "";
            if (hasPublish) return; // Nếu đã đăng -> Loại luôn, không tính là hàng tồn

            // Bóc tách trạng thái các Link
            const hasVideo = t.videoLink && t.videoLink.trim() !== "";
            const hasRough = t.roughProjectLink && t.roughProjectLink.trim() !== "";
            const hasAudio = t.audioLink && t.audioLink.trim() !== "";
            const hasAnim = t.animationLink && t.animationLink.trim() !== "";
            const hasScript = (t.scriptLink && t.scriptLink.trim() !== "") || 
                              (t.storyboardLink && t.storyboardLink.trim() !== "") || 
                              (t.englishScriptLink && t.englishScriptLink.trim() !== "");

            // Bóc tách Status
            const isDone = t.status === "DONE";
            const isEditPhase = t.status === "EDIT_DOING" || t.status === "EDIT_REVIEW";
            const isAnimPhase = t.status === "ANIMATION_DOING" || t.status === "ANIMATION_REVIEW";

            const duration = t.duration || 0;
            const involvedIds = new Set<string>();
            
            // 🚀 LOGIC PHÂN TẦNG (WATERFALL): Khâu sau đè khâu trước
            // 1. Nằm ở khâu EDIT: Trạng thái Done/Edit Hoặc đã nộp Audio/Rough/Video
            if (isDone || isEditPhase || hasVideo || hasRough || hasAudio) {
                if (t.editorId) involvedIds.add(t.editorId);
                t.coEditorUsers.forEach((u: any) => involvedIds.add(u.id));
            }
            // 2. Nằm ở khâu ANIMATION: Trạng thái Anim Hoặc có link Anim
            else if (isAnimPhase || hasAnim) {
                if (t.animatorId) involvedIds.add(t.animatorId);
                t.coAnimatorUsers.forEach((u: any) => involvedIds.add(u.id));
            }
            // 3. Nằm ở khâu CONTENT: Chỉ mới có Kịch bản / Bố cục
            else if (hasScript) {
                if (t.contentId) involvedIds.add(t.contentId);
                t.coContentUsers.forEach((u: any) => involvedIds.add(u.id));
            }
            
            // Bơm vào kết quả của nhân sự tương ứng
            involvedIds.forEach(id => {
                if (!userSurplusDetails[id]) userSurplusDetails[id] = {};
                userSurplusDetails[id][duration] = (userSurplusDetails[id][duration] || 0) + 1;

                if (!userSurplusList[id]) userSurplusList[id] = [];
                userSurplusList[id].push({
                    id: t.id,
                    title: t.title,
                    duration: duration,
                    channelId: t.channelId, 
                    channelName: t.channel?.name || "Chưa phân kênh",
                    channelAvatar: t.channel?.avatarUrl || null 
                });
            });
        });

        // =========================================================
        // 3. MAP DATA ĐỂ TRẢ VỀ CHO SƠ ĐỒ
        // =========================================================
        const formattedUsers = users.map(user => {
            const userKpi = kpiList.find(k => k.userId === user.id);

            const sData = userSurplusDetails[user.id] || {};
            const surplusDetails = Object.entries(sData)
                .map(([dur, count]) => ({ duration: Number(dur), count: count as number }))
                .sort((a, b) => b.duration - a.duration); 

            return {
                id: user.id,
                fullName: user.fullName,
                username: user.username,
                role: user.role,
                avatarUrl: user.avatarUrl,
                teamId: user.teamId,
                teamName: user.team?.name || null,
                isActive: user.isActive,
                channelMemberships: user.channelMemberships,
                surplusDetails: surplusDetails, 
                surplusTaskList: userSurplusList[user.id] || [], 
                currentWeekStats: {
                    target: userKpi?.targetValue || 0,
                    actual: userKpi?.actualValue || 0
                }
            };
        });

        formattedUsers.sort((a, b) => {
            if (a.role === 'LEADER' && b.role !== 'LEADER') return -1;
            if (a.role !== 'LEADER' && b.role === 'LEADER') return 1;
            return 0;
        });

        return NextResponse.json(formattedUsers);

    } catch (error) {
        console.error("LỖI API ORG-CHART:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}