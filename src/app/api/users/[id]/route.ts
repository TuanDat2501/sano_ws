// src/app/api/users/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";

export const dynamic = "force-dynamic";

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const targetUserId = id;

        // 1. 🚀 CHỐT CHẶN BẢO MẬT TỐI CAO
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Chưa đăng nhập!" }, { status: 401 });
        }

        const currentUser = session.user as any;
        const isManager = ["ADMIN", "BAN_GIAM_DOC", "HR"].includes(currentUser.role);
        const isSelf = currentUser.id === targetUserId;

        if (!isManager && !isSelf) {
            return NextResponse.json({ error: "Sếp không có quyền sửa thông tin người này!" }, { status: 403 });
        }

        // 2. LẤY DỮ LIỆU TỪ FORM (Frontend)
        const body = await request.json();
        const { 
            username, fullName, role, teamId, password, isActive, avatarUrl,
            // 🚀 BỔ SUNG CÁC TRƯỜNG HR & TEAM LEADER
            isTeamLeader, employeeCode, dob, ethnicity, cccdNumber, cccdDate,
            cccdPlace, permanentAddress, currentAddress, phone, personalEmail,
            relativeName, relativePhone, relativeRelation, bankAccount, bankName,
            joinDate, bhxhNumber
        } = body;

        // 3. CHUẨN BỊ GIỎ DỮ LIỆU UPDATE
        // 3. CHUẨN BỊ GIỎ DỮ LIỆU UPDATE
        const updateData: any = {};
        
        if (fullName) updateData.fullName = fullName;
        if (username) updateData.username = username;
        if (avatarUrl) updateData.avatarUrl = avatarUrl;
        
        // 🚀 ĐÃ FIX: Chuyển đổi chuỗi rỗng "" thành null đối với các trường @unique để tránh lỗi P2002
        if (employeeCode !== undefined) {
            updateData.employeeCode = employeeCode?.trim() === "" ? null : employeeCode;
        }
        if (cccdNumber !== undefined) {
            updateData.cccdNumber = cccdNumber?.trim() === "" ? null : cccdNumber;
        }
        
        // Các trường không unique thì có thể giữ nguyên chuỗi rỗng
        if (ethnicity !== undefined) updateData.ethnicity = ethnicity;
        if (cccdPlace !== undefined) updateData.cccdPlace = cccdPlace;
        if (permanentAddress !== undefined) updateData.permanentAddress = permanentAddress;
        if (currentAddress !== undefined) updateData.currentAddress = currentAddress;
        if (phone !== undefined) updateData.phone = phone;
        if (personalEmail !== undefined) updateData.personalEmail = personalEmail;
        if (relativeName !== undefined) updateData.relativeName = relativeName;
        if (relativePhone !== undefined) updateData.relativePhone = relativePhone;
        if (relativeRelation !== undefined) updateData.relativeRelation = relativeRelation;
        if (bankAccount !== undefined) updateData.bankAccount = bankAccount;
        if (bankName !== undefined) updateData.bankName = bankName;
        if (bhxhNumber !== undefined) updateData.bhxhNumber = bhxhNumber;

        // Xử lý chuẩn hóa ngày tháng cho Prisma
        if (dob) updateData.dob = new Date(dob);
        else if (dob === "") updateData.dob = null;

        if (cccdDate) updateData.cccdDate = new Date(cccdDate);
        else if (cccdDate === "") updateData.cccdDate = null;

        if (joinDate) updateData.joinDate = new Date(joinDate);
        else if (joinDate === "") updateData.joinDate = null;

        // Xử lý mật khẩu (Chỉ băm nếu sếp có gõ pass mới)
        if (password && password.trim() !== "") {
            updateData.passwordHash = await bcrypt.hash(password, 10);
        }

        // 🚀 ĐẶC QUYỀN CỦA QUẢN LÝ: Chỉ Quản lý mới được phép đổi Role, Team, Khóa tài khoản và set Leader
        if (isManager) {
            if (role) updateData.role = role;
            updateData.teamId = teamId || null; // Nếu rỗng thì gán null
            if (isActive !== undefined) updateData.isActive = isActive; 
            if (isTeamLeader !== undefined) updateData.isTeamLeader = isTeamLeader; 
        }

        // 4. LỆNH CHO PRISMA THỰC THI
        const updatedUser = await prisma.user.update({
            where: { id: targetUserId },
            data: updateData,
            select: {
                id: true,
                username: true,
                fullName: true,
                role: true,
                avatarUrl: true,
                teamId: true,
                isActive: true, 
                isTeamLeader: true,
                createdAt: true,
                team: { select: { name: true } }
            }
        });

        return NextResponse.json(updatedUser, { status: 200 });

    } catch (error: any) {
        console.error(">>> [API UPDATE USER ERROR]:", error);

        if (error.code === 'P2002') {
            return NextResponse.json({ error: "Dữ liệu bị trùng (Tên đăng nhập, CCCD hoặc Mã NV đã tồn tại)!" }, { status: 400 });
        }
        
        if (error.code === 'P2025') {
            return NextResponse.json({ error: "Không tìm thấy nhân sự này!" }, { status: 404 });
        }

        return NextResponse.json({ error: "Lỗi Server không thể cập nhật!" }, { status: 500 });
    }
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Chưa đăng nhập!" }, { status: 401 });
        }

        const currentUser = session.user as any;
        const { id } = await params;
        const targetUserId = id;

        const isManager = ["ADMIN", "BAN_GIAM_DOC", "HR", "LEADER"].includes(currentUser.role);
        const isSelf = currentUser.id === targetUserId;

        if (!isManager && !isSelf) {
            return NextResponse.json({ error: "Bạn không có quyền xem thông tin của người này!" }, { status: 403 });
        }

        const user = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: {
                id: true,
                username: true,
                fullName: true,
                role: true,
                teamId: true,
                isActive: true, 
                isTeamLeader: true,
                createdAt: true,
                team: { select: { name: true } },
                // 🚀 TRẢ VỀ ĐẦY ĐỦ CÁC TRƯỜNG HR ĐỂ ĐỔ LÊN FORM
                employeeCode: true,
                dob: true,
                ethnicity: true,
                cccdNumber: true,
                cccdDate: true,
                cccdPlace: true,
                permanentAddress: true,
                currentAddress: true,
                phone: true,
                personalEmail: true,
                relativeName: true,
                relativePhone: true,
                relativeRelation: true,
                bankAccount: true,
                bankName: true,
                joinDate: true,
                bhxhNumber: true,
            }
        });

        if (!user) {
            return NextResponse.json({ error: "Không tìm thấy nhân sự này!" }, { status: 404 });
        }

        return NextResponse.json(user, { status: 200 });

    } catch (error) {
        console.error(">>> [API GET USER ERROR]:", error);
        return NextResponse.json({ error: "Lỗi hệ thống khi lấy thông tin nhân sự." }, { status: 500 });
    }
}