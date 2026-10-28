import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GET as getKpiApi } from "@/app/api/kpi/route"; 

function getCurrentWeekInfo() {
    const d = new Date();
    d.setHours(0,0,0,0);
    const diffToThursday = d.getDay() === 0 ? -3 : 4 - d.getDay();
    const thursday = new Date(d);
    thursday.setDate(d.getDate() + diffToThursday);
    const targetYear = thursday.getFullYear();
    const targetMonth = thursday.getMonth() + 1;
    const firstDayOfMonth = new Date(targetYear, targetMonth - 1, 1);
    const diffToMonday = firstDayOfMonth.getDay() === 0 ? -6 : 1 - firstDayOfMonth.getDay();
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
        const { searchParams } = new URL(req.url);
        
        const year = searchParams.get("year") ? parseInt(searchParams.get("year") as string) : currentInfo.year;
        const month = searchParams.get("month") ? parseInt(searchParams.get("month") as string) : currentInfo.month;
        const currentWeekNumber = searchParams.get("week") ? parseInt(searchParams.get("week") as string) : currentInfo.week;

        // 1. GỌI API LẤY KPI CHUẨN (GIỮ NGUYÊN)
        const kpiUrl = new URL(req.url);
        kpiUrl.searchParams.set("teamId", "ALL");
        kpiUrl.searchParams.set("year", year.toString());
        kpiUrl.searchParams.set("month", month.toString());
        kpiUrl.searchParams.set("week", currentWeekNumber.toString());

        const kpiReq = new Request(kpiUrl.toString(), { method: "GET", headers: req.headers });
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

        // 2. LẤY USER & CHANNEL 
        const users = await prisma.user.findMany({
            where: { isActive: true },
            select: {
                id: true, fullName: true, username: true, role: true, avatarUrl: true, teamId: true,
                team: { select: { name: true } }, 
                isActive: true,
                channelMemberships: {
                    where: { channel: { status: { not: "DUNG_HOAT_DONG" } } },
                    select: { channelId: true, roleOnChannel: true }
                }
            }
        });

        const allChannels = await prisma.channel.findMany({
            select: { id: true, name: true, avatarUrl: true }
        });

        // =========================================================
        // 🚀 3. LOGIC MỚI: ĐỌC DỮ LIỆU BÀI DƯ THỦ CÔNG TỪ BẢNG MỚI
        // =========================================================
        const weeklySurpluses = await prisma.weeklySurplus.findMany({
            where: { year: year, month: month, weekNumber: currentWeekNumber }
        });

        const userSurplusDetails: Record<string, Record<number, number>> = {};
        const userSurplusList: Record<string, any[]> = {};
        const userRawSurplusData: Record<string, any[]> = {}; // Để load ngược lại Form khi sửa

        weeklySurpluses.forEach(ws => {
            const userId = ws.userId;
            const sData: any[] = (ws.surplusData as any[]) || [];
            
            userRawSurplusData[userId] = sData;

            if (!userSurplusDetails[userId]) userSurplusDetails[userId] = {};
            if (!userSurplusList[userId]) userSurplusList[userId] = [];

            sData.forEach((item: any) => {
                const duration = Number(item.duration) || 0;
                const count = Number(item.count) || 0;
                const jobCategory = item.jobCategory || "EDITOR";
                const channelNameInput = (item.channelName || "").trim().toLowerCase();
                
                // Móc kênh tự động từ Text sang UI
                const matchedChannel = allChannels.find(c => c.name.toLowerCase() === channelNameInput);
                const channelId = matchedChannel ? matchedChannel.id : null;
                const channelName = matchedChannel ? matchedChannel.name : (item.channelName || "Kênh chung");
                const channelAvatar = matchedChannel ? matchedChannel.avatarUrl : null;

                userSurplusDetails[userId][duration] = (userSurplusDetails[userId][duration] || 0) + count;

                // Push số bài dư vào Mảng ảo để thuật toán Vẽ Sơ đồ của Frontend tự đếm
                for (let i = 0; i < count; i++) {
                    userSurplusList[userId].push({
                        id: `surplus_${Math.random()}`,
                        title: `Bài dư (${jobCategory})`,
                        duration: duration,
                        channelId: channelId, 
                        channelName: channelName,
                        channelAvatar: channelAvatar,
                        jobCategory: jobCategory
                    });
                }
            });
        });

        // 4. MAP DATA TRẢ VỀ FRONTEND
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
                rawSurplusData: userRawSurplusData[user.id] || [], // Truyền Data thật sang Drawer
                currentWeekStats: {
                    target: userKpi?.targetValue || 0,
                    actual: userKpi?.actualValue || 0,
                    targetDetails: userKpi?.targetDetails || []
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