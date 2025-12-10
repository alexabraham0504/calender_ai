import React, { useState, useEffect } from 'react';
import { db, auth } from '../config/firebase';
import SmartComposeInput from './SmartComposeInput';
import AISuggestionsModal from './AISuggestionsModal';
import type { AIResponse, ParsedIntent, ScheduleResult } from '../types/ai';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import Holidays from 'date-holidays';
import { logger } from '../utils/logger';

// Initialize holidays for India (matching user's timezone +05:30)
const hd = new Holidays('IN');
logger.info('Calendar component loaded, holidays initialized for India');

interface Event {
    _id: string;
    title: string;
    startDate: string;
    endDate: string;
    description?: string;
    recurrence: string;
    color?: string;
}

interface CalendarProps {
    onEditEvent: (event: Event) => void;
}

const Calendar: React.FC<CalendarProps> = ({ onEditEvent }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState<Event[]>([]);
    const [view, setView] = useState<'year' | 'month' | 'week' | 'day'>('month');
    const [loading, setLoading] = useState(true);
    const [synced, setSynced] = useState(false);
    const [isAIModalOpen, setIsAIModalOpen] = useState(false);
    const [aiIntent, setAiIntent] = useState<ParsedIntent | null>(null);

    useEffect(() => {
        logger.componentMount('Calendar');

        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                logger.success(`User authenticated in Calendar: ${user.uid}`);

                // Fetch user settings
                logger.debug('Fetching user settings...');
                fetch(`http://localhost:5000/api/settings`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                })
                    .then(res => res.json())
                    .then(data => {
                        logger.success('User settings loaded', data);
                        if (data.defaultView) {
                            setView(data.defaultView);
                            logger.debug(`Default view set to: ${data.defaultView}`);
                        }
                        if (data.theme === 'dark') {
                            document.documentElement.classList.add('dark');
                            logger.debug('Dark theme applied');
                        }
                    })
                    .catch(err => {
                        logger.error('Error loading settings', err);
                    });

                // Realtime Events Subscription
                logger.debug('Setting up realtime events subscription...');
                const q = query(
                    collection(db, 'events'),
                    where('userId', '==', user.uid)
                );

                const unsubscribeEvents = onSnapshot(q, (snapshot) => {
                    const eventsData = snapshot.docs.map(doc => ({
                        _id: doc.id,
                        ...doc.data()
                    })) as Event[];

                    logger.success(`Events synced: ${eventsData.length} events loaded`);
                    logger.table(eventsData.map(e => ({ id: e._id, title: e.title, date: e.startDate })));

                    setEvents(eventsData);
                    setLoading(false);
                    setSynced(true);
                    setTimeout(() => setSynced(false), 2000);
                }, (error) => {
                    logger.error('Error fetching events from Firestore', error);
                    setLoading(false);
                });

                return () => {
                    logger.debug('Unsubscribing from events');
                    unsubscribeEvents();
                };
            } else {
                logger.warn('No user authenticated, clearing events');
                setEvents([]);
                setLoading(false);
            }
        });

        return () => {
            logger.componentUnmount('Calendar');
            unsubscribeAuth();
        };
    }, []);

    const handleDelete = async (id: string) => {
        logger.userAction('Delete event requested', { eventId: id });

        if (!confirm('Are you sure you want to delete this event?')) {
            logger.debug('Delete cancelled by user');
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
            logger.error('No auth token found for delete operation');
            return;
        }

        try {
            logger.debug(`Deleting event: ${id}`);
            const startTime = performance.now();

            await fetch(`http://localhost:5000/api/events/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });

            const duration = Math.round(performance.now() - startTime);
            logger.success(`Event deleted successfully in ${duration}ms`, { eventId: id });
        } catch (error) {
            logger.error('Error deleting event', error);
        }
    };

    const handleIntentParsed = (response: AIResponse) => {
        if (response.parsedIntent) {
            setAiIntent(response.parsedIntent);
            setIsAIModalOpen(true);
        }
    };

    const handleScheduled = (result: ScheduleResult) => {
        logger.success('Event scheduled via AI', result);
        setIsAIModalOpen(false);
        setAiIntent(null);
    };

    const handleClarification = (question: string) => {
        alert(`AI Clarification Needed: ${question}`);
    };

    const daysInMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    };

    const firstDayOfMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    };

    const getStartOfWeek = (date: Date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day;
        return new Date(d.setDate(diff));
    };

    const getHolidaysForDate = (date: Date) => {
        // hd.isHoliday returns false or an array of holidays
        // We want to capture all types of holidays/observances
        const holidays = hd.isHoliday(date);
        if (holidays && Array.isArray(holidays)) {
            return holidays;
        }
        return [];
    };

    const renderYearView = () => {
        const months = Array.from({ length: 12 }, (_, i) => i);
        const currentYear = currentDate.getFullYear();
        const allHolidays = hd.getHolidays(currentYear);

        return (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {months.map(monthIndex => {
                    const date = new Date(currentYear, monthIndex, 1);
                    const monthName = date.toLocaleString('default', { month: 'long' });
                    const days = daysInMonth(date);
                    const firstDay = firstDayOfMonth(date);
                    const blanks = Array(firstDay).fill(null);
                    const dayArray = Array.from({ length: days }, (_, i) => i + 1);

                    // Filter holidays for this month
                    const monthHolidays = allHolidays.filter(h => {
                        const hDate = new Date(h.date);
                        return hDate.getMonth() === monthIndex;
                    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                    return (
                        <div
                            key={monthIndex}
                            className="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm hover:shadow-md transition cursor-pointer group flex flex-col"
                            onClick={() => { setCurrentDate(date); setView('month'); }}
                        >
                            <h3 className="text-lg font-bold text-center mb-3 text-gray-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{monthName}</h3>
                            <div className="grid grid-cols-7 text-xs text-center text-gray-400 mb-2 font-medium">
                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => <div key={d}>{d}</div>)}
                            </div>
                            <div className="grid grid-cols-7 text-sm gap-y-2 gap-x-1 mb-4">
                                {blanks.map((_, i) => <div key={`b-${i}`}></div>)}
                                {dayArray.map(d => {
                                    const currentDayDate = new Date(currentYear, monthIndex, d);
                                    // Use local date format
                                    const year = currentDayDate.getFullYear();
                                    const month = String(currentDayDate.getMonth() + 1).padStart(2, '0');
                                    const dayStr = String(currentDayDate.getDate()).padStart(2, '0');
                                    const dateStr = `${year}-${month}-${dayStr}`;
                                    const hasEvents = events.some(e => e.startDate.substring(0, 10) === dateStr);
                                    const isHoliday = getHolidaysForDate(currentDayDate).length > 0;
                                    const isToday = new Date().toISOString().split('T')[0] === dateStr;

                                    return (
                                        <div
                                            key={d}
                                            className={`text-center w-6 h-6 mx-auto flex items-center justify-center rounded-full text-xs
                                                ${isToday ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300'} 
                                                ${hasEvents && !isToday ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold' : ''}
                                                ${isHoliday && !isToday && !hasEvents ? 'text-green-600 dark:text-green-400 font-bold bg-green-50 dark:bg-green-900/20' : ''}
                                            `}
                                        >
                                            {d}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Holidays List for the Month */}
                            {monthHolidays.length > 0 && (
                                <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-700">
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Holidays</p>
                                    <div className="space-y-1">
                                        {monthHolidays.map((h, idx) => (
                                            <div key={idx} className="text-xs text-gray-600 dark:text-gray-400 flex items-start">
                                                <span className="text-green-500 mr-1">•</span>
                                                <span className="truncate" title={h.name}>
                                                    <span className="font-medium mr-1">{new Date(h.date).getDate()}:</span>
                                                    {h.name}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    const getHolidaysInRange = (startDate: Date, endDate: Date) => {
        const startYear = startDate.getFullYear();
        const endYear = endDate.getFullYear();
        let holidays = hd.getHolidays(startYear);
        if (startYear !== endYear) {
            holidays = [...holidays, ...hd.getHolidays(endYear)];
        }

        return holidays.filter(h => {
            const hDate = new Date(h.date);
            hDate.setHours(0, 0, 0, 0);
            const s = new Date(startDate); s.setHours(0, 0, 0, 0);
            const e = new Date(endDate); e.setHours(0, 0, 0, 0);
            return hDate >= s && hDate <= e;
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    };

    const renderHolidaysList = (holidays: any[], title: string) => {
        if (!holidays || holidays.length === 0) return null;
        return (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700">
                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    {title}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {holidays.map((h, idx) => (
                        <div key={idx} className="flex items-center text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                            <span className="font-bold text-green-600 dark:text-green-400 mr-2 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded text-xs">
                                {new Date(h.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                            <span className="truncate" title={h.name}>{h.name}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderMonthView = () => {
        const days = daysInMonth(currentDate);
        const firstDay = firstDayOfMonth(currentDate);
        const blanks = Array(firstDay).fill(null);
        const dayArray = Array.from({ length: days }, (_, i) => i + 1);

        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        const monthHolidays = getHolidaysInRange(monthStart, monthEnd);

        return (
            <>
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-gray-800">
                    <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                            <div key={day} className="py-3 text-center text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {day}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 bg-white dark:bg-gray-800">
                        {blanks.map((_, i) => (
                            <div key={`blank-${i}`} className="h-32 border-b border-r border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-900/30"></div>
                        ))}
                        {dayArray.map((day) => {
                            const currentDayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                            // Use local date format instead of ISO to avoid timezone issues
                            const year = currentDayDate.getFullYear();
                            const month = String(currentDayDate.getMonth() + 1).padStart(2, '0');
                            const dayStr = String(currentDayDate.getDate()).padStart(2, '0');
                            const dateStr = `${year}-${month}-${dayStr}`;
                            const dayEvents = events.filter((e) => {
                                // Extract just the date part from the event's startDate
                                const eventDateStr = e.startDate.substring(0, 10);
                                return eventDateStr === dateStr;
                            });
                            const holidays = getHolidaysForDate(currentDayDate);
                            const isToday = new Date().toISOString().split('T')[0] === dateStr;

                            return (
                                <div
                                    key={day}
                                    className={`h-32 border-b border-r border-gray-100 dark:border-gray-700 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition relative group ${isToday ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}
                                    onClick={() => {
                                        // Optional: Click day to add event
                                    }}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mb-1 ${isToday ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                                            {day}
                                        </div>
                                        {holidays.length > 0 && (
                                            <div className="text-[10px] font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-1.5 py-0.5 rounded ml-auto max-w-[70%] truncate" title={holidays[0].name}>
                                                {holidays[0].name}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-1 overflow-y-auto max-h-[calc(100%-2rem)] custom-scrollbar mt-1">
                                        {dayEvents.map((e) => (
                                            <div
                                                key={e._id}
                                                onClick={(evt) => { evt.stopPropagation(); onEditEvent(e); }}
                                                className={`text-xs px-2 py-1 rounded-md text-white border border-white/20 truncate cursor-pointer hover:opacity-90 transition flex justify-between items-center group/event shadow-sm`}
                                                style={{ backgroundColor: e.color || '#3b82f6' }}
                                            >
                                                <span className="truncate font-medium">{e.title}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                {renderHolidaysList(monthHolidays, `Holidays in ${currentDate.toLocaleString('default', { month: 'long' })}`)}
            </>
        );
    };

    const renderWeekView = () => {
        const startOfWeek = getStartOfWeek(currentDate);
        const weekDays = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            return d;
        });

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        const weekHolidays = getHolidaysInRange(startOfWeek, endOfWeek);

        return (
            <>
                <div className="grid grid-cols-7 gap-2">
                    {weekDays.map((date) => {
                        const holidays = getHolidaysForDate(date);
                        return (
                            <div key={date.toISOString()} className="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 min-h-[400px] p-2 shadow-sm flex flex-col">
                                <div className={`font-bold text-center p-2 mb-2 rounded-lg ${date.toDateString() === new Date().toDateString() ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : 'bg-gray-50 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                                    {date.toLocaleDateString('default', { weekday: 'short', day: 'numeric' })}
                                </div>

                                {holidays.length > 0 && (
                                    <div className="mb-2 px-1">
                                        {holidays.map((h, idx) => (
                                            <div key={idx} className="text-xs text-center bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded py-1 px-2 mb-1 truncate" title={h.name}>
                                                {h.name}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="space-y-2 flex-1">
                                    {events
                                        .filter((e) => {
                                            const year = date.getFullYear();
                                            const month = String(date.getMonth() + 1).padStart(2, '0');
                                            const day = String(date.getDate()).padStart(2, '0');
                                            const localDateStr = `${year}-${month}-${day}`;
                                            return e.startDate.substring(0, 10) === localDateStr;
                                        })
                                        .map((e) => (
                                            <div
                                                key={e._id}
                                                onClick={() => onEditEvent(e)}
                                                className="text-sm text-white p-2 rounded-lg shadow-sm cursor-pointer hover:opacity-90 transition"
                                                style={{ backgroundColor: e.color || '#3b82f6' }}
                                            >
                                                <div className="font-semibold truncate">{e.title}</div>
                                                <div className="text-xs opacity-90">
                                                    {new Date(e.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
                {renderHolidaysList(weekHolidays, "Holidays this Week")}
            </>
        );
    };

    const renderDayView = () => {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        const dayEvents = events.filter((e) => e.startDate.substring(0, 10) === dateStr);
        const holidays = getHolidaysForDate(currentDate);
        const holidaysList = Array.isArray(holidays) ? holidays : [];

        return (
            <>
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 min-h-[500px] p-6 shadow-sm">
                    <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-4 mb-6">
                        <h3 className="text-2xl font-bold text-gray-800 dark:text-white">
                            {currentDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </h3>
                        {holidays.length > 0 && (
                            <div className="flex space-x-2">
                                {holidays.map((h, idx) => (
                                    <span key={idx} className="bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 px-3 py-1 rounded-full text-sm font-medium">
                                        🎉 {h.name}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        {dayEvents.length === 0 ? (
                            <div className="text-center py-10 text-gray-400 dark:text-gray-500">
                                <p className="text-lg">No events scheduled for this day.</p>
                            </div>
                        ) : (
                            dayEvents.map((e) => (
                                <div
                                    key={e._id}
                                    className="border-l-4 p-4 rounded-r-lg shadow-sm flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition cursor-pointer"
                                    style={{ borderLeftColor: e.color || '#3b82f6' }}
                                    onClick={() => onEditEvent(e)}
                                >
                                    <div>
                                        <h4 className="font-bold text-lg text-gray-800 dark:text-white">{e.title}</h4>
                                        <p className="text-gray-600 dark:text-gray-300 flex items-center mt-1">
                                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                            {new Date(e.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                                            {new Date(e.endDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                        {e.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{e.description}</p>}
                                    </div>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={(evt) => { evt.stopPropagation(); handleDelete(e._id); }}
                                            className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                                            title="Delete Event"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 000-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
                {renderHolidaysList(holidaysList, "Holidays Today")}
            </>
        );
    };

    const changeDate = (offset: number) => {
        const newDate = new Date(currentDate);
        if (view === 'year') {
            newDate.setFullYear(newDate.getFullYear() + offset);
        } else if (view === 'month') {
            newDate.setMonth(newDate.getMonth() + offset);
        } else if (view === 'week') {
            newDate.setDate(newDate.getDate() + offset * 7);
        } else {
            newDate.setDate(newDate.getDate() + offset);
        }
        setCurrentDate(newDate);
    };

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto mt-10 p-6 bg-white shadow-xl rounded-2xl animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
                <div className="grid grid-cols-7 gap-4">
                    {[...Array(35)].map((_, i) => (
                        <div key={i} className="h-32 bg-gray-100 rounded"></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 bg-white dark:bg-gray-800 shadow-xl rounded-2xl max-w-7xl mx-auto mt-6 border border-gray-100 dark:border-gray-700 relative transition-colors duration-300">
            {synced && (
                <div className="absolute top-4 right-4 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 text-xs px-2 py-1 rounded-full flex items-center animate-fade-in-out">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                    Synced
                </div>
            )}

            <div className="mb-6">
                <SmartComposeInput
                    onIntentParsed={handleIntentParsed}
                    onClarificationNeeded={handleClarification}
                    className="max-w-2xl mx-auto"
                />
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center mb-8">
                <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                    <button
                        onClick={() => setView('year')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'year' ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}
                    >
                        Year
                    </button>
                    <button
                        onClick={() => setView('month')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'month' ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}
                    >
                        Month
                    </button>
                    <button
                        onClick={() => setView('week')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'week' ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}
                    >
                        Week
                    </button>
                    <button
                        onClick={() => setView('day')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'day' ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}
                    >
                        Day
                    </button>
                </div>

                <div className="flex items-center space-x-6">
                    <button onClick={() => changeDate(-1)} className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                    </button>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white min-w-[200px] text-center">
                        {view === 'year'
                            ? currentDate.getFullYear()
                            : view === 'month'
                                ? currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })
                                : currentDate.toLocaleDateString(undefined, { dateStyle: 'medium' })
                        }
                    </h2>
                    <button onClick={() => changeDate(1)} className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>

            {view === 'year' && renderYearView()}
            {view === 'month' && renderMonthView()}
            {view === 'week' && renderWeekView()}
            {view === 'day' && renderDayView()}

            {aiIntent && (
                <AISuggestionsModal
                    isOpen={isAIModalOpen}
                    onClose={() => setIsAIModalOpen(false)}
                    parsedIntent={aiIntent}
                    onScheduled={handleScheduled}
                />
            )}
        </div>
    );
};

export default Calendar;
