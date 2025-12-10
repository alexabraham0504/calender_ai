import React, { useState, useEffect } from 'react';
import { auth } from '../config/firebase';
import { logger } from '../utils/logger';

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
    createdAt: any;
    eventId?: string;
    workspaceId?: string;
}

const NotificationBell: React.FC<{ onOpenDropdown: () => void }> = ({ onOpenDropdown }) => {
    const [unreadCount, setUnreadCount] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        fetchUnreadCount();

        // Poll for new notifications every 30 seconds
        const interval = setInterval(fetchUnreadCount, 30000);

        return () => clearInterval(interval);
    }, []);

    const fetchUnreadCount = async () => {
        try {
            const user = auth.currentUser;
            if (!user) return;

            const token = await user.getIdToken();
            const res = await fetch('http://localhost:5000/api/notifications/unread-count', {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                const data = await res.json();
                const newCount = data.count;

                // Trigger animation if count increased
                if (newCount > unreadCount) {
                    setIsAnimating(true);
                    setTimeout(() => setIsAnimating(false), 1000);
                }

                setUnreadCount(newCount);
            }
        } catch (error) {
            logger.error('Error fetching unread count', error);
        }
    };

    return (
        <button
            onClick={() => {
                onOpenDropdown();
                setIsAnimating(false);
            }}
            className={`relative p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all ${isAnimating ? 'animate-bounce' : ''
                }`}
            aria-label="Notifications"
        >
            {/* Bell Icon */}
            <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
            </svg>

            {/* Unread Badge */}
            {unreadCount > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                    {unreadCount > 99 ? '99+' : unreadCount}
                </span>
            )}

            {/* Pulse Effect for New Notifications */}
            {isAnimating && (
                <span className="absolute top-0 right-0 inline-flex h-3 w-3 translate-x-1/2 -translate-y-1/2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
            )}
        </button>
    );
};

export default NotificationBell;
