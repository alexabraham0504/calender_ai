import React, { useState, useEffect, useRef } from 'react';
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

interface NotificationDropdownProps {
    isOpen: boolean;
    onClose: () => void;
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ isOpen, onClose }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            fetchNotifications();
        }
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            const user = auth.currentUser;
            if (!user) return;

            const token = await user.getIdToken();
            const res = await fetch('http://localhost:5000/api/notifications/list?limit=20', {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                const data = await res.json();
                setNotifications(data.notifications || []);
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

            // Update local state
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

            // Update local state
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        } catch (error) {
            logger.error('Error marking all as read', error);
        }
    };

    const handleNotificationClick = (notification: Notification) => {
        markAsRead(notification.id);

        // Navigate based on notification type
        if (notification.eventId) {
            window.location.href = `/`;
        } else if (notification.workspaceId) {
            window.location.href = `/`;
        }

        onClose();
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'eventReminder':
                return '⏰';
            case 'eventCreated':
                return '📅';
            case 'eventUpdate':
                return '✏️';
            case 'eventDeleted':
                return '🗑️';
            case 'workspaceInvite':
                return '✉️';
            case 'workspaceRoleUpdate':
                return '👤';
            case 'aiSuggestion':
                return '🤖';
            default:
                return '📢';
        }
    };

    const formatTimeAgo = (timestamp: { _seconds: number }) => {
        const seconds = Date.now() / 1000 - timestamp._seconds;

        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
        return new Date(timestamp._seconds * 1000).toLocaleDateString();
    };

    if (!isOpen) return null;

    return (
        <div
            ref={dropdownRef}
            className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 z-50 transform transition-all"
            style={{
                animation: 'slideDown 0.2s ease-out'
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Notifications
                </h3>
                {notifications.some(n => !n.read) && (
                    <button
                        onClick={markAllAsRead}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                        Mark all read
                    </button>
                )}
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto">
                {loading ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        Loading...
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <div className="text-4xl mb-2">🔔</div>
                        <p>No notifications yet</p>
                    </div>
                ) : (
                    notifications.map(notification => (
                        <div
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className={`px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 cursor-pointer transition-all duration-200 group relative overflow-hidden ${notification.read
                                    ? 'bg-white dark:bg-gray-800/50 hover:bg-gradient-to-r hover:from-gray-50 hover:to-white dark:hover:from-gray-800/70 dark:hover:to-gray-800/50'
                                    : 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30 shadow-sm'
                                }`}
                        >
                            {/* Subtle hover effect overlay */}
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-purple-500/0 group-hover:from-blue-500/5 group-hover:to-purple-500/5 transition-all duration-300"></div>

                            <div className="flex items-start space-x-3 relative z-10">
                                <div className="text-2xl flex-shrink-0 transform group-hover:scale-110 transition-transform duration-200">
                                    {getNotificationIcon(notification.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        {notification.title}
                                    </p>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors">
                                        {notification.message}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {formatTimeAgo(notification.createdAt)}
                                    </p>
                                </div>
                                {!notification.read && (
                                    <span className="inline-block w-2 h-2 bg-blue-600 dark:bg-blue-500 rounded-full flex-shrink-0 mt-1 animate-pulse"></span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-750 border-t border-gray-200 dark:border-gray-700 rounded-b-lg">
                    <a
                        href="/notifications"
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline block text-center"
                    >
                        View all notifications
                    </a>
                </div>
            )}
        </div>
    );
};

export default NotificationDropdown;
