// Shared Event type for calendar events
// Using a different name from the DOM Event interface to avoid conflicts
export interface CalendarEvent {
    _id: string;
    title: string;
    startDate: string;
    endDate: string;
    description?: string;
    recurrence: string;
    color?: string;
    location?: string;
    priority?: 'low' | 'medium' | 'high';
    createdBy?: string;
}
