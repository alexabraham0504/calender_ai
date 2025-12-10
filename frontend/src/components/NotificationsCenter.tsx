import React, { useState, useEffect } from 'react';
import { auth } from '../config/firebase';
import { logger } from '../utils/logger';

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
    createdAt: { _seconds: number };
    eventId?: string;
    workspaceId?: string;
}

type FilterType = 'all' | 'unread' | 'events' | 'system';

const NotificationsCenter: React.FC = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterType>('all');
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            setIsAuthenticated(!!user);
            if (user) {
                fetchNotifications();
            } else {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [filter]);

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            const user = auth.currentUser;
            if (!user) return;

            const token = await user.getIdToken();

            let url = 'http://localhost:5000/api/notifications/list?limit=50';
            if (filter === 'unread') url += '&read=false';
            if (filter === 'events') url += '&type=eventReminder';

            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                const data = await res.json();
                let notifs = data.notifications || [];

                // Apply client-side filter for 'system'
                if (filter === 'system') {
                    notifs = notifs.filter((n: Notification) =>
                        ['workspaceInvite', 'workspaceRoleUpdate', 'general'].includes(n.type)
                    );
                }

                setNotifications(notifs);
            }
        } catch (error) {
            logger.error('Error fetching notifications', error);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (notificationId: string) => {
        try {
            const user = auth.currentUser;
            if (!user) return;

            const token = await user.getIdToken();
            await fetch(`http://localhost:5000/api/notifications/${notificationId}/read`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });

            setNotifications(prev =>
                prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
            );
        } catch (error) {
            logger.error('Error marking notification as read', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            const user = auth.currentUser;
            if (!user) return;

            const token = await user.getIdToken();
            await fetch('http://localhost:5000/api/notifications/mark-all-read', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });

            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        } catch (error) {
            logger.error('Error marking all as read', error);
        }
    };

    const deleteNotification = async (notificationId: string) => {
        try {
            const user = auth.currentUser;
            if (!user) return;

            const token = await user.getIdToken();
            await fetch(`http://localhost:5000/api/notifications/${notificationId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });

            setNotifications(prev => prev.filter(n => n.id !== notificationId));
        } catch (error) {
            logger.error('Error deleting notification', error);
        }
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'eventReminder': return '⏰';
            case 'eventCreated': return '📅';
            case 'eventUpdate': return '✏️';
            case 'eventDeleted': return '🗑️';
            case 'workspaceInvite': return '✉️';
            case 'workspaceRoleUpdate': return '👤';
            case 'aiSuggestion': return '🤖';
            default: return '📢';
        }
    };

    const formatTime = (timestamp: { _seconds: number }) => {
        const date = new Date(timestamp._seconds * 1000);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffSecs = diffMs / 1000;

        if (diffSecs < 60) return 'just now';
        if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
        if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
        if (diffSecs < 604800) return `${Math.floor(diffSecs / 86400)}d ago`;

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        });
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 flex items-center justify-center p-4">
                <div className="text-center max-w-md">
                    <div className="text-8xl mb-6 animate-bounce">🔒</div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
                        Authentication Required
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-8">
                        Please log in to view your notifications and stay updated with your calendar activities.
                    </p>
                    <a
                        href="/login"
                        className="inline-flex items-center px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                        </svg>
                        Go to Login
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 py-8">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header with Gradient */}
                <div className="mb-8 text-center">
                    <div className="inline-block p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-lg mb-4">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-3">
                        Notifications
                    </h1>
                    <p className="text-lg text-gray-600 dark:text-gray-400">
                        Stay connected with all your calendar activities
                    </p>
                </div>

                {/* Filters & Actions Card */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-8 border border-gray-100 dark:border-gray-700">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        {/* Filter Tabs */}
                        <div className="flex flex-wrap gap-2">
                            {(['all', 'unread', 'events', 'system'] as FilterType[]).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-5 py-2.5 rounded-xl font-semibold transition-all transform hover:scale-105 ${filter === f
                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/50'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                        }`}
                                >
                                    <span className="capitalize">{f}</span>
                                    {f === 'unread' && notifications.filter(n => !n.read).length > 0 && (
                                        <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                                            {notifications.filter(n => !n.read).length}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Mark All Read Button */}
                        {notifications.some(n => !n.read) && (
                            <button
                                onClick={markAllAsRead}
                                className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-semibold hover:from-green-600 hover:to-emerald-600 shadow-lg shadow-green-500/50 transition-all transform hover:scale-105 flex items-center"
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Mark all as read
                            </button>
                        )}
                    </div>
                </div>

                {/* Notifications List */}
                <div className="space-y-4">
                    {loading ? (
                        <div className="text-center py-20">
                            <div className="inline-flex items-center justify-center w-16 h-16 mb-6">
                                <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
                            </div>
                            <p className="text-xl font-medium text-gray-600 dark:text-gray-400">Loading notifications...</p>
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-16 text-center border border-gray-100 dark:border-gray-700">
                            <div className="text-8xl mb-6 animate-bounce">🔔</div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                                All Clear!
                            </h3>
                            <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
                                {filter === 'all'
                                    ? "You're all caught up! No notifications to show."
                                    : `No ${filter} notifications found`}
                            </p>
                            {filter !== 'all' && (
                                <button
                                    onClick={() => setFilter('all')}
                                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg"
                                >
                                    View All Notifications
                                </button>
                            )}
                        </div>
                    ) : (
                        notifications.map((notification, index) => (
                            <div
                                key={notification.id}
                                className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg transition-all duration-300 hover:shadow-2xl transform hover:-translate-y-1 border-l-4 overflow-hidden group ${!notification.read
                                    ? 'border-blue-600 dark:border-blue-500 shadow-blue-500/20'
                                    : 'border-transparent'
                                    }`}
                                style={{
                                    animation: `fadeInUp 0.5s ease-out ${index * 0.1}s both`
                                }}
                            >
                                <div className="p-6">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start space-x-4 flex-1">
                                            {/* Icon with Gradient Background */}
                                            <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center text-3xl transform group-hover:scale-110 group-hover:rotate-6 transition-all ${!notification.read
                                                ? 'bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50'
                                                : 'bg-gray-100 dark:bg-gray-700'
                                                }`}>
                                                {getNotificationIcon(notification.type)}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                        {notification.title}
                                                    </h3>
                                                    {!notification.read && (
                                                        <span className="px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-semibold rounded-full animate-pulse shadow-lg">
                                                            NEW
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-base text-gray-600 dark:text-gray-300 mb-3 leading-relaxed">
                                                    {notification.message}
                                                </p>
                                                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <span className="font-medium">{formatTime(notification.createdAt)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {!notification.read && (
                                                <button
                                                    onClick={() => markAsRead(notification.id)}
                                                    className="p-3 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-all transform hover:scale-110"
                                                    title="Mark as read"
                                                >
                                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </button>
                                            )}
                                            <button
                                                onClick={() => deleteNotification(notification.id)}
                                                className="p-3 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all transform hover:scale-110"
                                                title="Delete"
                                            >
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Custom Animations */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(30px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                `
            }} />
        </div>
    );
};

export default NotificationsCenter;
