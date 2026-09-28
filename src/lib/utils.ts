// 🚀 LOGIC MỚI: CẮT GỌN TUẦN THEO BIÊN THÁNG
export function getContinuousWeekRange(year: number, month: number, weekNumber: number) {
    const totalDays = new Date(year, month, 0).getDate(); 
    const startDayOfWeek = new Date(year, month - 1, 1).getDay(); 
    const diffToSunday = startDayOfWeek === 0 ? 0 : 7 - startDayOfWeek;
    const firstSunday = 1 + diffToSunday;

    let startDay = 1;
    let endDay = firstSunday;

    if (weekNumber > 1) {
        startDay = firstSunday + (weekNumber - 2) * 7 + 1;
        endDay = Math.min(startDay + 6, totalDays); 
    }

    const startOfWeek = new Date(year, month - 1, startDay);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(year, month - 1, endDay);
    endOfWeek.setHours(23, 59, 59, 999);

    const pad = (num: number) => num.toString().padStart(2, '0');
    const formatDate = (date: Date) => `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;

    return {
        start: startOfWeek,
        end: endOfWeek,
        label: `Tuần ${weekNumber} (${formatDate(startOfWeek)} - ${formatDate(endOfWeek)})` 
    };
}

export function getCurrentWeekNumber(date: Date = new Date()) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const currentDate = d.getDate();

    const startDayOfWeek = new Date(year, month - 1, 1).getDay();
    const diffToSunday = startDayOfWeek === 0 ? 0 : 7 - startDayOfWeek;
    const firstSunday = 1 + diffToSunday;

    let week = 1;
    if (currentDate > firstSunday) {
        week = 2 + Math.floor((currentDate - firstSunday - 1) / 7);
    }
    return week;
}

export function getAvailableWeeks(year: number, month: number) {
    const totalDays = new Date(year, month, 0).getDate();
    const startDayOfWeek = new Date(year, month - 1, 1).getDay();
    const diffToSunday = startDayOfWeek === 0 ? 0 : 7 - startDayOfWeek;
    const firstSunday = 1 + diffToSunday;

    const remainingDays = totalDays - firstSunday;
    const totalWeeks = 1 + Math.ceil(remainingDays / 7);

    return Array.from({ length: totalWeeks }, (_, i) => i + 1);
}

export function getCurrentWeekInfo(date: Date = new Date()) {
    return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        week: getCurrentWeekNumber(date)
    };
}

export const formatMessageDate = (dateString: any) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Hôm nay";
    if (date.toDateString() === yesterday.toDateString()) return "Hôm qua";

    return date.toLocaleDateString('vi-VN', {
        weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric'
    });
};