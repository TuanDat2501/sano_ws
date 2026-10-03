import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";

const getBaseUrl = (rawUrl: string) => {
    if (!rawUrl || rawUrl.trim() === "") return "";
    
    let url = rawUrl.trim();
    if (!url.startsWith('http')) {
        url = `https://${url}`;
    }

    try {
        const parsedUrl = new URL(url);
        
        if (parsedUrl.hostname.includes('youtube.com')) {
            const v = parsedUrl.searchParams.get('v');
            return v ? `${parsedUrl.origin}${parsedUrl.pathname}?v=${v}` : `${parsedUrl.origin}${parsedUrl.pathname}`;
        }
        
        return parsedUrl.origin + parsedUrl.pathname;
    } catch (e) {
        return url.split('?')[0];
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

        const transactionResult = await prisma.$transaction(async (tx) => {
            const oldTask = await tx.task.findUnique({ 
                where: { id: taskId },
                include: {
                    coContentUsers: { select: { id: true } },
                    coEditorUsers: { select: { id: true } },
                    coAnimatorUsers: { select: { id: true } }
                }
            });
            if (!oldTask) throw new Error("Task không tồn tại");

            const body: any = {};
            const isManager = currentUser.permissions?.includes("ACTION_CREATE_TASK") || ["ADMIN", "BAN_GIAM_DOC", "LEADER", "HR"].includes(currentUser.role);

            if (!isManager && oldTask.isClosed) {
                throw new Error("Task đã nghiệm thu, không thể chỉnh sửa!");
            }

            if (rawBody.status !== undefined) body.status = rawBody.status;
            if (rawBody.note !== undefined) body.note = rawBody.note;

            const isFromModal = rawBody.title !== undefined || rawBody.teamId !== undefined;

            const handleLinkField = (field: string) => {
                if (rawBody[field] !== undefined) {
                    const incomingValue = rawBody[field] || "";
                    const baseValue = rawBody[`base_${field}`]; 
                    const dbValue = (oldTask as any)[field] || "";

                    if (baseValue !== undefined && baseValue !== dbValue && !isFromModal) {
                        const dbLines = dbValue.split('\n').map((l: string) => l.trim()).filter(Boolean);
                        const baseLines = baseValue.split('\n').map((l: string) => l.trim()).filter(Boolean);
                        const incomingLines = incomingValue.split('\n').map((l: string) => l.trim()).filter(Boolean);

                        const addedLines = incomingLines.filter((l: string) => !baseLines.includes(l));
                        const deletedLines = baseLines.filter((l: string) => !incomingLines.includes(l));

                        let finalLines = dbLines.filter((l: string) => !deletedLines.includes(l));
                        addedLines.forEach((l: string) => {
                            if (!finalLines.includes(l)) finalLines.push(l);
                        });

                        body[field] = finalLines.length > 0 ? finalLines.join('\n') : null;
                    } else {
                        if (isFromModal && rawBody[field] === "") {
                        } else {
                            body[field] = incomingValue === "" ? null : incomingValue;
                        }
                    }
                }
            };

            handleLinkField('scriptLink');
            handleLinkField('englishScriptLink');
            handleLinkField('audioLink');
            handleLinkField('storyboardLink');
            handleLinkField('thumbnailLink');
            handleLinkField('videoLink');
            handleLinkField('publishLink');
            handleLinkField('roughProjectLink');
            handleLinkField('animationLink');
            handleLinkField('linkProject');

            if (rawBody.publishDate !== undefined) {
                body.publishDate = rawBody.publishDate ? new Date(rawBody.publishDate) : null;
            }

            if (body.publishLink && body.publishLink.trim() !== "" && oldTask.publishLink !== body.publishLink) {
                if (!oldTask.publishDate && rawBody.publishDate === undefined) {
                    body.publishDate = new Date();
                }
            }

            if (isManager) {
                if (rawBody.title !== undefined) body.title = rawBody.title;
                if (rawBody.keywords !== undefined) body.keywords = rawBody.keywords;
                if (rawBody.isClosed !== undefined) body.isClosed = rawBody.isClosed;
                if (rawBody.teamId !== undefined) body.teamId = rawBody.teamId;
                if (rawBody.projectId !== undefined) body.projectId = rawBody.projectId || null;
                if (rawBody.duration !== undefined) body.duration = rawBody.duration;
                if (rawBody.channelId !== undefined) body.channelId = rawBody.channelId || null;
                if (rawBody.priority !== undefined) body.priority = rawBody.priority;
                
                if (rawBody.publisherId !== undefined) body.publisherId = rawBody.publisherId || null;

                if (rawBody.contentIds !== undefined) {
                    body.contentId = rawBody.contentIds.length > 0 ? rawBody.contentIds[0] : null;
                    body.coContentUsers = { set: rawBody.contentIds.length > 1 ? rawBody.contentIds.slice(1).map((id: string) => ({ id })) : [] };
                } else if (rawBody.contentId !== undefined) {
                    body.contentId = rawBody.contentId || null;
                }

                if (rawBody.editorIds !== undefined) {
                    body.editorId = rawBody.editorIds.length > 0 ? rawBody.editorIds[0] : null;
                    body.coEditorUsers = { set: rawBody.editorIds.length > 1 ? rawBody.editorIds.slice(1).map((id: string) => ({ id })) : [] };
                } else if (rawBody.editorId !== undefined) {
                    body.editorId = rawBody.editorId || null;
                }

                if (rawBody.animatorIds !== undefined) {
                    body.animatorId = rawBody.animatorIds.length > 0 ? rawBody.animatorIds[0] : null;
                    body.coAnimatorUsers = { set: rawBody.animatorIds.length > 1 ? rawBody.animatorIds.slice(1).map((id: string) => ({ id })) : [] };
                } else if (rawBody.animatorId !== undefined) {
                    body.animatorId = rawBody.animatorId || null;
                }
            }

            const currentIsRework = rawBody.isRework !== undefined ? rawBody.isRework : oldTask.isRework;

            if (!currentIsRework) {
                const fieldsToCheck = [
                    'scriptLink', 'audioLink', 'storyboardLink', 'animationLink', 
                    'roughProjectLink', 'thumbnailLink', 'videoLink', 'linkProject', 'publishLink'
                ];

                let urlsToVerify: { field: string, cleanUrl: string }[] = [];
                
                fieldsToCheck.forEach(field => {
                    const fieldValue = body[field];
                    if (fieldValue && typeof fieldValue === 'string' && fieldValue.trim() !== "") {
                        const lines = fieldValue.split('\n');
                        lines.forEach(line => {
                            const match = line.match(/(https?:\/\/[^\s]+)/);
                            if (match) {
                                const processedUrl = getBaseUrl(match[0]).replace(/^https?:\/\//, '');
                                if(processedUrl) {
                                    urlsToVerify.push({ field, cleanUrl: processedUrl });
                                }
                            }
                        });
                    }
                });

                if (urlsToVerify.length > 0) {
                    const allOtherTasks = await tx.task.findMany({
                        where: { id: { not: taskId } },
                        select: {
                            id: true,
                            scriptLink: true, audioLink: true, storyboardLink: true, 
                            animationLink: true, roughProjectLink: true, thumbnailLink: true, 
                            videoLink: true, linkProject: true, publishLink: true
                        }
                    });

                    let duplicateField = "";
                    
                    const isDuplicate = allOtherTasks.some(otherTask => {
                        return urlsToVerify.some(incomingLink => {
                            return fieldsToCheck.some(dbField => {
                                const dbRawValue = (otherTask as any)[dbField];
                                if (!dbRawValue || typeof dbRawValue !== 'string') return false;

                                const dbLines = dbRawValue.split('\n');
                                return dbLines.some((dbLine: string) => {
                                    const dbMatch = dbLine.match(/(https?:\/\/[^\s]+)/);
                                    if (dbMatch) {
                                        const dbCleanUrl = getBaseUrl(dbMatch[0]).replace(/^https?:\/\//, '');
                                        if (dbCleanUrl === incomingLink.cleanUrl) {
                                            duplicateField = incomingLink.field;
                                            return true;
                                        }
                                    }
                                    return false;
                                });
                            });
                        });
                    });

                    if (isDuplicate) {
                        throw new Error(`Link này đã được sử dụng ở Task khác! Trường: ${duplicateField}`);
                    }
                }
            }

            const logsToCreate: any[] = [];
            const logsToDelete: any[] = [];

            if (body.status && body.status !== oldTask.status) {
                logsToCreate.push({ action: "UPDATE_STATUS", details: `Từ [${oldTask.status}] sang [${body.status}]`, taskId, userId });
            }

            const checkAssignment = (roleType: 'CONTENT' | 'EDITOR' | 'ANIMATOR' | 'PUBLISHER') => {
                switch (roleType) {
                    case 'CONTENT':
                        return (body.contentId ?? oldTask.contentId) === userId || 
                               (rawBody.contentIds || []).includes(userId) || 
                               oldTask.coContentUsers?.some((u: any) => u.id === userId);
                    case 'EDITOR':
                        return (body.editorId ?? oldTask.editorId) === userId || 
                               (rawBody.editorIds || []).includes(userId) || 
                               oldTask.coEditorUsers?.some((u: any) => u.id === userId);
                    case 'ANIMATOR':
                        return (body.animatorId ?? oldTask.animatorId) === userId || 
                               (rawBody.animatorIds || []).includes(userId) || 
                               oldTask.coAnimatorUsers?.some((u: any) => u.id === userId);
                    case 'PUBLISHER':
                        return (body.publisherId ?? oldTask.publisherId) === userId;
                    default:
                        return false;
                }
            };

            const isContentAssigned = checkAssignment('CONTENT');
            const isEditorAssigned = checkAssignment('EDITOR');
            const isAnimatorAssigned = checkAssignment('ANIMATOR');
            const isPublisherAssigned = checkAssignment('PUBLISHER');

            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const addLinkLog = (fieldName: string, label: string) => {
                if (body[fieldName] !== undefined && body[fieldName] !== (oldTask as any)[fieldName]) {
                    const newValue = body[fieldName];
                    
                    let actionType: any = "UPDATE_LINK";
                    let logCategory: 'CONTENT' | 'EDIT' | 'ANIMATION' | 'PUBLISH' | 'GENERAL' = 'GENERAL';

                    if (newValue && newValue.trim() !== "") {
                        const isContentField = ['scriptLink', 'storyboardLink'].includes(fieldName);
                        const isEditField = ['audioLink', 'roughProjectLink', 'linkProject', 'videoLink'].includes(fieldName);
                        const isAnimField = ['animationLink'].includes(fieldName);
                        const isPublishField = ['thumbnailLink', 'publishLink'].includes(fieldName);

                        if (isContentField && isContentAssigned) {
                            actionType = "DAILY_REPORT";
                            logCategory = 'CONTENT';
                        }
                        else if (isEditField && isEditorAssigned) {
                            actionType = "DAILY_REPORT";
                            logCategory = 'EDIT';
                        }
                        else if (isAnimField && isAnimatorAssigned) {
                            actionType = "DAILY_REPORT";
                            logCategory = 'ANIMATION';
                        }
                        else if (isPublishField) {
                            if (isPublisherAssigned) {
                                actionType = "DAILY_REPORT";
                                logCategory = 'PUBLISH';
                            } 
                            else if (isEditorAssigned && fieldName === 'thumbnailLink') {
                                actionType = "DAILY_REPORT";
                                logCategory = 'EDIT';
                            }
                        }
                    }

                    logsToDelete.push({
                        taskId,
                        action: { in: ["DAILY_REPORT", "UPDATE_LINK"] },
                        details: { contains: label },
                        createdAt: { gte: todayStart } 
                    });

                    if (newValue && newValue.trim() !== "") {
                        logsToCreate.push({
                            action: actionType,
                            details: `Báo cáo tiến độ: Đã cập nhật ${label}`,
                            jobCategory: logCategory,
                            taskId,
                            userId
                        });
                    } else {
                        logsToCreate.push({
                            action: "UPDATE_LINK",
                            details: `Báo cáo tiến độ: Đã gỡ/xóa ${label}`,
                            jobCategory: 'GENERAL',
                            taskId,
                            userId
                        });
                    }
                }
            };

            addLinkLog('scriptLink', 'Kịch Bản (VN)');
            addLinkLog('audioLink', 'Link Audio');
            addLinkLog('storyboardLink', 'Bố Cục');
            addLinkLog('animationLink', 'Link Chuyển Động');
            addLinkLog('roughProjectLink', 'Link PRJ Thô');
            addLinkLog('thumbnailLink', 'Thumbnail');
            addLinkLog('videoLink', 'Video Render');
            addLinkLog('linkProject', 'Link Project (Dựng Chính)');
            addLinkLog('publishLink', 'Link Video Đã Đăng (YT)');

            if (body.note !== undefined && body.note !== oldTask.note) {
                logsToCreate.push({ action: "UPDATE_LINK", details: `Báo cáo trạng thái: ${body.note}`, taskId, userId });
            }
            if (body.isClosed !== undefined && body.isClosed !== oldTask.isClosed) {
                logsToCreate.push({ action: body.isClosed ? "COMPLETE_TASK" : "UPDATE_STATUS", details: body.isClosed ? "Task đã bị khóa (Nghiệm thu)" : "Task được kích hoạt lại", taskId, userId });
            }
            if (body.contentId !== undefined && body.contentId !== oldTask.contentId) {
                logsToCreate.push({ action: "ASSIGN_USER", details: `Đã cập nhật phân công nhân sự`, taskId, userId });
            }

            let reworkFlag = oldTask.isRework;

            if (rawBody.isRework !== undefined) {
                reworkFlag = Boolean(rawBody.isRework);
            } else if (body.status === "TODO" && oldTask.status !== "TODO") {
                reworkFlag = true;
            }

            // 🚀 BƯỚC 1: UPDATE TASK
            const updatedTask = await tx.task.update({
                where: { id: taskId },
                data: {
                    title: body.title !== undefined ? body.title : undefined,
                    keywords: body.keywords !== undefined ? body.keywords : undefined,
                    status: body.status !== undefined ? body.status : undefined,
                    scriptLink: body.scriptLink !== undefined ? body.scriptLink : undefined,
                    videoLink: body.videoLink !== undefined ? body.videoLink : undefined,
                    publishLink: body.publishLink !== undefined ? body.publishLink : undefined,
                    publishDate: body.publishDate !== undefined ? body.publishDate : undefined,
                    isClosed: body.isClosed !== undefined ? body.isClosed : undefined,
                    teamId: body.teamId !== undefined ? body.teamId : undefined,
                    projectId: body.projectId !== undefined ? body.projectId : undefined,
                    duration: body.duration !== undefined ? body.duration : undefined,
                    note: body.note !== undefined ? body.note : undefined,
                    channelId: body.channelId !== undefined ? body.channelId : undefined,
                    priority: body.priority !== undefined ? body.priority : undefined,
                    audioLink: body.audioLink !== undefined ? body.audioLink : undefined,
                    storyboardLink: body.storyboardLink !== undefined ? body.storyboardLink : undefined,
                    englishScriptLink: body.englishScriptLink !== undefined ? body.englishScriptLink : undefined,
                    thumbnailLink: body.thumbnailLink !== undefined ? body.thumbnailLink : undefined,
                    animationLink: body.animationLink !== undefined ? body.animationLink : undefined,
                    linkProject: body.linkProject !== undefined ? body.linkProject : undefined,
                    roughProjectLink: body.roughProjectLink !== undefined ? body.roughProjectLink : undefined,
                    isRework: reworkFlag,
                    contentId: body.contentId !== undefined ? body.contentId : undefined,
                    editorId: body.editorId !== undefined ? body.editorId : undefined,
                    animatorId: body.animatorId !== undefined ? body.animatorId : undefined,
                    ...(body.coContentUsers && { coContentUsers: body.coContentUsers }),
                    ...(body.coEditorUsers && { coEditorUsers: body.coEditorUsers }),
                    ...(body.coAnimatorUsers && { coAnimatorUsers: body.coAnimatorUsers }),
                    publisherId: body.publisherId !== undefined ? body.publisherId : undefined 
                }
            });

            // 🚀 BƯỚC 2: TẠO VÀ XÓA TASK LOG ĐỂ TÍNH KPI NẰM CHẶT TRONG TRANSACTION
            if (logsToDelete.length > 0) {
                for (const condition of logsToDelete) {
                    await tx.taskLog.deleteMany({ where: condition });
                }
            }
            if (logsToCreate.length > 0) {
                await tx.taskLog.createMany({ data: logsToCreate });
            }

            // Nếu đến được đây thì cả Task và TaskLog đều đã lưu thành công.
            return { updatedTask, oldTask };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

        const { updatedTask, oldTask } = transactionResult;
        let createdNotifications: any[] = [];
        let userIdsToNotify: string[] = [];

        return NextResponse.json({
            task: updatedTask,
            updatedTask: updatedTask,
            notifications: createdNotifications,
            userIdsToNotify: [...new Set(userIdsToNotify)]
        });

    } catch (error: any) {
        console.error(">>> LỖI CẬP NHẬT TASK VÀ GHI LOG:", error);
        if (error.message.includes("Task đã nghiệm thu")) return NextResponse.json({ error: error.message }, { status: 403 });
        if (error.message.includes("Task không tồn tại")) return NextResponse.json({ error: error.message }, { status: 404 });
        if (error.message.includes("Link này đã được sử dụng")) {
            const fieldSplit = error.message.split("Trường: ");
            const duplicateField = fieldSplit.length > 1 ? fieldSplit[1] : "";
            return NextResponse.json({ error: error.message.split(" Trường:")[0], field: duplicateField }, { status: 400 });
        }
        return NextResponse.json({ error: "Lỗi hệ thống khi cập nhật hoặc ghi KPI Log. Cập nhật đã bị hoàn tác." }, { status: 500 });
    }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await params;
        const task = await prisma.task.findUnique({
            where: { id: resolvedParams.id },
            include: {
                creator: { select: { fullName: true, avatarUrl: true } },
                team: { select: { name: true } },
                project: { select: { id: true, name: true, criteria: true } },
                channel: { select: { name: true, category: true } },
                evaluations: {
                    include: { evaluator: { select: { fullName: true, avatarUrl: true } } },
                    orderBy: { createdAt: 'desc' },
                },
                contentUser: { select: { id: true, fullName: true, avatarUrl: true } },
                editorUser: { select: { id: true, fullName: true, avatarUrl: true } },
                publisherUser: { select: { id: true, fullName: true, avatarUrl: true } },
                animatorUser: { select: { id: true, fullName: true, avatarUrl: true } },
                coContentUsers: { select: { id: true, fullName: true, avatarUrl: true } },
                coEditorUsers: { select: { id: true, fullName: true, avatarUrl: true } },
                coAnimatorUsers: { select: { id: true, fullName: true, avatarUrl: true } },
            }
        });

        if (!task) return NextResponse.json({ error: "Không tìm thấy task" }, { status: 404 });
        
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
        const hasPermission = currentUser.permissions?.includes("ACTION_CREATE_TASK") || ["ADMIN", "BAN_GIAM_DOC", "LEADER"].includes(currentUser.role);

        if (!hasPermission) return NextResponse.json({ error: "Bạn không có quyền xóa Task!" }, { status: 403 });

        const resolvedParams = await params;
        await prisma.task.delete({ where: { id: resolvedParams.id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("LỖI DELETE TASK:", error);
        return NextResponse.json({ error: "Lỗi Server khi xóa Task" }, { status: 500 });
    }
}