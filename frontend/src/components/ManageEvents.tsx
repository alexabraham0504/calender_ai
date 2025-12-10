import React, { useState, useEffect } from 'react';
import { db, auth } from '../config/firebase';
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { logger } from '../utils/logger';

interface Event {
    _id: string;
    title: string;
    startDate: string;
    endDate: string;
    description?: string;
    location?: string;
    priority?: 'low' | 'medium' | 'high';
    color?: string;
    createdBy?: string;
}

interface ManageEventsProps {
    onEditEvent: (event: Event) => void;
}

const ManageEvents: React.FC<ManageEventsProps> = ({ onEditEvent }) => {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        logger.componentMount('ManageEvents');

        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                logger.success(`User authenticated: ${user.uid}`);

                const q = query(
                    collection(db, 'events'),
                    where('userId', '==', user.uid)
                    // Removed orderBy to avoid index requirement - will sort in memory
                );

                const unsubscribeEvents = onSnapshot(q, (snapshot) => {
                    const eventsData = snapshot.docs.map(doc => ({
                        _id: doc.id,
                        ...doc.data()
                    })) as Event[];

                    logger.success(`Events loaded: ${eventsData.length}`);
                    setEvents(eventsData);
                    setLoading(false);
                }, (error) => {
                    logger.error('Error fetching events', error);
                    setLoading(false);
                });

                return () => unsubscribeEvents();
            } else {
                setEvents([]);
                setLoading(false);
            }
        });

        return () => unsubscribeAuth();
    }, []);

    const handleDelete = async (id: string, title: string) => {
        if (!confirm(`Are you sure you want to delete "${title}"?`)) {
            return;
        }

        try {
            logger.userAction('Deleting event', { eventId: id });
            await deleteDoc(doc(db, 'events', id));
            logger.success('Event deleted successfully');
        } catch (error) {
            logger.error('Error deleting event', error);
            alert('Failed to delete event. Please try again.');
        }
    };

    const getFilteredEvents = () => {
        const now = new Date();
        let filtered = events;

        // Filter by time
        if (filter === 'upcoming') {
            filtered = filtered.filter(e => new Date(e.startDate) >= now);
        } else if (filter === 'past') {
            filtered = filtered.filter(e => new Date(e.startDate) < now);
        }

        // Filter by search term
        if (searchTerm) {
            filtered = filtered.filter(e =>
                e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                e.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                e.location?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Sort by startDate (newest first) - done in memory since we removed orderBy
        filtered.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

        return filtered;
    };

    const filteredEvents = getFilteredEvents();

    const getPriorityColor = (priority?: string) => {
        switch (priority) {
            case 'high': return 'text-red-600 bg-red-50 dark:bg-red-900/20';
            case 'medium': return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20';
            case 'low': return 'text-green-600 bg-green-50 dark:bg-green-900/20';
            default: return 'text-gray-600 bg-gray-50 dark:bg-gray-700';
        }
    };

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto mt-10 p-6 bg-white dark:bg-gray-800 shadow-xl rounded-2xl">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                    <div className="space-y-3">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-20 bg-gray-100 dark:bg-gray-700 rounded"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 bg-white dark:bg-gray-800 shadow-xl rounded-2xl max-w-7xl mx-auto mt-6 border border-gray-100 dark:border-gray-700">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    Manage Events
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                    View, edit, and delete your scheduled events
                </p>
            </div>

            {/* Filters & Search */}
            <div className="mb-6 flex flex-col sm:flex-row gap-4">
                {/* Search */}
                <div className="flex-1">
                    <input
                        type="text"
                        placeholder="Search events..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                </div>

                {/* Filter Tabs */}
                <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${filter === 'all'
                            ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-300 shadow-sm'
                            : 'text-gray-600 dark:text-gray-300'
                            }`}
                    >
                        All ({events.length})
                    </button>
                    <button
                        onClick={() => setFilter('upcoming')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${filter === 'upcoming'
                            ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-300 shadow-sm'
                            : 'text-gray-600 dark:text-gray-300'
                            }`}
                    >
                        Upcoming
                    </button>
                    <button
                        onClick={() => setFilter('past')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${filter === 'past'
                            ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-300 shadow-sm'
                            : 'text-gray-600 dark:text-gray-300'
                            }`}
                    >
                        Past
                    </button>
                </div>
            </div>

            {/* Events List */}
            {filteredEvents.length === 0 ? (
                <div className="text-center py-12">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No events found</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {searchTerm ? 'Try a different search term' : 'Get started by creating a new event'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredEvents.map((event) => {
                        const isUpcoming = new Date(event.startDate) >= new Date();

                        return (
                            <div
                                key={event._id}
                                className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition-shadow bg-white dark:bg-gray-800"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                                {event.title}
                                            </h3>
                                            {event.priority && (
                                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${getPriorityColor(event.priority)}`}>
                                                    {event.priority}
                                                </span>
                                            )}
                                            {!isUpcoming && (
                                                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                                                    Past
                                                </span>
                                            )}
                                        </div>

                                        <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                                            <div className="flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                <span>
                                                    {new Date(event.startDate).toLocaleDateString('en-US', {
                                                        weekday: 'short',
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric'
                                                    })}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                <span>
                                                    {new Date(event.startDate).toLocaleTimeString('en-US', {
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })} - {new Date(event.endDate).toLocaleTimeString('en-US', {
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </span>
                                            </div>
                                            {event.location && (
                                                <div className="flex items-center gap-2">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    </svg>
                                                    <span>{event.location}</span>
                                                </div>
                                            )}
                                            {event.description && (
                                                <p className="mt-2 text-gray-500 dark:text-gray-400 line-clamp-2">
                                                    {event.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2 ml-4">
                                        <button
                                            onClick={() => onEditEvent(event)}
                                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                            title="Edit Event"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => handleDelete(event._id, event.title)}
                                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            title="Delete Event"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Summary */}
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Showing {filteredEvents.length} of {events.length} events
                </p>
            </div>
        </div>
    );
};

export default ManageEvents;
