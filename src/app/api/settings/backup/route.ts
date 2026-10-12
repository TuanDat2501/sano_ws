import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || (session.user as any).role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const dbUrlStr = process.env.DATABASE_URL;
        if (!dbUrlStr) {
            return NextResponse.json({ error: "Không tìm thấy DATABASE_URL" }, { status: 500 });
        }

        const dbUrl = new URL(dbUrlStr);
        const host = dbUrl.hostname;
        const port = dbUrl.port || '3306';
        const user = dbUrl.username;
        const password = dbUrl.password;
        const database = dbUrl.pathname.substring(1);

        // 🚀 TỰ ĐỘNG NHẬN DIỆN HỆ ĐIỀU HÀNH
        let dumpCmd = "mysqldump"; // Mặc định cho VPS Ubuntu/Linux
        
        if (process.platform === "win32") {
            // NẾU BẠN DÙNG XAMPP (Đường dẫn mặc định)
            dumpCmd = `"C:\\xampp\\mysql\\bin\\mysqldump.exe"`;
            
            // NẾU BẠN DÙNG LARAGON (Mở comment dòng dưới và đóng dòng trên lại, nhớ sửa tên thư mục mysql cho đúng version)
            // dumpCmd = `"C:\\laragon\\bin\\mysql\\mysql-8.0.30-winx64\\bin\\mysqldump.exe"`;
            
            // NẾU CÀI MYSQL SERVER ĐỘC LẬP
            // dumpCmd = `"C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe"`;
        }

        const command = `${dumpCmd} -h ${host} -P ${port} -u ${user} ${database} --no-tablespaces`;

        const { stdout, stderr } = await execAsync(command, {
            env: { ...process.env, MYSQL_PWD: password },
            maxBuffer: 1024 * 1024 * 100 // Cấp 100MB RAM cho file SQL
        });

        if (!stdout || stdout.trim() === "") {
            console.error("Lỗi trích xuất:", stderr);
            return NextResponse.json({ error: "Không thể trích xuất cơ sở dữ liệu." }, { status: 500 });
        }

        const dateStr = new Date().toLocaleDateString('vi-VN', { 
            day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' 
        }).replace(/\//g, '-');
        const timeStr = new Date().toLocaleTimeString('vi-VN', { 
            hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' 
        }).replace(/:/g, 'h');
        
        const filename = `Backup_NoiBo_${dateStr}_${timeStr}.sql`;

        return new NextResponse(stdout, {
            headers: {
                "Content-Type": "application/sql",
                "Content-Disposition": `attachment; filename="${filename}"`
            }
        });

    } catch (error: any) {
        console.error("LỖI BACKUP DB:", error);
        
        // Log rõ lỗi ra màn hình để dễ bắt bệnh trên Windows
        const errorMsg = error.message.includes("is not recognized") || error.message.includes("cannot find the file")
            ? "LỖI LOCAL: Đường dẫn mysqldump.exe trên máy Windows của bạn không đúng. Hãy mở file route.ts và sửa lại đường dẫn trong biến dumpCmd."
            : "Lỗi hệ thống khi chạy sao lưu.";
            
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}