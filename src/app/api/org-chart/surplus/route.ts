import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { userId, year, month, week, surplusData } = body;

        if (!userId || !year || !month || !week) {
            return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
        }

        // Lưu / Ghi đè số liệu bài dư của User trong tuần đó
        const savedSurplus = await prisma.weeklySurplus.upsert({
            where: {
                user_surplus_time_unique: {
                    userId: String(userId),
                    year: Number(year),
                    month: Number(month),
                    weekNumber: Number(week)
                }
            },
            update: {
                surplusData: surplusData
            },
            create: {
                userId: String(userId),
                year: Number(year),
                month: Number(month),
                weekNumber: Number(week),
                surplusData: surplusData
            }
        });

        return NextResponse.json({ success: true, data: savedSurplus });
    } catch (error) {
        console.error("LỖI LƯU BÀI DƯ THỦ CÔNG:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}

// Thêm đoạn này vào cuối file src/app/api/org-chart/surplus/route.ts
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get("userId");
        const year = searchParams.get("year");
        const month = searchParams.get("month");
        const week = searchParams.get("week");

        if (!userId || !year || !month || !week) {
            return NextResponse.json({ data: [] });
        }

        const savedSurplus = await prisma.weeklySurplus.findUnique({
            where: {
                user_surplus_time_unique: {
                    userId: String(userId),
                    year: Number(year),
                    month: Number(month),
                    weekNumber: Number(week)
                }
            }
        });

        if (savedSurplus && savedSurplus.surplusData) {
            return NextResponse.json({ data: savedSurplus.surplusData });
        }

        return NextResponse.json({ data: [] });
    } catch (error) {
        console.error("LỖI LẤY BÀI DƯ:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}