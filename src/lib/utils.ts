export function getContinuousWeekRange(year: number, month: number, weekNumber: number) {
    // Lấy ngày mùng 1 của tháng
    const firstDayOfMonth = new Date(year, month - 1, 1);
    
    // Tìm ngày Thứ 2 của tuần chứa mùng 1
    const dayOfWeek = firstDayOfMonth.getDay(); 
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startOfFirstWeek = new Date(year, month - 1, 1 + diffToMonday);

    // 🚀 CHUẨN ISO 8601: Kiểm tra xem Thứ 5 của tuần này thuộc tháng nào
    const thursdayOfFirstWeek = new Date(startOfFirstWeek);
    thursdayOfFirstWeek.setDate(startOfFirstWeek.getDate() + 3);
    
    // Nếu Thứ 5 thuộc tháng trước -> Dịch tuần 1 của tháng này sang tuần kế tiếp
    if (thursdayOfFirstWeek.getMonth() !== month - 1) {
        startOfFirstWeek.setDate(startOfFirstWeek.getDate() + 7);
    }

    // Tính ngày Thứ 2 của tuần được chọn
    const startOfWeek = new Date(startOfFirstWeek);
    startOfWeek.setDate(startOfFirstWeek.getDate() + (weekNumber - 1) * 7);

    // Tính ngày Chủ nhật của tuần đó
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    // Chuẩn hóa thời gian 00:00:00 -> 23:59:59
    startOfWeek.setHours(0, 0, 0, 0);
    endOfWeek.setHours(23, 59, 59, 999);

    const pad = (num: number) => num.toString().padStart(2, '0');
    const formatDate = (date: Date) => `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;

    return {
        start: startOfWeek,
        end: endOfWeek,
        label: `Tuần ${weekNumber} (${formatDate(startOfWeek)} - ${formatDate(endOfWeek)})` 
    };
}

export function getCurrentWeekNumber(date: Date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    // Dò tìm ngày Thứ 5 của tuần hiện tại để biết tuần này thuộc về tháng nào
    const dayOfWeek = d.getDay();
    const diffToThursday = dayOfWeek === 0 ? -3 : 4 - dayOfWeek;
    const thursday = new Date(d);
    thursday.setDate(d.getDate() + diffToThursday);

    const targetYear = thursday.getFullYear();
    const targetMonth = thursday.getMonth() + 1;

    // Lấy ngày bắt đầu của tuần 1 thuộc tháng đó (targetMonth)
    const firstDayOfMonth = new Date(targetYear, targetMonth - 1, 1);
    const firstDayOfWeek = firstDayOfMonth.getDay();
    const diffToMonday = firstDayOfWeek === 0 ? -6 : 1 - firstDayOfWeek;
    const startOfFirstWeek = new Date(targetYear, targetMonth - 1, 1 + diffToMonday);

    const thursdayOfFirstWeek = new Date(startOfFirstWeek);
    thursdayOfFirstWeek.setDate(startOfFirstWeek.getDate() + 3);
    if (thursdayOfFirstWeek.getMonth() !== targetMonth - 1) {
        startOfFirstWeek.setDate(startOfFirstWeek.getDate() + 7);
    }

    // Tính khoảng cách giữa ngày hiện tại và ngày bắt đầu của tuần 1
    const diffTime = d.getTime() - startOfFirstWeek.getTime();
    const weekNumber = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000)) + 1;

    return weekNumber > 0 ? weekNumber : 1;
}

// ==============================================================
// 🚀 TẶNG THÊM: HÀM LẤY SỐ TUẦN (4 HOẶC 5) TRONG 1 THÁNG
// ==============================================================
export function getAvailableWeeks(year: number, month: number) {
    const weeks = [];
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const dayOfWeek = firstDayOfMonth.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startOfFirstWeek = new Date(year, month - 1, 1 + diffToMonday);

    const thursdayOfFirstWeek = new Date(startOfFirstWeek);
    thursdayOfFirstWeek.setDate(startOfFirstWeek.getDate() + 3);
    
    if (thursdayOfFirstWeek.getMonth() !== month - 1) {
        startOfFirstWeek.setDate(startOfFirstWeek.getDate() + 7);
    }

    for (let w = 1; w <= 5; w++) {
        const startOfWeek = new Date(startOfFirstWeek);
        startOfWeek.setDate(startOfFirstWeek.getDate() + (w - 1) * 7);
        
        const thursday = new Date(startOfWeek);
        thursday.setDate(startOfWeek.getDate() + 3);
        
        // Dừng lại nếu Thứ 5 của tuần này đã rơi qua tháng tiếp theo
        if (thursday.getMonth() !== month - 1) {
            break;
        }
        weeks.push(w);
    }
    return weeks;
}

// ==============================================================
// 🚀 TẶNG THÊM: HÀM LẤY ĐẦY ĐỦ (NĂM, THÁNG, TUẦN) CHUẨN CỦA HIỆN TẠI
// ==============================================================
export function getCurrentWeekInfo(date: Date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    const dayOfWeek = d.getDay();
    const diffToThursday = dayOfWeek === 0 ? -3 : 4 - dayOfWeek;
    const thursday = new Date(d);
    thursday.setDate(d.getDate() + diffToThursday);

    return {
        year: thursday.getFullYear(),
        month: thursday.getMonth() + 1,
        week: getCurrentWeekNumber(date)
    };
}