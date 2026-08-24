import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || (session.user as any).role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Truy vấn trạng thái bảo trì trong DB
        const maintenanceSetting = await prisma.systemSetting.findUnique({
            where: { settingKey: "MAINTENANCE_MODE" }
        });

        let isMaintenance = false;
        if (maintenanceSetting && maintenanceSetting.settingValue) {
            const val = maintenanceSetting.settingValue as any;
            isMaintenance = val.enabled === true;
        }

        return NextResponse.json({ isMaintenance });
    } catch (error) {
        console.error("LỖI API LẤY SETTING:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || (session.user as any).role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { isMaintenance } = body;

        // Lưu hoặc Cập nhật vào Database (Bảng SystemSetting)
        const updatedSetting = await prisma.systemSetting.upsert({
            where: { settingKey: "MAINTENANCE_MODE" },
            update: {
                settingValue: { enabled: isMaintenance }
            },
            create: {
                settingKey: "MAINTENANCE_MODE",
                settingValue: { enabled: isMaintenance }
            }
        });

        return NextResponse.json({ success: true, setting: updatedSetting });
    } catch (error) {
        console.error("LỖI API LƯU SETTING:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}