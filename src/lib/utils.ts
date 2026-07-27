export function getContinuousWeekRange(year: number, month: number, weekNumber: number) {
    // Lấy ngày mùng 1 của tháng
    const firstDayOfMonth = new Date(year, month - 1, 1);
    
    // Tìm ngày Thứ 2 của tuần chứa mùng 1
    const dayOfWeek = firstDayOfMonth.getDay(); 
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startOfFirstWeek = new Date(year, month - 1, 1 + diffToMonday);

    // Tính ngày Thứ 2 của tuần được chọn
    const startOfWeek = new Date(startOfFirstWeek);
    startOfWeek.setDate(startOfFirstWeek.getDate() + (weekNumber - 1) * 7);

    // Tính ngày Chủ nhật của tuần đó
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const pad = (num: number) => num.toString().padStart(2, '0');
    const formatDate = (date: Date) => `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;

    return {
        start: startOfWeek,
        end: endOfWeek,
        // Ví dụ: Tuần 1 (30/03/2026 - 05/04/2026)
        label: `Tuần ${weekNumber} (${formatDate(startOfWeek)} - ${formatDate(endOfWeek)})` 
    };
}

export function getCurrentWeekNumber(date: Date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    
    // Đưa ngày hiện tại về mốc 0h00 để so sánh cho chuẩn
    const todayTime = new Date(year, month - 1, date.getDate()).getTime();

    for (let w = 1; w <= 5; w++) {
        const range = getContinuousWeekRange(year, month, w);
        const startTime = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate()).getTime();
        const endTime = new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate()).getTime();
        
        if (todayTime >= startTime && todayTime <= endTime) {
            // Giới hạn max là tuần 4 (Nếu sang tuần 5 thì vẫn gộp số liệu vào tuần 4)
            return w; 
        }
    }
    return 1;
}
