// File: src/app/api/tasks/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Role } from "@prisma/client";

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

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        const userId = (session?.user as any)?.id;
        const currentUser = session?.user as any;
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const resolvedParams = await params;
        const taskId = resolvedParams.id;
        const rawBody = await req.json();

        // 1. LẤY THÔNG TIN TASK CŨ ĐỂ SO SÁNH
        const oldTask = await prisma.task.findUnique({ where: { id: taskId } });
        if (!oldTask) return NextResponse.json({ error: "Task không tồn tại" }, { status: 404 });

        // =========================================================================
        // 🚀 BƯỚC 1.5: BỘ LỌC QUYỀN (RBAC) - TẠO BODY SẠCH
        // =========================================================================
        const body: any = {};
        
        // 🚀 ĐÃ SỬA: Đọc quyền động từ permissions thay vì fix cứng Role
        const isManager = currentUser.permissions?.includes("ACTION_CREATE_TASK") || ["ADMIN", "BAN_GIAM_DOC", "LEADER", "HR"].includes(currentUser.role);

        // 🚀 BỔ SUNG LOGIC: Chặn nhân sự thường sửa đổi khi Task đã đóng (Nghiệm thu)
        if (!isManager && oldTask.isClosed) {
            return NextResponse.json({ error: "Task đã nghiệm thu, không thể chỉnh sửa!" }, { status: 403 });
        }

        if (isManager) {
            // Sếp được sửa full
            if (rawBody.title !== undefined) body.title = rawBody.title;
            if (rawBody.keywords !== undefined) body.keywords = rawBody.keywords;
            if (rawBody.linkContent !== undefined) body.linkContent = rawBody.linkContent;
            if (rawBody.status !== undefined) body.status = rawBody.status;
            if (rawBody.scriptLink !== undefined) body.scriptLink = rawBody.scriptLink;
            if (rawBody.englishScriptLink !== undefined) body.englishScriptLink = rawBody.englishScriptLink;
            if (rawBody.audioLink !== undefined) body.audioLink = rawBody.audioLink;
            if (rawBody.storyboardLink !== undefined) body.storyboardLink = rawBody.storyboardLink;
            if (rawBody.thumbnailLink !== undefined) body.thumbnailLink = rawBody.thumbnailLink;
            if (rawBody.videoLink !== undefined) body.videoLink = rawBody.videoLink;
            if (rawBody.publishLink !== undefined) body.publishLink = rawBody.publishLink;
            if (rawBody.isClosed !== undefined) body.isClosed = rawBody.isClosed;
            if (rawBody.teamId !== undefined) body.teamId = rawBody.teamId;
            if (rawBody.animatorId !== undefined) body.animatorId = rawBody.animatorId || null;
            if (rawBody.contentId !== undefined) body.contentId = rawBody.contentId || null;
            if (rawBody.editorId !== undefined) body.editorId = rawBody.editorId || null;
            if (rawBody.projectId !== undefined) body.projectId = rawBody.projectId || null;
            if (rawBody.duration !== undefined) body.duration = rawBody.duration;
            if (rawBody.note !== undefined) body.note = rawBody.note;
            if (rawBody.channelId !== undefined) body.channelId = rawBody.channelId || null;
            if (rawBody.priority !== undefined) body.priority = rawBody.priority;
            if (rawBody.animationLink !== undefined) body.animationLink = rawBody.animationLink;
            if (rawBody.linkProject !== undefined) body.linkProject = rawBody.linkProject;
        } else if (currentUser.role === "CONTENT") {
            if (oldTask.contentId !== currentUser.id && oldTask.creatorId !== currentUser.id && oldTask.animatorId !== currentUser.id) {
                return NextResponse.json({ error: "Bạn không phụ trách nội dung/chuyển động bài này!" }, { status: 403 });
            }
            if (rawBody.status !== undefined) body.status = rawBody.status;
            if (rawBody.scriptLink !== undefined) body.scriptLink = rawBody.scriptLink;
            if (rawBody.animationLink !== undefined) body.animationLink = rawBody.animationLink;
            if (rawBody.englishScriptLink !== undefined) body.englishScriptLink = rawBody.englishScriptLink;
            if (rawBody.note !== undefined) body.note = rawBody.note; 
            if (rawBody.storyboardLink !== undefined) body.storyboardLink = rawBody.storyboardLink;
        } else if (currentUser.role === "EDITOR") {
            if (oldTask.editorId !== currentUser.id && oldTask.animatorId !== currentUser.id) {
                return NextResponse.json({ error: "Bạn không phụ trách dựng/chuyển động bài này!" }, { status: 403 });
            }
            if (rawBody.status !== undefined) body.status = rawBody.status;
            if (rawBody.videoLink !== undefined) body.videoLink = rawBody.videoLink;
            if (rawBody.linkProject !== undefined) body.linkProject = rawBody.linkProject;
            if (rawBody.thumbnailLink !== undefined) body.thumbnailLink = rawBody.thumbnailLink;
            if (rawBody.audioLink !== undefined) body.audioLink = rawBody.audioLink; 
            if (rawBody.note !== undefined) body.note = rawBody.note;

        } else if (currentUser.role === "CHANNEL_MANAGER") {
            if (oldTask.publisherId !== currentUser.id) {
                return NextResponse.json({ error: "Bạn không phụ trách đăng bài này!" }, { status: 403 });
            }
            if (rawBody.status !== undefined) body.status = rawBody.status;
            if (rawBody.publishLink !== undefined) body.publishLink = rawBody.publishLink;
            if (rawBody.note !== undefined) body.note = rawBody.note;
            
        } else {
            return NextResponse.json({ error: "Vai trò của bạn không được phép sửa Task này!" }, { status: 403 });
        }

        // =========================================================================
        // 2. RADAR CHẶN TRÙNG LINK BÁO CÁO
        // =========================================================================
        const linksToCheck = [
            { key: 'scriptLink', value: body.scriptLink },
            { key: 'videoLink', value: body.videoLink },
            { key: 'publishLink', value: body.publishLink },
        ].filter(l => l.value && l.value.trim() !== "");

        if (linksToCheck.length > 0) {
            const orConditions = linksToCheck.map(l => ({
                [l.key]: { contains: getBaseUrl(l.value).replace(/^https?:\/\//, '') }
            }));

            const potentialTasks = await prisma.task.findMany({
                where: { id: { not: taskId }, OR: orConditions }
            });

            let duplicateField = "";
            const isDuplicate = potentialTasks.some(task => {
                return linksToCheck.some(l => {
                    const dbValue = (task as any)[l.key];
                    const isMatch = dbValue && getBaseUrl(dbValue) === getBaseUrl(l.value);
                    if (isMatch) duplicateField = l.key;
                    return isMatch;
                });
            });

            if (isDuplicate) {
                return NextResponse.json({ error: "Link này đã được sử dụng ở Task khác!", field: duplicateField }, { status: 400 });
            }
        }

        // =========================================================================
        // 3. CHUẨN BỊ MẢNG LOG LỊCH SỬ THAY ĐỔI
        // =========================================================================
        const logsToCreate: any[] = [];

        if (body.status && body.status !== oldTask.status) {
            logsToCreate.push({ action: "UPDATE_STATUS", details: `Từ [${oldTask.status}] sang [${body.status}]`, taskId, userId });
        }

        const addLinkLog = (fieldName: string, label: string) => {
            if (body[fieldName] !== undefined && body[fieldName] !== (oldTask as any)[fieldName]) {
                logsToCreate.push({
                    action: "DAILY_REPORT", 
                    details: body[fieldName] ? `Báo cáo tiến độ: Đã cập nhật ${label}` : `Đã xóa ${label}`,
                    taskId, userId
                });
            }
        };

        addLinkLog('scriptLink', 'Kịch Bản (VN)');
        addLinkLog('englishScriptLink', 'Text ENG');
        addLinkLog('audioLink', 'Link Audio (AI)');
        addLinkLog('storyboardLink', 'Bố Cục');
        addLinkLog('thumbnailLink', 'Thumbnail');
        addLinkLog('videoLink', 'Video Render');
        addLinkLog('publishLink', 'Link Video Đã Đăng (YT)');

        if (body.note !== undefined && body.note !== oldTask.note) {
            logsToCreate.push({
                action: "UPDATE_LINK",
                details: `Báo cáo trạng thái: ${body.note}`,
                taskId, userId
            });
        }

        if (body.isClosed !== undefined && body.isClosed !== oldTask.isClosed) {
            logsToCreate.push({ action: body.isClosed ? "COMPLETE_TASK" : "UPDATE_STATUS", details: body.isClosed ? "Task đã bị khóa (Nghiệm thu)" : "Task được kích hoạt lại", taskId, userId });
        }
        if (body.contentId !== undefined && body.contentId !== oldTask.contentId) {
            logsToCreate.push({ action: "ASSIGN_USER", details: `Đã phân công Content mới`, taskId, userId });
        }

        // =========================================================================
        // 4. CẬP NHẬT TASK XUỐNG DATABASE
        // =========================================================================
        const updateTaskPromise = prisma.task.update({
            where: { id: taskId },
            data: {
                title: body.title !== undefined ? body.title : undefined,
                keywords: body.keywords !== undefined ? body.keywords : undefined,
                status: body.status !== undefined ? body.status : undefined,
                scriptLink: body.scriptLink !== undefined ? body.scriptLink : undefined,
                videoLink: body.videoLink !== undefined ? body.videoLink : undefined,
                publishLink: body.publishLink !== undefined ? body.publishLink : undefined,
                isClosed: body.isClosed !== undefined ? body.isClosed : undefined,
                teamId: body.teamId !== undefined ? body.teamId : undefined,
                contentId: body.contentId !== undefined ? body.contentId : undefined,
                editorId: body.editorId !== undefined ? body.editorId : undefined,
                projectId: body.projectId !== undefined ? body.projectId : undefined,
                duration: body.duration !== undefined ? body.duration : undefined,
                note: body.note !== undefined ? body.note : undefined,
                channelId: body.channelId !== undefined ? body.channelId : undefined,
                animatorId:body.animatorId !== undefined ? body.animatorId : undefined,
                priority:body.priority !== undefined ? body.priority : undefined,
                linkContent:body.linkContent !== undefined ? body.linkContent : undefined,
                audioLink:body.audioLink !== undefined ? body.audioLink : undefined,
                storyboardLink:body.storyboardLink !== undefined ? body.storyboardLink : undefined,
                englishScriptLink:body.englishScriptLink !== undefined ? body.englishScriptLink : undefined,
                thumbnailLink:body.thumbnailLink !== undefined ? body.thumbnailLink : undefined,
                animationLink:body.animationLink !== undefined ? body.animationLink : undefined,
                linkProject:body.linkProject !== undefined ? body.linkProject : undefined,
            }
        });

        const promises: any[] = [updateTaskPromise];
        if (logsToCreate.length > 0) promises.push(prisma.taskLog.createMany({ data: logsToCreate }));
        const [updatedTask] = await Promise.all(promises);

        // =========================================================================
        // 5. TẠO THÔNG BÁO TỰ ĐỘNG
        // =========================================================================
        let createdNotifications: any[] = [];
        let userIdsToNotify: string[] = [];

        if (body.status === "DONE" && oldTask.status !== "DONE") {
            const targetConditions: any[] = [{ role: 'ADMIN' }, { role: 'BAN_GIAM_DOC' }];
            if (oldTask.teamId) targetConditions.push({ AND: [{ role: 'LEADER' }, { teamId: oldTask.teamId }] });
            const targetUsers = await prisma.user.findMany({ where: { OR: targetConditions } });
            const bossIds = targetUsers.map(u => u.id).filter(id => id !== userId);
            userIdsToNotify.push(...bossIds);

            if (bossIds.length > 0) {
                const notis = await Promise.all(
                    bossIds.map(targetId => prisma.notification.create({
                        data: { userId: targetId, title: "Nghiệm thu Video", message: `🎉 Task "${oldTask.title}" vừa hoàn thành!`, taskId: taskId, type: "success" }
                    }))
                );
                createdNotifications.push(...notis);
            }
        }

        const involvedIds = [oldTask.contentId, oldTask.editorId, oldTask.animatorId, oldTask.publisherId];
        const targetWorkerIds = [...new Set(involvedIds.filter(id => id && id !== userId))];

        if (targetWorkerIds.length > 0) {
            for (const wId of targetWorkerIds) {
                if (body.status === "TODO" && oldTask.status !== "TODO") {
                    const notif = await prisma.notification.create({ data: { userId: wId as string, taskId: taskId, title: "Task bị từ chối ⚠️", message: `${currentUser.fullName || "Quản lý"} đã yêu cầu làm lại Task "${oldTask.title}".`, type: "error" } });
                    createdNotifications.push({ ...notif, type: "error" });
                    userIdsToNotify.push(wId as string);
                }
                if (body.isClosed === true && oldTask.isClosed === false) {
                    const notif = await prisma.notification.create({ data: { userId: wId as string, taskId: taskId, title: "Task đã hoàn thành 🎉", message: `Task "${oldTask.title}" của bạn đã được chốt!`, type: "success" } });
                    createdNotifications.push({ ...notif, type: "success" });
                    userIdsToNotify.push(wId as string);
                }
            }
        }

        if (body.status === "TODO" && oldTask.status === "BACKLOG") {
            const newAssignees = [];
            if (body.contentId) newAssignees.push(body.contentId);
            if (body.editorId) newAssignees.push(body.editorId);

            if (newAssignees.length > 0) {
                userIdsToNotify.push(...newAssignees);
                const assignNotis = await Promise.all(
                    newAssignees.map(targetId =>
                        prisma.notification.create({
                            data: {
                                userId: targetId,
                                title: "Bạn có việc mới! 🚀",
                                message: `Quản lý vừa phân công bạn làm video: "${oldTask.title}"`,
                                taskId: taskId,
                                type: "info"
                            }
                        })
                    )
                );
                createdNotifications.push(...assignNotis);
            }
        }

        return NextResponse.json({
            task: updatedTask,
            updatedTask: updatedTask,
            notifications: createdNotifications,
            userIdsToNotify: [...new Set(userIdsToNotify)]
        });

    } catch (error) {
        console.error(">>> LỖI CẬP NHẬT TASK:", error);
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await params;
        const task = await prisma.task.findUnique({
            where: { id: resolvedParams.id },
            include: {
                creator: { select: { fullName: true } },
                team: { select: { name: true } },
                contentUser: { select: { fullName: true } },
                editorUser: { select: { fullName: true } },
                publisherUser: { select: { fullName: true } },
                animatorUser: { select: { fullName: true } },
                project: {
                    select: {
                        id: true,
                        name: true,
                        criteria: true
                    }
                },
                channel: { select: { name: true, category: true } },
                evaluations: {
                    include: {
                        evaluator: { select: { fullName: true } }
                    },
                    orderBy: { createdAt: 'desc' }, 
                },
            }
        });

        if (!task) {
            return NextResponse.json({ error: "Không tìm thấy task" }, { status: 404 });
        }
        const formattedTask = {
            ...task!,
            evaluation: task!.evaluations && task!.evaluations.length > 0 ? task!.evaluations[0] : null,
        };

        return NextResponse.json(formattedTask);
    } catch (error) {
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const currentUser = session.user as any;
        
        // 🚀 BỔ SUNG: Kiểm tra quyền động trước khi xóa Task
        const hasPermission = currentUser.permissions?.includes("ACTION_CREATE_TASK") || ["ADMIN", "BAN_GIAM_DOC", "LEADER"].includes(currentUser.role);
        
        if (!hasPermission) {
            return NextResponse.json({ error: "Bạn không có quyền xóa Task!" }, { status: 403 });
        }

        const resolvedParams = await params;

        // Xóa task khỏi Database
        await prisma.task.delete({
            where: { id: resolvedParams.id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("LỖI DELETE TASK:", error);
        return NextResponse.json({ error: "Lỗi Server khi xóa Task" }, { status: 500 });
    }
}