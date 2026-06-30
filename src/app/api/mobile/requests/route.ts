import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const tab = searchParams.get('tab'); // 'MY_REQUESTS' hoặc 'NEED_APPROVAL'

        const authHeader = req.headers.get("authorization");
        const token = authHeader?.split(" ")[1];
        const secretKey = process.env.NEXTAUTH_SECRET || "sano_super_secret_key_2026";
        
        const decoded = jwt.verify(token!, secretKey) as { id: string, role: string };
        const userId = decoded.id;

        let whereClause = {};

        if (tab === 'NEED_APPROVAL') {
            // 🚀 LOGIC DUYỆT ĐƠN: Chỉ lấy đơn đang đến lượt mình duyệt
            whereClause = {
                OR: [
                    { status: 'PENDING_1', firstApproverId: userId },
                    { status: 'PENDING_2', secondApproverId: userId }
                ]
            };
        } else {
            // Đơn của tôi
            whereClause = { requesterId: userId };
        }

        const requests = await prisma.request.findMany({
            where: whereClause,
            include: {
                requester: { select: { fullName: true, avatarUrl: true } },
                team: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(requests, { status: 200, headers: corsHeaders });

    } catch (error) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }
}