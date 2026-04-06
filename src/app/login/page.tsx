"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Lock, User, Eye, EyeOff, Loader2, Zap } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  console.log(">>> Đã bấm nút đăng nhập!"); // Thêm dòng này
  console.log("Dữ liệu gửi đi:", { username, password }); // Thêm dòng này
  
  setLoading(true);
  setError("");

  try {
    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });
    console.log(">>> Kết quả từ NextAuth:", res); // Thêm dòng này

    if (res?.error) {
      setError("Tài khoản hoặc mật khẩu không chính xác!");
      setLoading(false);
    } else {
      console.log(">>> Đăng nhập thành công, đang chuyển hướng...");
      window.location.href = "/dashboard"; // Dùng cái này thay cho router.push để ép tải lại trang
    }
  } catch (err) {
    console.error(">>> Lỗi khi gọi hàm signIn:", err);
    setLoading(false);
  }
};

  return (
    // ---------- BACKGROUND NỀN CHÍNH ----------
    <div className="flex items-center justify-center min-h-screen bg-slate-50 p-6 relative overflow-hidden">
      
      {/* Hình tròn trang trí mờ nổi trên background */}
      <div className="absolute top-1/4 left-10 h-32 w-32 bg-red-100 backdrop-blur-sm rounded-full opacity-60 z-0"></div>
      <div className="absolute bottom-10 right-20 h-40 w-40 bg-red-100 backdrop-blur-sm rounded-full opacity-60 z-0"></div>

      {/* ---------- POPUP CONTAINER LỚN (NỔI LÊN) ---------- */}
      <div className="max-w-7xl w-full bg-white rounded-[40px] shadow-[0_35px_100px_-15px_rgba(0,0,0,0.15)] overflow-hidden relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2">
          
          {/* ---------- PHẦN TRÁI: FORM ĐĂNG NHẬP (TRẮNG) ---------- */}
          <div className="p-16 space-y-10 flex flex-col items-center justify-center border-r border-gray-100">
            
            {/* Site Logo */}
            <div className="flex flex-col items-center gap-3">
              <div className="bg-red-600 p-3 rounded-2xl shadow-lg shadow-red-500/20">
                <Zap className="h-8 w-8 text-white" />
               
              </div>
              <h1 className="text-4xl font-extrabold text-black tracking-tight">
                Sano <span className="text-red-600">Workspace</span>
              </h1>
            </div>

            <div className="flex flex-col items-center gap-2">
              <h2 className="text-2xl font-bold text-black uppercase tracking-widest">Đăng Nhập</h2>
              <p className="text-slate-600 text-base text-center">Chào mừng bạn trở lại hệ thống quản trị.</p>
            </div>
            
            <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
              {/* Tên đăng nhập */}
              <div className="relative">
                <User className="absolute left-4 top-3.5 h-6 w-6 text-slate-400" />
                <input
                  type="text"
                  required
                  className="w-full bg-slate-100 border border-slate-200 text-black rounded-xl py-3.5 pl-12 pr-4 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                  placeholder="Tên đăng nhập"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              
              {/* Mật khẩu */}
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 h-6 w-6 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full bg-slate-100 border border-slate-200 text-black rounded-xl py-3.5 pl-12 pr-12 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                  placeholder="Mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-3.5 text-slate-400 hover:text-red-600"
                >
                  {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                </button>
              </div>
              
              {error && <p className="text-red-600 text-sm bg-red-50 p-4 rounded-xl border border-red-200 font-medium text-center">{error}</p>}
              
              {/* Nút đăng nhập */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-all shadow-md active:scale-[0.98]"
              >
                {loading ? <Loader2 className="animate-spin" /> : "Vào hệ thống ngay"}
              </button>
            </form>
            
            {/* Phân tách */}
            {/* <div className="w-full max-w-sm flex items-center gap-3">
              <div className="flex-grow h-px bg-slate-200"></div>
              <p className="text-sm text-slate-500 whitespace-nowrap">Hoặc đăng nhập bằng</p>
              <div className="flex-grow h-px bg-slate-200"></div>
            </div> */}
            
            {/* Đăng nhập mạng xã hội */}
            {/* <div className="w-full max-w-sm space-y-4">
              <button className="w-full bg-white border border-slate-200 text-black font-semibold py-3.5 rounded-xl shadow-sm flex items-center justify-center gap-3 hover:bg-slate-50 transition-all active:scale-[0.98]">
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="h-5 w-5" />
                Đăng nhập với Google
              </button>
              <button className="w-full bg-white border border-slate-200 text-black font-semibold py-3.5 rounded-xl shadow-sm flex items-center justify-center gap-3 hover:bg-slate-50 transition-all active:scale-[0.98]">
                <img src="https://www.svgrepo.com/show/475647/facebook-color.svg" alt="Facebook" className="h-5 w-5" />
                Đăng nhập với Facebook
              </button>
            </div> */}
          </div>

          {/* ---------- PHẦN PHẢI: HÌNH ẢNH HỆ THỐNG ---------- */}
          <div className="bg-red-600 p-16 flex items-center justify-center relative overflow-hidden">
            
            {/* Vân nền */}
            <div className="absolute inset-0 opacity-10">
              <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path d="M0,0 C20,20 80,80 100,100" stroke="white" strokeWidth="0.5" fill="none" />
                <path d="M0,20 C20,40 80,100 100,120" stroke="white" strokeWidth="0.5" fill="none" />
                <path d="M0,40 C20,60 80,120 100,140" stroke="white" strokeWidth="0.5" fill="none" />
              </svg>
            </div>
            
            {/* Khung kính mờ và ảnh */}
            <div className="w-full max-w-md bg-white/10 backdrop-blur-lg rounded-[2.5rem] border border-white/10 p-4 shadow-2xl relative z-10">
              <img 
                src="https://i.ibb.co/39FCHZsV/Untitled-1.png" 
                alt="Sano Workspace Dashboard" 
                className="w-full h-auto rounded-[2rem]" 
              />
              <div className="absolute top-1/2 left-0 transform -translate-x-1/2 -translate-y-1/2 bg-white p-3 rounded-full shadow-lg">
                <Zap className="h-6 w-6 text-red-600 fill-red-600" />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* ---------- FOOTER THÔNG TIN ---------- */}
      <div className="absolute bottom-6 left-12 flex items-center gap-3 text-slate-600 z-10">
        <div className="h-10 w-10 rounded-full bg-red-600 flex items-center justify-center text-white font-bold border-2 border-white shadow-sm">S</div>
        <div className="text-sm">
          <p className="font-semibold text-black">Sano Team</p>
          <p>Hỗ trợ nội bộ 24/7</p>
        </div>
      </div>
      <p className="absolute bottom-6 right-12 text-slate-400 text-sm z-10 font-bold tracking-widest uppercase">© 2026 Sano Workspace</p>
    </div>
  );
}