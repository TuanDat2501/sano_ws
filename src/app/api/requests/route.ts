export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const user = session.user as any;
        const { searchParams } = new URL(req.url);

        const page = Number(searchParams.get("page")) || 1;
        const limit = Number(searchParams.get("limit")) || 10;
        const skip = (page - 1) * limit;

        const tab = searchParams.get("tab") || "MY_REQUESTS";
        const searchKeyword = searchParams.get("search")?.trim() || "";
        
        const filterType = searchParams.get("type") || "";
        const filterStatus = searchParams.get("status") || "";
        const filterTeamId = searchParams.get("teamId") || "";
        const filterRequesterId = searchParams.get("requesterId") || "";

        const canViewAllCompany = user.permissions?.includes("MENU_TEAMS") || 
                                  user.permissions?.includes("DEPARTMENT_LEADER") || 
                                  ["ADMIN", "BAN_GIAM_DOC", "HR"].includes(user.role);
        
        const isTeamLeader = user.isTeamLeader || user.role === "LEADER";

        // 🚀 DÙNG MẢNG AND ĐỂ CHỐNG XUNG ĐỘT BỘ LỌC
        const andConditions: any[] = [];

        // 1. Lọc theo Tab
        if (tab === "NEED_APPROVAL") {
            andConditions.push({
                OR: [
                    { firstApproverId: user.id, status: "PENDING_1" },
                    { secondApproverId: user.id, status: "PENDING_2" }
                ]
            });
        } else if (tab === "ALL_REQUESTS") {
            if (canViewAllCompany) {
                if (filterTeamId) andConditions.push({ teamId: filterTeamId });
            } else if (isTeamLeader && user.teamId) {
                andConditions.push({ teamId: user.teamId });
            } else {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
        } else {
            andConditions.push({ requesterId: user.id });
        }

        // 2. Lọc theo Team / Người tạo / Loại / Trạng thái
        if (tab === "NEED_APPROVAL" && filterTeamId !== "") {
            andConditions.push({ teamId: filterTeamId });
        }
        if (tab !== "MY_REQUESTS" && filterRequesterId !== "") {
            andConditions.push({ requesterId: filterRequesterId });
        }
        if (filterType !== "") {
            andConditions.push({ type: filterType });
        }
        if (filterStatus !== "") {
            andConditions.push({ status: filterStatus });
        }

        // 🚀 3. SỬA LỖI SEARCH TÊN: Kết hợp kiểm tra chính xác từ khóa
        if (searchKeyword !== "") {
            andConditions.push({
                OR: [
                    { id: { contains: searchKeyword } },
                    { 
                        requester: { 
                            fullName: { 
                                contains: searchKeyword,
                                // Nếu dùng PostgreSQL thì thêm line dưới, MySQL thì Prisma sẽ query chuẩn hơn khi bọc trong AND
                                mode: 'insensitive' 
                            } 
                        } 
                    }
                ]
            });
        }

        const whereClause = andConditions.length > 0 ? { AND: andConditions } : {};

        const [requests, totalCount] = await Promise.all([
            prisma.request.findMany({
                where: whereClause,
                include: {
                    requester: { select: { fullName: true } },
                    team: { select: { name: true } },
                    firstApprover: { select: { fullName: true } },
                    secondApprover: { select: { fullName: true } }
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: skip
            }),
            prisma.request.count({ where: whereClause })
        ]);

        return NextResponse.json({
            requests,
            totalPages: Math.ceil(totalCount / limit),
            totalCount,
            currentPage: page
        });

    } catch (error) {
        console.error("❌ Lỗi API Requests:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}