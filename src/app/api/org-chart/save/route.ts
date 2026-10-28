import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { year, month, week, chartData } = body;

        if (!year || !month || !week || !chartData) {
            return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
        }

        // Dùng upsert: Nếu đã tồn tại bản ghi của tuần này thì Cập nhật, chưa có thì Tạo mới
        const savedChart = await prisma.weeklyOrgChart.upsert({
            where: {
                orgchart_time_unique: {
                    year: Number(year),
                    month: Number(month),
                    weekNumber: Number(week)
                }
            },
            update: {
                chartData: chartData,
                savedById: session.user.id
            },
            create: {
                year: Number(year),
                month: Number(month),
                weekNumber: Number(week),
                chartData: chartData,
                savedById: session.user.id
            }
        });

        return NextResponse.json({ success: true, data: savedChart });

    } catch (error) {
        console.error("LỖI LƯU SƠ ĐỒ:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const year = searchParams.get("year");
        const month = searchParams.get("month");
        const week = searchParams.get("week");

        if (!year || !month || !week) {
            return NextResponse.json({ data: null });
        }

        const savedChart = await prisma.weeklyOrgChart.findUnique({
            where: {
                orgchart_time_unique: {
                    year: Number(year),
                    month: Number(month),
                    weekNumber: Number(week)
                }
            }
        });

        return NextResponse.json({ data: savedChart });
    } catch (error) {
        console.error("LỖI LẤY SƠ ĐỒ LƯU TRỮ:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}