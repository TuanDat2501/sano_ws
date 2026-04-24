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