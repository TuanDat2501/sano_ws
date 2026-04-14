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
        const body: any = {}; // Đây là body "sạch" sau khi đã qua máy quét
        const isManager = ["ADMIN", "BAN_GIAM_DOC", "LEADER", "HR"].includes(currentUser.role);

        if (isManager) {
            // Sếp được sửa full
            if (rawBody.status !== undefined) body.status = rawBody.status;
            if (rawBody.scriptLink !== undefined) body.scriptLink = rawBody.scriptLink;
            if (rawBody.videoLink !== undefined) body.videoLink = rawBody.videoLink;
            if (rawBody.publishLink !== undefined) body.publishLink = rawBody.publishLink;
            if (rawBody.isClosed !== undefined) body.isClosed = rawBody.isClosed;
            
        } else if (currentUser.role === "CONTENT") {
            // Content phải là người được giao việc
            if (oldTask.contentId !== currentUser.id && oldTask.creatorId !== currentUser.id) {
                return NextResponse.json({ error: "Bạn không phụ trách nội dung bài này!" }, { status: 403 });
            }
            if (rawBody.scriptLink !== undefined) body.scriptLink = rawBody.scriptLink;
            if (rawBody.status !== undefined) body.status = rawBody.status;

        } else if (currentUser.role === "EDITOR") {
            // Editor phải là người được giao việc
            if (oldTask.editorId !== currentUser.id) {
                return NextResponse.json({ error: "Bạn không phụ trách dựng bài này!" }, { status: 403 });
            }
            if (rawBody.videoLink !== undefined) body.videoLink = rawBody.videoLink;
            if (rawBody.status !== undefined) body.status = rawBody.status;

        } else if (currentUser.role === "CHANNEL_MANAGER") {
            // Publisher phải là người được giao việc
            if (oldTask.publisherId !== currentUser.id) {
                return NextResponse.json({ error: "Bạn không phụ trách đăng bài này!" }, { status: 403 });
            }
            if (rawBody.publishLink !== undefined) body.publishLink = rawBody.publishLink;
            if (rawBody.status !== undefined) body.status = rawBody.status;
        } else {
            return NextResponse.json({ error: "Vai trò của bạn không được phép sửa Task này!" }, { status: 403 });
        }


        // =========================================================================
        // 2. RADAR CHẶN TRÙNG LINK BÁO CÁO (Dùng body "sạch" để check)
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
                where: {
                    id: { not: taskId }, 
                    OR: orConditions
                }
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
                return NextResponse.json(
                    { error: "Link này đã được sử dụng ở Task khác!", field: duplicateField },
                    { status: 400 }
                );
            }
        }

        // =========================================================================
        // 3. 🚀 CHUẨN BỊ MẢNG LOG LỊCH SỬ THAY ĐỔI
        // =========================================================================
        const logsToCreate: any[] = [];

        if (body.status && body.status !== oldTask.status) {
            logsToCreate.push({ 
                action: "UPDATE_STATUS", 
                details: `Từ [${oldTask.status}] sang [${body.status}]`, 
                taskId, userId 
            });
        }

        if (body.scriptLink !== undefined && body.scriptLink !== oldTask.scriptLink) {
            const actionType = (!oldTask.scriptLink && body.scriptLink) ? "SUBMIT_SCRIPT" : "UPDATE_LINK";
            logsToCreate.push({ 
                action: actionType, 
                details: body.scriptLink ? "Đã cập nhật link Kịch bản" : "Đã xóa link Kịch bản", 
                taskId, userId 
            });
        }

        if (body.videoLink !== undefined && body.videoLink !== oldTask.videoLink) {
            const actionType = (!oldTask.videoLink && body.videoLink) ? "SUBMIT_VIDEO" : "UPDATE_LINK";
            logsToCreate.push({ 
                action: actionType, 
                details: body.videoLink ? "Đã cập nhật link Video" : "Đã xóa link Video", 
                taskId, userId 
            });
        }

        if (body.publishLink !== undefined && body.publishLink !== oldTask.publishLink) {
            const actionType = (!oldTask.publishLink && body.publishLink) ? "PUBLISH_VIDEO" : "UPDATE_LINK";
            logsToCreate.push({ 
                action: actionType, 
                details: body.publishLink ? "Đã cập nhật link Publish" : "Đã xóa link Publish", 
                taskId, userId 
            });
        }

        if (body.isClosed !== undefined && body.isClosed !== oldTask.isClosed) {
            logsToCreate.push({ 
                action: body.isClosed ? "COMPLETE_TASK" : "UPDATE_STATUS", 
                details: body.isClosed ? "Task đã bị khóa (Nghiệm thu)" : "Task được kích hoạt lại", 
                taskId, userId 
            });
        }
        
        // =========================================================================
        // 4. CẬP NHẬT TASK VÀ GHI LOG (Thực thi Song song)
        // =========================================================================
        const updateTaskPromise = prisma.task.update({
            where: { id: taskId },
            data: {
                status: body.status !== undefined ? body.status : undefined,
                scriptLink: body.scriptLink !== undefined ? body.scriptLink : undefined,
                videoLink: body.videoLink !== undefined ? body.videoLink : undefined,
                publishLink: body.publishLink !== undefined ? body.publishLink : undefined,
                isClosed: body.isClosed !== undefined ? body.isClosed : undefined,
            }
        });

        const promises: any[] = [updateTaskPromise];
        if (logsToCreate.length > 0) {
            promises.push(prisma.taskLog.createMany({ data: logsToCreate }));
        }

        const [updatedTask] = await Promise.all(promises);

        // =========================================================================
        // 5. TẠO THÔNG BÁO
        // =========================================================================
        let createdNotifications: any[] = [];
        let userIdsToNotify: string[] = [];

        // --- 5.1. BÁO CHO CÁC SẾP KHI TASK "HOÀN THÀNH" ---
        if (body.status === "DONE" && oldTask.status !== "DONE") {
            const targetConditions: any[] = [
                { role: 'ADMIN' }, 
                { role: 'BAN_GIAM_DOC' }
            ];

            if (oldTask.teamId) {
                targetConditions.push({
                    AND: [{ role: 'LEADER' }, { teamId: oldTask.teamId }] 
                });
            }

            const targetUsers = await prisma.user.findMany({
                where: { OR: targetConditions }
            });

            const bossIds = targetUsers.map(u => u.id).filter(id => id !== userId);
            userIdsToNotify.push(...bossIds);

            if (bossIds.length > 0) {
                const notis = await Promise.all(
                    bossIds.map(targetId =>
                        prisma.notification.create({
                            data: {
                                userId: targetId,
                                title: "Nghiệm thu Video",
                                message: `🎉 Task "${oldTask.title}" vừa hoàn thành!`,
                                taskId: taskId,
                                type: "success"
                            }
                        })
                    )
                );
                createdNotifications.push(...notis);
            }
        }

       // --- 5.2. BÁO CHO NHỮNG NGƯỜI LIÊN QUAN KHI REJECT / APPROVE ---
        const involvedIds = [oldTask.contentId, oldTask.editorId, oldTask.publisherId]; 
        const targetWorkerIds = [...new Set(involvedIds.filter(id => id && id !== userId))];
        
        if (targetWorkerIds.length > 0) {
            for (const wId of targetWorkerIds) {
                
                // REJECT TASK (Về DOING)
                if (body.status === "DOING" && oldTask.status !== "DOING") {
                    const notif = await prisma.notification.create({
                        data: {
                            userId: wId as string,
                            taskId: taskId,
                            title: "Task bị từ chối ⚠️",
                            message: `${currentUser.fullName || "Quản lý"} đã yêu cầu làm lại Task "${oldTask.title}".`,
                            type: "error"
                        }
                    });
                    createdNotifications.push({ ...notif, type: "error" });
                    userIdsToNotify.push(wId as string);
                }

                // APPROVE TASK (Đóng Task)
                if (body.isClosed === true && oldTask.isClosed === false) {
                    const notif = await prisma.notification.create({
                        data: {
                            userId: wId as string,
                            taskId: taskId,
                            title: "Task đã hoàn thành 🎉",
                            message: `Task "${oldTask.title}" của bạn đã được chốt và đóng thành công!`,
                            type: "success"
                        }
                    });
                    createdNotifications.push({ ...notif, type: "success" }); 
                    userIdsToNotify.push(wId as string);
                }
                
                // MỞ LẠI TASK 
                if (body.isClosed === false && oldTask.isClosed === true && !body.status) {
                    const notif = await prisma.notification.create({
                        data: {
                            userId: wId as string,
                            taskId: taskId,
                            title: "Task được mở lại 🔓",
                            message: `Task "${oldTask.title}" đã được mở lại để chỉnh sửa.`,
                            type: "info"
                        }
                    });
                    createdNotifications.push({ ...notif, type: "info" }); 
                    userIdsToNotify.push(wId as string);
                }
            }
        }

        // =========================================================================
        // 6. TRẢ VỀ DATA CHO FRONTEND
        // =========================================================================
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

// Hàm GET (Giữ nguyên của sếp)
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
                publisherUser: { select: { fullName: true } }
            }
        });
        return NextResponse.json(task);
    } catch (error) {
        return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
    }
}