// File: src/app/api/tasks/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

// ==========================================
// 1. API LẤY DANH SÁCH TASK (GET) - Giữ nguyên bản chuẩn đếm trang
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
    
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "ALL";
    const filterChannelId = searchParams.get("channelId") || "ALL"; 
    const filterTeamId = searchParams.get("teamId") || "ALL"; 
    const fromDate = searchParams.get("fromDate") || "";
    const toDate = searchParams.get("toDate") || "";

    const canViewAll = userData.permissions?.includes("MENU_TEAMS") || ["ADMIN", "BAN_GIAM_DOC", "KE_TOAN"].includes(role);
    const isLeader = role === "LEADER" || userData.permissions?.includes("DEPARTMENT_LEADER");

    const AND_CONDITIONS: any[] = [];

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

    if (filterChannelId !== "ALL") AND_CONDITIONS.push({ channelId: filterChannelId });
    if (search) AND_CONDITIONS.push({ title: { contains: search } });
    
    if (status !== "ALL") {
      AND_CONDITIONS.push({ status: status });
    } else {
      AND_CONDITIONS.push({ status: { not: "BACKLOG" } }); 
    }
    
    if (fromDate || toDate) {
      const dateCondition: any = {};
      if (fromDate) dateCondition.gte = new Date(`${fromDate}T00:00:00.000Z`);
      if (toDate) dateCondition.lte = new Date(`${toDate}T23:59:59.999Z`);
      AND_CONDITIONS.push({ createdAt: dateCondition });
    }

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
        where: { ...whereClause, isClosed: false },
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
      const skip = (page - 1) * limit;
      const [tasks, total] = await Promise.all([
        prisma.task.findMany({
          where: whereClause,
          include: includeQuery,
          orderBy: { createdAt: "desc" },
          skip: skip,
          take: limit, 
        }),
        prisma.task.count({ where: whereClause }) 
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
    
    if (!canCreateTask) return NextResponse.json({ error: "Bạn không có quyền tạo Task!" }, { status: 403 });

    const body = await req.json();
    
    // 🚀 ĐÃ SỬA: Đón toàn bộ các trường Link và cờ isRework
    const { 
        title, linkContent, teamId, projectId, channelId, duration, note, keywords, publishDate, priority,
        scriptLink, englishScriptLink, storyboardLink, audioLink, thumbnailLink, videoLink, publishLink, linkProject, roughProjectLink, animationLink,
        publisherId, isRework,
        contentIds = [], editorIds = [], animatorIds = [] 
    } = body;
    
    const creatorId = currentUser.id;
    const rawLink = linkContent;

    let nextEpisodeNumber = null;
    if (projectId) {
        const lastTask = await prisma.task.findFirst({
            where: { projectId: projectId, episodeNumber: { not: null } },
            orderBy: { episodeNumber: 'desc' },
            select: { episodeNumber: true }
        });
        nextEpisodeNumber = (lastTask?.episodeNumber || 0) + 1;
    }

    const mainContentId = contentIds.length > 0 ? contentIds[0] : undefined;
    const mainEditorId = editorIds.length > 0 ? editorIds[0] : undefined;
    const mainAnimatorId = animatorIds.length > 0 ? animatorIds[0] : undefined;

    const coContentConnect = contentIds.length > 1 ? contentIds.slice(1).map((id: string) => ({ id })) : [];
    const coEditorConnect = editorIds.length > 1 ? editorIds.slice(1).map((id: string) => ({ id })) : [];
    const coAnimatorConnect = animatorIds.length > 1 ? animatorIds.slice(1).map((id: string) => ({ id })) : [];

    // 🚀 ĐÃ SỬA: Bổ sung đẩy Link cũ và isRework vào Database
    const newTask = await prisma.task.create({
      data: {
        title,
        linkContent: rawLink,
        status: body.status ? body.status : "TODO",
        episodeNumber: nextEpisodeNumber,
        isRework: Boolean(isRework), 
        
        contentId: mainContentId,
        editorId: mainEditorId,
        animatorId: mainAnimatorId,
        
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
        
        scriptLink: scriptLink || undefined,
        englishScriptLink: englishScriptLink || undefined,
        storyboardLink: storyboardLink || undefined,
        audioLink: audioLink || undefined,
        thumbnailLink: thumbnailLink || undefined,
        videoLink: videoLink || undefined,
        publishLink: publishLink || undefined,
        linkProject: linkProject || undefined,
        roughProjectLink: roughProjectLink || undefined,
        animationLink: animationLink || undefined,
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

    let createdNotifications: any[] = [];
    const targetIds = new Set<string>();

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
    return NextResponse.json({ error: "Lỗi Server không thể tạo Task" }, { status: 500 });
  }
}