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
    
    const canCreateTask = currentUser.permissions?.includes("ACTION_CREATE_TASK") || ["ADMIN", "BAN_GIAM_DOC", "LEADER"].includes(currentUser.role);
    
    if (!canCreateTask) {
        return NextResponse.json({ error: "Bạn không có quyền tạo Task!" }, { status: 403 });
    }

    const body = await req.json();
    
    // 🚀 ĐÃ SỬA: Bắt dữ liệu dạng mảng (Array) từ Frontend gửi lên
    const { 
        title, linkContent, teamId, projectId, channelId, duration, note, keywords, publishDate, priority,
        englishScriptLink, storyboardLink, audioLink, thumbnailLink, publisherId,
        contentIds = [], editorIds = [], animatorIds = [] 
    } = body;
    
    const creatorId = currentUser.id;
    const rawLink = linkContent;
    
    // 1. RADAR CHẶN TRÙNG LINK THÔNG MINH
    if (rawLink && rawLink.trim() !== "") {
      const baseIncoming = getBaseUrl(rawLink);
      const searchKey = baseIncoming.replace(/^https?:\/\//, ''); 

      const potentialTasks = await prisma.task.findMany({
        where: { linkContent: { contains: searchKey } }
      });

      /* const isDuplicate = potentialTasks.some(task => {
        return task.linkContent && getBaseUrl(task.linkContent) === baseIncoming;
      });

      if (isDuplicate) {
        return NextResponse.json(
          { error: "Link này đã tồn tại trong hệ thống (Có thể do team khác đã nhận)!" },
          { status: 400 }
        );
      } */
    }

    // TÍNH SỐ TẬP (EPISODE NUMBER)
    let nextEpisodeNumber = null;
    if (projectId) {
        const lastTask = await prisma.task.findFirst({
            where: { projectId: projectId, episodeNumber: { not: null } },
            orderBy: { episodeNumber: 'desc' },
            select: { episodeNumber: true }
        });
        nextEpisodeNumber = (lastTask?.episodeNumber || 0) + 1;
    }

    // =========================================================================
    // 🚀 LOGIC TÁCH NGƯỜI LÀM CHÍNH & LÀM PHỤ
    // =========================================================================
    const mainContentId = contentIds.length > 0 ? contentIds[0] : undefined;
    const mainEditorId = editorIds.length > 0 ? editorIds[0] : undefined;
    const mainAnimatorId = animatorIds.length > 0 ? animatorIds[0] : undefined;

    const coContentConnect = contentIds.length > 1 ? contentIds.slice(1).map((id: string) => ({ id })) : [];
    const coEditorConnect = editorIds.length > 1 ? editorIds.slice(1).map((id: string) => ({ id })) : [];
    const coAnimatorConnect = animatorIds.length > 1 ? animatorIds.slice(1).map((id: string) => ({ id })) : [];

    // 2. TẠO TASK MỚI
    const newTask = await prisma.task.create({
      data: {
        title,
        linkContent: rawLink,
        status: body.status ? body.status : "TODO",
        episodeNumber: nextEpisodeNumber,
        
        // Gán người làm chính
        contentId: mainContentId,
        editorId: mainEditorId,
        animatorId: mainAnimatorId,
        
        // Gán những người làm chung (Mảng connect)
        ...(coContentConnect.length > 0 && { coContentUsers: { connect: coContentConnect } }),
        ...(coEditorConnect.length > 0 && { coEditorUsers: { connect: coEditorConnect } }),
        ...(coAnimatorConnect.length > 0 && { coAnimatorUsers: { connect: coAnimatorConnect } }),

        teamId: teamId || undefined,
        creatorId: creatorId,
        projectId: projectId || undefined,
        channelId: channelId || undefined,
        duration: duration || undefined,
        note: note || undefined,
        keywords: keywords || undefined,
        publishDate: publishDate ? new Date(publishDate) : undefined,
        priority: priority || undefined,
        englishScriptLink: englishScriptLink || undefined,
        storyboardLink: storyboardLink || undefined,
        audioLink: audioLink || undefined,
        thumbnailLink: thumbnailLink || undefined,
        publisherId: publisherId || undefined
      },
      include: {
        creator: { select: { fullName: true } },
        team: { select: { name: true } },
        contentUser: { select: { fullName: true } },
        editorUser: { select: { fullName: true } },
        animatorUser: { select: { fullName: true } },
        publisherUser:{ select: { fullName: true } },
        coContentUsers: { select: { fullName: true } },
        coEditorUsers: { select: { fullName: true } },
        coAnimatorUsers: { select: { fullName: true } },
      }
    });

    // =========================================================================
    // 3. TẠO THÔNG BÁO CHO TẤT CẢ NHỮNG NGƯỜI ĐƯỢC GIAO VIỆC
    // =========================================================================
    let createdNotifications: any[] = [];
    const targetIds = new Set<string>();

    // Gộp tất cả ID của những người tham gia vào Set để báo Noti một lượt
    [...contentIds, ...editorIds, ...animatorIds, publisherId].forEach(id => {
        if (id && id !== creatorId) targetIds.add(id);
    });

    const userIdsToNotify = Array.from(targetIds);

    if (userIdsToNotify.length > 0) {
      createdNotifications = await Promise.all(
        userIdsToNotify.map(targetId =>
          prisma.notification.create({
            data: {
              userId: targetId,
              title: "Task mới được giao",
              message: `🎯 Bạn vừa được giao tham gia task: "${title}"`,
              taskId: newTask.id
            }
          })
        )
      );
    }

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