"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { User, Lock, Shield, Users, Save, Loader2, KeyRound, Camera } from "lucide-react";
import { useToast } from "@/app/component/ToastProvider";

export default function ProfilePage() {
    const { data: session, update } = useSession();
    const currentUser = session?.user as any;
    const { showToast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // States lưu trữ dữ liệu form
    const [fullName, setFullName] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [avatarUrl, setAvatarUrl] = useState<string | null>(null); 
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null); 
    const [isUploading, setIsUploading] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const [teamName, setTeamName] = useState<string>("Đang tải...");

    useEffect(() => {
        if (currentUser?.name) {
            setFullName(currentUser.name);
            setAvatarUrl(currentUser.avatarUrl || null);
        }
    }, [currentUser]);

    // 🚀 TỰ ĐỘNG DỊCH TEAM ID SANG TÊN TEAM
    useEffect(() => {
        if (!currentUser?.teamId) {
            setTeamName("Chưa được phân Team");
            return;
        }

        const fetchTeamInfo = async () => {
            try {
                const res = await fetch("/api/teams");
                if (res.ok) {
                    const teams = await res.json();
                    const myTeam = teams.find((t: any) => t.id === currentUser.teamId);
                    setTeamName(myTeam ? myTeam.name : "Team không tồn tại");
                } else {
                    setTeamName("Không thể tải thông tin Team");
                }
            } catch (error) {
                setTeamName("Lỗi kết nối");
            }
        };

        fetchTeamInfo();
    }, [currentUser?.teamId]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            showToast("error", "Chỉ chấp nhận file ảnh!");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showToast("error", "Ảnh quá lớn (tối đa 5MB)!");
            return;
        }

        const objectUrl = URL.createObjectURL(file);
        setAvatarPreview(objectUrl);
        setIsUploading(true);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const uploadRes = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            const uploadData = await uploadRes.json();

            if (!uploadRes.ok) throw new Error(uploadData.error);

            const newImageUrl = uploadData.url; 

            setAvatarUrl(newImageUrl);
            showToast("success", "Đã tải ảnh lên, bấm Lưu để hoàn tất!");

        } catch (error: any) {
            console.error(">>> [AVATAR UPLOAD ERROR]:", error);
            showToast("error", error.message || "Lỗi khi upload ảnh!");
            setAvatarPreview(null); 
        } finally {
            setIsUploading(false);
            URL.revokeObjectURL(objectUrl);
        }
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password && password !== confirmPassword) {
            showToast("error", "Mật khẩu xác nhận không khớp!");
            return;
        }

        setIsLoading(true);
        
        try {
            const res = await fetch(`/api/users/${currentUser?.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fullName,
                    password: password || undefined,
                    avatarUrl: avatarUrl,
                    teamId: currentUser.teamId, 
                })
            });

            const data = await res.json();

            if (res.ok) {
                showToast("success", "Cập nhật hồ sơ thành công!");
                setPassword("");
                setConfirmPassword("");

                await update({ ...session, user: { ...session?.user, name: fullName } });
            } else {
                showToast("error", data.error || "Có lỗi xảy ra khi cập nhật!");
            }
        } catch (error) {
            console.error(">>> [PROFILE UPDATE ERROR]:", error);
            showToast("error", "Mất kết nối đến máy chủ!");
        } finally {
            setIsLoading(false);
        }
    };

    if (!currentUser) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="animate-spin text-red-600 h-8 w-8 md:h-10 md:w-10" />
            </div>
        );
    }

    return (
        // Responsive Padding: p-3 (Mobile) -> p-8 (PC)
        <div className="h-full flex flex-col p-3 sm:p-5 md:p-8 bg-slate-50 overflow-y-auto custom-scrollbar animate-fade-in">

            <div className="mb-6 md:mb-8">
                <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
                    <User className="text-red-600 w-5 h-5 md:w-6 md:h-6" /> Hồ Sơ Của Tôi
                </h1>
                <p className="text-xs md:text-sm font-medium text-slate-500 mt-1 md:mt-1.5">
                    Quản lý thông tin cá nhân và bảo mật tài khoản.
                </p>
            </div>

            <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-8 mx-auto">

                {/* CỘT TRÁI: AVATAR & THÔNG TIN CƠ BẢN */}
                <div className="lg:col-span-1 space-y-4 md:space-y-6">
                    <div className="bg-white p-5 md:p-8 rounded-2xl md:rounded-[32px] border border-slate-200 shadow-sm flex flex-col items-center text-center">
                        <div className="relative group mb-3 md:mb-5">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept="image/*"
                                className="hidden"
                            />

                            <div
                                className={`h-28 w-28 md:h-36 md:w-36 rounded-full flex items-center justify-center border-4 border-white shadow-lg overflow-hidden cursor-pointer relative ${isUploading ? 'opacity-70' : ''}`}
                                onClick={() => fileInputRef.current?.click()} 
                                title="Bấm để đổi ảnh đại diện"
                            >
                                {avatarPreview || avatarUrl ? (
                                    <img
                                        src={avatarPreview || avatarUrl!}
                                        alt="Avatar"
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="h-full w-full bg-red-100 flex items-center justify-center">
                                        <span className="text-4xl md:text-5xl font-black text-red-600">
                                            {fullName ? fullName.charAt(0).toUpperCase() : "U"}
                                        </span>
                                    </div>
                                )}

                                {isUploading && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                        <Loader2 className="animate-spin text-white h-6 w-6 md:h-8 md:w-8" />
                                    </div>
                                )}
                            </div>

                            {/* 🚀 Icon Camera: Luôn hiện trên Mobile (opacity-100), dạng ẩn/hiện hover trên PC */}
                            {!isUploading && (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute bottom-0 right-0 md:bottom-1 md:right-1 bg-red-600 text-white p-2 md:p-2.5 rounded-full shadow-md hover:bg-red-700 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 scale-90 md:scale-100"
                                >
                                    <Camera size={16} className="md:w-5 md:h-5" />
                                </button>
                            )}
                        </div>

                        <h2 className="text-lg md:text-xl font-bold text-slate-800 px-2">{fullName}</h2>
                        <span className="mt-2 md:mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 text-[10px] md:text-xs font-bold rounded-full uppercase tracking-wider">
                            <Shield size={14} className="md:w-4 md:h-4" /> {currentUser.role}
                        </span>
                    </div>

                    <div className="bg-blue-50/50 border border-blue-100 p-4 md:p-5 rounded-2xl md:rounded-[24px]">
                        <p className="text-xs md:text-sm text-blue-800 font-medium leading-relaxed">
                            💡 <strong className="font-bold">Lưu ý:</strong> Chức vụ và phòng ban của bạn được quản lý bởi Quản trị viên. Bạn không thể tự ý thay đổi các thông tin này.
                        </p>
                    </div>
                </div>

                {/* CỘT PHẢI: FORM CHỈNH SỬA */}
                <div className="lg:col-span-2">
                    <div className="bg-white p-5 md:p-8 rounded-2xl md:rounded-[32px] border border-slate-200 shadow-sm">
                        <form onSubmit={handleUpdateProfile} className="space-y-5 md:space-y-6">

                            <div className="border-b border-slate-100 pb-3 md:pb-4 mb-4 md:mb-6">
                                <h3 className="text-base md:text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <User size={18} className="md:w-5 md:h-5 text-slate-400" /> Thông Tin Cơ Bản
                                </h3>
                            </div>

                            <div>
                                <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1.5 md:mb-2">Họ và Tên</label>
                                <input
                                    type="text"
                                    required
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-2.5 px-3 md:py-3 md:px-4 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all font-medium"
                                    placeholder="Nhập họ và tên của bạn"
                                />
                            </div>

                            {/* Các trường Read-Only */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
                                <div>
                                    <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1.5 md:mb-2">Chức vụ (Role)</label>
                                    <div className="w-full bg-slate-100 border border-slate-200 text-slate-500 rounded-xl py-2.5 px-3 md:py-3 md:px-4 text-sm md:text-base font-bold flex items-center gap-2 cursor-not-allowed">
                                        <Shield size={16} className="md:w-[18px] md:h-[18px] text-slate-400 shrink-0" />
                                        <span className="truncate">{currentUser.role}</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1.5 md:mb-2">Phòng ban (Team)</label>
                                    <div className="w-full bg-slate-100 border border-slate-200 text-slate-500 rounded-xl py-2.5 px-3 md:py-3 md:px-4 text-sm md:text-base font-bold flex items-center gap-2 cursor-not-allowed">
                                        <Users size={16} className="md:w-[18px] md:h-[18px] text-slate-400 shrink-0" />
                                        <span className="truncate">{teamName}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="border-b border-slate-100 pb-3 md:pb-4 pt-2 md:pt-4 mb-4 md:mb-6 mt-4 md:mt-8">
                                <h3 className="text-base md:text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <KeyRound size={18} className="md:w-5 md:h-5 text-slate-400" /> Bảo Mật (Tùy chọn)
                                </h3>
                                <p className="text-xs md:text-sm text-slate-500 mt-1 font-medium">Bỏ trống nếu bạn không muốn thay đổi mật khẩu.</p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
                                <div>
                                    <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1.5 md:mb-2">Mật khẩu mới</label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-2.5 px-3 md:py-3 md:px-4 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all font-medium placeholder:font-normal"
                                        placeholder="Nhập mật khẩu mới..."
                                        minLength={6}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1.5 md:mb-2">Xác nhận mật khẩu</label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-2.5 px-3 md:py-3 md:px-4 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all font-medium placeholder:font-normal"
                                        placeholder="Nhập lại mật khẩu..."
                                        minLength={6}
                                    />
                                </div>
                            </div>

                            {/* 🚀 NÚT LƯU: Tràn 100% trên Mobile, dồn góc phải trên PC */}
                            <div className="pt-4 md:pt-6 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-bold py-3 md:py-3.5 px-6 md:px-8 rounded-xl md:rounded-2xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed text-sm md:text-base"
                                >
                                    {isLoading ? <Loader2 size={18} className="animate-spin md:w-5 md:h-5" /> : <Save size={18} className="md:w-5 md:h-5" />}
                                    {isLoading ? "Đang lưu..." : "Lưu Thay Đổi"}
                                </button>
                            </div>

                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}