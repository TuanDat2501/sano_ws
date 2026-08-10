// File: src/app/api/tasks/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userData = session.user as any;
    const userId = userData.id;
    const role = userData.role?.toUpperCase();
    const myTeamId = userData.teamId;

    const { searchParams } = new URL(req.url);
    const viewMode = searchParams.get("viewMode") || "board"; 
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    
    // Hứng toàn bộ tham số Lọc
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "ALL";
    const filterChannelId = searchParams.get("channelId") || "ALL"; 
    const filterTeamId = searchParams.get("teamId") || "ALL"; 
    const fromDate = searchParams.get("fromDate") || "";
    const toDate = searchParams.get("toDate") || "";

    const canViewAll = userData.permissions?.includes("MENU_TEAMS") || ["ADMIN", "BAN_GIAM_DOC", "KE_TOAN"].includes(role);
    const isLeader = role === "LEADER" || userData.permissions?.includes("DEPARTMENT_LEADER");

    // 🚀 BƯỚC 1: KHỞI TẠO ĐIỀU KIỆN LỌC ROOT BẰNG MẢNG AND (Để đếm Total Pages chính xác 100%)
    const AND_CONDITIONS: any[] = [];

    // 1.1 Lọc theo phân quyền User
    if (!canViewAll) {
      if (isLeader) {
        AND_CONDITIONS.push({ teamId: myTeamId });
      } else {
        AND_CONDITIONS.push({
            OR: [
                { contentId: userId }, 
                { editorId: userId }, 
                { animatorId: userId }, 
                { publisherId: userId }, 
                { creatorId: userId },
                { coContentUsers: { some: { id: userId } } },
                { coEditorUsers: { some: { id: userId } } },
                { coAnimatorUsers: { some: { id: userId } } }
            ]
        });
      }
    } else {
      if (filterTeamId !== "ALL") {
        AND_CONDITIONS.push({ teamId: filterTeamId });
      }
    }

    // 1.2 Lọc theo Kênh
    if (filterChannelId !== "ALL") {
      AND_CONDITIONS.push({ channelId: filterChannelId });
    }

    // 1.3 Lọc theo Tìm kiếm
    if (search) {
      AND_CONDITIONS.push({ title: { contains: search } });
    }

    // 1.4 Lọc theo Trạng thái
    if (status !== "ALL") {
      AND_CONDITIONS.push({ status: status });
    } else {
      AND_CONDITIONS.push({ status: { not: "BACKLOG" } }); // Board và List không chứa Backlog
    }
    
    // 1.5 Lọc theo Ngày
    if (fromDate || toDate) {
      const dateCondition: any = {};
      if (fromDate) dateCondition.gte = new Date(`${fromDate}T00:00:00.000Z`);
      if (toDate) dateCondition.lte = new Date(`${toDate}T23:59:59.999Z`);
      AND_CONDITIONS.push({ createdAt: dateCondition });
    }

    // Gộp tất cả điều kiện vào whereClause
    const whereClause = AND_CONDITIONS.length > 0 ? { AND: AND_CONDITIONS } : {};

    const priorityWeight: any = { URGENT: 4, HIGH: 3, NORMAL: 2, LOW: 1 };
    
    const includeQuery = {
        creator: { select: { fullName: true } },
        team: { select: { name: true } },
        channel: { select: { name: true } },
        contentUser: { select: { fullName: true, avatarUrl: true } },
        editorUser: { select: { fullName: true, avatarUrl: true } },
        animatorUser: { select: { fullName: true, avatarUrl: true } },
        publisherUser: { select: { fullName: true, avatarUrl: true } },
        coContentUsers: { select: { id: true, fullName: true, avatarUrl: true } },
        coEditorUsers: { select: { id: true, fullName: true, avatarUrl: true } },
        coAnimatorUsers: { select: { id: true, fullName: true, avatarUrl: true } },
    };

    if (viewMode === "board") {
      const tasks = await prisma.task.findMany({
        where: { ...whereClause, isClosed: false }, // Board ẩn task đã đóng
        include: includeQuery,
        orderBy: { createdAt: "desc" },
      });

      tasks.sort((a: any, b: any) => {
        const weightA = priorityWeight[a.priority || "NORMAL"] || 2;
        const weightB = priorityWeight[b.priority || "NORMAL"] || 2;
        if (weightA !== weightB) return weightB - weightA; 
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); 
      });

      return NextResponse.json({ tasks, total: tasks.length, totalPages: 1 });
    }
    else {
      // Dành cho chế độ List (Có phân trang và đếm chuẩn)
      const skip = (page - 1) * limit;

      const [tasks, total] = await Promise.all([
        prisma.task.findMany({
          where: whereClause,
          include: includeQuery,
          orderBy: { createdAt: "desc" },
          skip: skip,
          take: limit, 
        }),
        prisma.task.count({ where: whereClause }) // 🚀 ĐÃ SỬA: Đếm theo đúng điều kiện đã lọc
      ]);

      tasks.sort((a: any, b: any) => {
        const weightA = priorityWeight[a.priority || "NORMAL"] || 2;
        const weightB = priorityWeight[b.priority || "NORMAL"] || 2;
        if (weightA !== weightB) return weightB - weightA; 
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); 
      });

      return NextResponse.json({
        tasks,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      });
    }

  } catch (error: any) {
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}

// ... CÁC ĐOẠN KHÁC TRONG FILE NHƯ GETBASEURL() HAY POST() THÌ SẾP GIỮ NGUYÊN BÊN DƯỚI NHÉ ...