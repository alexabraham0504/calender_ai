/**
 * Calendar Month Image Helper
 * Provides utility functions to get assigned images for specific months
 */

export interface MonthAssignments {
    [month: number]: string; // month index (0-11) -> image ID
}

/**
 * Get the month assignments from localStorage
 */
export function getMonthAssignments(): MonthAssignments {
    try {
        const saved = localStorage.getItem('calendarMonthAssignments');
        return saved ? JSON.parse(saved) : {};
    } catch (error) {
        console.error('Error loading month assignments:', error);
        return {};
    }
}

/**
 * Get the image ID assigned to a specific month
 * @param month Month index (0-11, where 0 = January)
 */
export function getImageForMonth(month: number): string | null {
    const assignments = getMonthAssignments();
    return assignments[month] || null;
}

/**
 * Get the image URL for a specific month by fetching from the images list
 * @param month Month index (0-11)
 */
export async function getImageUrlForMonth(month: number): Promise<string | null> {
    const imageId = getImageForMonth(month);
    if (!imageId) return null;

    try {
        // In a real implementation, you'd fetch this from the API
        // For now, we'll rely on the frontend cache
        const images = await listCalendarImages();
        const image = images.find(img => img.id === imageId);
        return image?.url || null;
    } catch (error) {
        console.error('Error fetching image for month:', error);
        return null;
    }
}

/**
 * Import the API function (this is a placeholder)
 */
async function listCalendarImages(): Promise<any[]> {
    // This would import from your API client
    // For now, return empty array
    return [];
}
