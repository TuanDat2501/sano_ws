import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ==========================================
// 1. API LẤY DANH SÁCH TASK (GET)
// ==========================================
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userData = session.user as any;
    const userId = userData.id;
    const role = userData.role?.toUpperCase();
    const teamId = userData.teamId;

    // 1. LẤY CÁC THAM SỐ TỪ URL (Query Parameters)
    const { searchParams } = new URL(req.url);
    const viewMode = searchParams.get("viewMode") || "board"; // board hoặc list
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "ALL";
    const fromDate = searchParams.get("fromDate") || "";
    const toDate = searchParams.get("toDate") || "";

    // 2. XÂY DỰNG ĐIỀU KIỆN LỌC (WHERE CLAUSE)
    let whereClause: any = {};

    // - Phân quyền Role
    if (role === "ADMIN" || role === "BAN_GIAM_DOC") {
      whereClause = {};
    } else if (role === "LEADER") {
      whereClause = { teamId: teamId };
    } else if (role === "CONTENT" || role === "EDITOR") {
      whereClause = { OR: [{ contentId: userId }, { editorId: userId }, { creatorId: userId }] };
    } else {
      whereClause = { id: "none" };
    }

    // - Lọc theo Tìm kiếm tên Task
    if (search) {
      whereClause.title = { contains: search }; // MySQL mặc định không phân biệt hoa thường
    }

    // - Lọc theo Trạng thái
    if (status !== "ALL") {
      whereClause.status = status;
    }

    // - Lọc theo Khoảng thời gian (Ngày tạo)
    if (fromDate || toDate) {
      whereClause.createdAt = {};
      if (fromDate) whereClause.createdAt.gte = new Date(`${fromDate}T00:00:00.000Z`);
      if (toDate) whereClause.createdAt.lte = new Date(`${toDate}T23:59:59.999Z`);
    }

    // 3. XỬ LÝ TRẢ DỮ LIỆU TÙY THEO TAB ĐANG MỞ
    if (viewMode === "board") {
      // Dành cho Bảng Kanban: Thường lấy tất cả Task CHƯA ĐÓNG để vẽ cột
      const tasks = await prisma.task.findMany({
        where: { ...whereClause, isClosed: false },
        include: {
          creator: { select: { fullName: true } },
          team: { select: { name: true } },
          contentUser: { select: { fullName: true } },
          editorUser: { select: { fullName: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ tasks, total: tasks.length, totalPages: 1 });
    } 
    else {
      // Dành cho Danh sách List: Áp dụng Lọc + PHÂN TRANG (Skip / Take)
      const skip = (page - 1) * limit;

      // Chạy song song 2 lệnh: Lấy dữ liệu cắt trang VÀ Đếm tổng số Task
      const [tasks, total] = await Promise.all([
        prisma.task.findMany({
          where: whereClause,
          include: {
            creator: { select: { fullName: true } },
            team: { select: { name: true } },
            contentUser: { select: { fullName: true } },
            editorUser: { select: { fullName: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: skip,
          take: limit, // Chỉ lấy đúng số lượng cần thiết
        }),
        prisma.task.count({ where: whereClause })
      ]);

      return NextResponse.json({
        tasks,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      });
    }

  } catch (error: any) {
    console.error(">>> LỖI GET TASK:", error);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}


const getBaseUrl = (rawUrl: string) => {
  if (!rawUrl || rawUrl.trim() === "") return "";
  try {
    const urlString = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
    const url = new URL(urlString);
    if (url.hostname.includes('youtube.com')) {
      const v = url.searchParams.get('v');
      return v ? `${url.origin}${url.pathname}?v=${v}` : `${url.origin}${url.pathname}`;
    }
    return url.origin + url.pathname;
  } catch (e) {
    return rawUrl.trim().split('?')[0];
  }
};
// Dán hàm này vào DƯỚI CÙNG của file src/app/api/tasks/route.ts

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, linkContent, contentId, editorId, teamId } = body;
    const creatorId = (session.user as any).id;
    const rawLink = linkContent;
    // 1. RADAR CHẶN TRÙNG LINK
    // =========================================================================
    // 1. RADAR CHẶN TRÙNG LINK THÔNG MINH (So sánh Link Lõi)
    // =========================================================================
    if (rawLink && rawLink.trim() !== "") {
      const baseIncoming = getBaseUrl(rawLink);
      const searchKey = baseIncoming.replace(/^https?:\/\//, ''); // Bỏ http:// để DB dễ quét

      // Bước 1: Quét Database diện rộng tìm các task có chứa Base URL
      const potentialTasks = await prisma.task.findMany({
        where: { linkContent: { contains: searchKey } }
      });

      // Bước 2: Soi kỹ lại bằng JS (Tránh DB nhận diện nhầm URL giống nhau một phần)
      const isDuplicate = potentialTasks.some(task => {
        return task.linkContent && getBaseUrl(task.linkContent) === baseIncoming;
      });

      if (isDuplicate) {
        return NextResponse.json(
          { error: "Link này đã tồn tại trong hệ thống (Có thể do team khác đã nhận)!" }, 
          { status: 400 }
        );
      }
    }

    // 2. TẠO TASK MỚI
    const newTask = await prisma.task.create({
      data: {
        title,
        linkContent : rawLink,
        status: "TODO",
        contentId: contentId || undefined,
        editorId: editorId || undefined,
        teamId: teamId || undefined,
        creatorId: creatorId,
      },
      include: {
        creator: { select: { fullName: true } },
        team: { select: { name: true } },
        contentUser: { select: { fullName: true } },
        editorUser: { select: { fullName: true } },
      }
    });

    // =========================================================================
    // 3. TẠO THÔNG BÁO CHO NGƯỜI ĐƯỢC GIAO VIỆC (CONTENT & EDITOR)
    // =========================================================================
    let createdNotifications: any[] = [];
    
    // Dùng Set để lọc trùng (Nhỡ Content và Editor chọn cùng 1 người)
    const targetIds = new Set<string>();
    
    // Chỉ thông báo nếu có gán người, và người đó KHÔNG PHẢI là người đang tạo task
    if (contentId && contentId !== creatorId) targetIds.add(contentId);
    if (editorId && editorId !== creatorId) targetIds.add(editorId);

    const userIdsToNotify = Array.from(targetIds);

    if (userIdsToNotify.length > 0) {
      createdNotifications = await Promise.all(
        userIdsToNotify.map(targetId =>
          prisma.notification.create({
            data: {
              userId: targetId,
              title: "Task mới được giao",
              message: `🎯 Bạn vừa được giao task: "${title}"`,
              taskId: newTask.id
            }
          })
        )
      );
    }

    // 4. Trả về cho Frontend cả Task mới lẫn Dữ liệu thông báo
    return NextResponse.json({
      task: newTask,
      notifications: createdNotifications,
      userIdsToNotify: userIdsToNotify
    });

  } catch (error: any) {
    console.error(">>> ❌ LỖI POST TASK:", error);
    return NextResponse.json({ error: "Lỗi Server không thể tạo Task" }, { status: 500 });
  }
}