// File: src/app/api/tasks/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

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

    // 🚀 ĐÃ SỬA: Đọc quyền động từ permissions thay vì fix cứng Role
    const canViewAll = userData.permissions?.includes("MENU_TEAMS") || ["ADMIN", "BAN_GIAM_DOC"].includes(role);
    const isLeader = role === "LEADER" || userData.permissions?.includes("DEPARTMENT_LEADER");

    if (canViewAll) {
      whereClause = {};
    } else if (isLeader) {
      whereClause = { teamId: teamId };
    } else {
      // Logic bao trùm tự động cho tất cả nhân sự (Content, Editor, Animator...)
      whereClause = { OR: [{ contentId: userId }, { editorId: userId }, { animatorId: userId }, { creatorId: userId }] };
    }

    // - Lọc theo Tìm kiếm tên Task
    if (search) {
      whereClause.title = { contains: search }; // MySQL mặc định không phân biệt hoa thường
    }

    // - Lọc theo Trạng thái
    if (status !== "ALL") {
      whereClause.status = status;
    } else {
      // Nếu bộ lọc là ALL, lấy tất cả NGOẠI TRỪ Backlog
      whereClause.status = { not: "BACKLOG" };
    }
    
    // - Lọc theo Khoảng thời gian (Ngày tạo)
    if (fromDate || toDate) {
      whereClause.createdAt = {};
      if (fromDate) whereClause.createdAt.gte = new Date(`${fromDate}T00:00:00.000Z`);
      if (toDate) whereClause.createdAt.lte = new Date(`${toDate}T23:59:59.999Z`);
    }

    // 3. XỬ LÝ TRẢ DỮ LIỆU TÙY THEO TAB ĐANG MỞ
    const priorityWeight: any = { URGENT: 4, HIGH: 3, NORMAL: 2, LOW: 1 };
    
    if (viewMode === "board") {
      // Dành cho Bảng Kanban: Thường lấy tất cả Task CHƯA ĐÓNG để vẽ cột
      const tasks = await prisma.task.findMany({
        where: { ...whereClause, isClosed: false },
        include: {
          creator: { select: { fullName: true } },
          team: { select: { name: true } },
          contentUser: { select: { fullName: true, avatarUrl: true } },
          editorUser: { select: { fullName: true, avatarUrl: true } },
          channel: { select: { name: true } },
          animatorUser: { select: { fullName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      // BỔ SUNG: Thuật toán sắp xếp Task Ưu tiên lên đầu
      tasks.sort((a: any, b: any) => {
        const weightA = priorityWeight[a.priority || "NORMAL"] || 2;
        const weightB = priorityWeight[b.priority || "NORMAL"] || 2;
        if (weightA !== weightB) return weightB - weightA; // Điểm cao (Gấp) xếp trước
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); // Cùng điểm thì mới nhất xếp trước
      });

      return NextResponse.json({ tasks, total: tasks.length, totalPages: 1 });
    }
    else {
      const skip = (page - 1) * limit;

      const [tasks, total] = await Promise.all([
        prisma.task.findMany({
          where: whereClause,
          include: {
            creator: { select: { fullName: true } },
            team: { select: { name: true } },
            contentUser: { select: { fullName: true, avatarUrl: true } },
            editorUser: { select: { fullName: true, avatarUrl: true } },
            channel: { select: { name: true } }
          },
          orderBy: { createdAt: "desc" },
          skip: skip,
          take: limit, 
        }),
        prisma.task.count({ where: whereClause })
      ]);

      // BỔ SUNG: Sắp xếp cho cả List View
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

// ==========================================
// 2. API TẠO TASK (POST)
// ==========================================
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUser = session.user as any;
    
    // 🚀 BỔ SUNG: Chốt chặn an toàn cho hàm tạo Task (Sử dụng quyền ACTION_CREATE_TASK)
    const canCreateTask = currentUser.permissions?.includes("ACTION_CREATE_TASK") || ["ADMIN", "BAN_GIAM_DOC", "LEADER"].includes(currentUser.role);
    
    if (!canCreateTask) {
        return NextResponse.json({ error: "Bạn không có quyền tạo Task!" }, { status: 403 });
    }

    const body = await req.json();
    const { title, linkContent, contentId, editorId, teamId, projectId } = body;
    const creatorId = currentUser.id;
    const rawLink = linkContent;
    
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

    // 🚀 LOGIC TỰ ĐỘNG TÍNH SỐ TẬP (EPISODE NUMBER)
    let nextEpisodeNumber = null;

    if (projectId) {
        // Nếu Task thuộc về 1 Project (Series), tìm số tập to nhất hiện tại
        const lastTask = await prisma.task.findFirst({
            where: { 
                projectId: projectId,
                episodeNumber: { not: null }
            },
            orderBy: { episodeNumber: 'desc' },
            select: { episodeNumber: true }
        });
        
        // Tự động cộng 1, nếu là video đầu tiên thì bắt đầu từ 1
        nextEpisodeNumber = (lastTask?.episodeNumber || 0) + 1;
    }

    // 2. TẠO TASK MỚI
    const newTask = await prisma.task.create({
      data: {
        title,
        linkContent: rawLink,
        status: body.status ? body.status : "TODO",
        episodeNumber: nextEpisodeNumber,
        contentId: contentId || undefined,
        editorId: editorId || undefined,
        teamId: teamId || undefined,
        creatorId: creatorId,
        projectId: projectId || undefined,
        channelId: body.channelId || undefined,
        duration: body.duration || undefined,
        note: body.note || undefined,
        keywords: body.keywords || undefined,
        publishDate: body.publishDate ? new Date(body.publishDate) : undefined,
        animatorId: body.animatorId || undefined,
        priority: body.priority || undefined,
        englishScriptLink: body.englishScriptLink || undefined,
        storyboardLink: body.storyboardLink || undefined,
        audioLink: body.audioLink || undefined,
        thumbnailLink: body.thumbnailLink || undefined,
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