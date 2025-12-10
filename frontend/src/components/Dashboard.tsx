import React, { useState, useEffect } from 'react';
import Calendar from './Calendar';
import ManageEvents from './ManageEvents';
import EventModal from './EventModal';
import { logger } from '../utils/logger';
import type { CalendarEvent } from '../types/event';

const Dashboard: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [view, setView] = useState<'calendar' | 'manage'>('calendar');

    useEffect(() => {
        logger.componentMount('Dashboard');

        const token = localStorage.getItem('token');
        const isAuth = !!token;
        setIsAuthenticated(isAuth);

        if (isAuth) {
            logger.success('User is authenticated in Dashboard');
        } else {
            logger.warn('User is not authenticated in Dashboard');
        }

        const handleStorageChange = () => {
            const newAuthState = !!localStorage.getItem('token');
            logger.info('Authentication state changed to', { authenticated: newAuthState });
            setIsAuthenticated(newAuthState);
        };

        window.addEventListener('storage', handleStorageChange);

        return () => {
            logger.componentUnmount('Dashboard');
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    const handleEditEvent = (event: CalendarEvent) => {
        logger.userAction('Edit event clicked', { eventId: event._id, title: event.title });
        setSelectedEvent(event);
        setIsModalOpen(true);
    };

    const handleAddEvent = () => {
        logger.userAction('Add event button clicked');
        setSelectedEvent(null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        logger.debug('Event modal closed');
        setIsModalOpen(false);
        setSelectedEvent(null);
    };

    if (!isAuthenticated) {
        return (
            <div className="text-center mt-20">
                <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-200">Please Log In</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-2">You need to be logged in to view and manage your calendar.</p>
                <a href="/login" className="inline-block mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                    Go to Login
                </a>
            </div>
        );
    }

    return (
        <>
            <div className="max-w-7xl mx-auto px-6 mb-4">
                <div className="flex justify-between items-center">
                    {/* View Tabs */}
                    <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                        <button
                            onClick={() => setView('calendar')}
                            className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${view === 'calendar'
                                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-300 shadow-sm'
                                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            📅 Calendar View
                        </button>
                        <button
                            onClick={() => setView('manage')}
                            className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${view === 'manage'
                                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-300 shadow-sm'
                                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            📋 Manage Events
                        </button>
                    </div>

                    {/* Add Event Button */}
                    <button
                        onClick={handleAddEvent}
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-lg shadow-blue-200 transition transform hover:-translate-y-0.5"
                    >
                        + Add Event
                    </button>
                </div>
            </div>

            {/* Conditional View Rendering */}
            {view === 'calendar' ? (
                <Calendar onEditEvent={handleEditEvent} />
            ) : (
                <ManageEvents onEditEvent={handleEditEvent} />
            )}

            {/* Event Modal */}
            <EventModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onEventAdded={() => { }} // No need to refresh manually with realtime sync
                event={selectedEvent}
            />
        </>
    );
};

export default Dashboard;
