import React, { useState, useEffect } from 'react';
import { auth } from '../config/firebase';
import { logger } from '../utils/logger';

interface Event {
    _id: string;
    title: string;
    startDate: string;
    endDate: string;
    description?: string;
    recurrence: string;
    color?: string;
}

interface EventModalProps {
    isOpen: boolean;
    onClose: () => void;
    onEventAdded: () => void;
    event?: Event | null;
}

const EventModal: React.FC<EventModalProps> = ({ isOpen, onClose, onEventAdded, event }) => {
    const [title, setTitle] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [description, setDescription] = useState('');
    const [recurrence, setRecurrence] = useState('none');
    const [color, setColor] = useState('blue');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Helper to convert ISO date to datetime-local format (YYYY-MM-DDTHH:mm)
        const formatDateForInput = (isoString: string) => {
            if (!isoString) return '';
            const date = new Date(isoString);
            // Format as YYYY-MM-DDTHH:mm for datetime-local input
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        };

        if (event) {
            logger.debug('EventModal opened for editing', { eventId: event._id, title: event.title });
            setTitle(event.title);
            setStartDate(formatDateForInput(event.startDate));
            setEndDate(formatDateForInput(event.endDate));
            setDescription(event.description || '');
            setRecurrence(event.recurrence || 'none');
            setColor(event.color || 'blue');
        } else if (isOpen) {
            logger.debug('EventModal opened for creating new event');
            // Reset form for new event
            setTitle('');
            setStartDate('');
            setEndDate('');
            setDescription('');
            setRecurrence('none');
            setColor('blue');
        }
    }, [event, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const operation = event ? 'update' : 'create';
        logger.userAction(`Event form submitted (${operation})`, { title, startDate, endDate });

        // Get fresh token
        const user = auth.currentUser;
        if (!user) {
            logger.error('No authenticated user found');
            alert('You must be logged in');
            setLoading(false);
            return;
        }

        logger.debug('Getting fresh auth token...');
        const token = await user.getIdToken();

        // Fix timezone issue: ensure dates are in ISO format with local timezone
        const formatDateForBackend = (dateString: string) => {
            if (!dateString) return dateString;
            // datetime-local gives us YYYY-MM-DDTHH:mm, treat it as local time
            const localDate = new Date(dateString);
            return localDate.toISOString(); // Convert to ISO format for backend
        };

        const eventData = {
            title,
            startDate: formatDateForBackend(startDate),
            endDate: formatDateForBackend(endDate),
            description,
            recurrence,
            color
        };
        const url = event ? `http://localhost:5000/api/events/${event._id}` : 'http://localhost:5000/api/events';
        const method = event ? 'PUT' : 'POST';

        logger.debug(`Sending ${method} request to ${url}`, eventData);
        const startTime = performance.now();

        try {
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(eventData),
            });

            const duration = Math.round(performance.now() - startTime);

            if (res.ok) {
                const responseData = await res.json();
                logger.success(`Event ${operation}d successfully in ${duration}ms`, responseData);
                onEventAdded();
                onClose();
            } else {
                const errorData = await res.json();
                logger.error(`Failed to ${operation} event (${res.status})`, errorData);
                alert(`Failed to save event: ${errorData.message || res.statusText}`);
            }
        } catch (error) {
            logger.error(`Error ${operation}ing event`, error);
            alert('Error saving event. Check console for details.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 transition-opacity">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-2xl w-full max-w-md transform transition-all scale-100">
                <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">{event ? 'Edit Event' : 'Add New Event'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                            required
                            placeholder="Event Title"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Start</label>
                            <input
                                type="datetime-local"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">End</label>
                            <input
                                type="datetime-local"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            rows={3}
                            placeholder="Add details..."
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Recurrence</label>
                            <select
                                value={recurrence}
                                onChange={(e) => setRecurrence(e.target.value)}
                                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="none">None</option>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Color</label>
                            <div className="flex items-center space-x-2 mt-2">
                                {['blue', 'red', 'green', 'purple', 'orange'].map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setColor(c)}
                                        className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${color === c ? 'ring-2 ring-offset-2 ring-blue-400 dark:ring-blue-500 scale-110' : ''}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100 dark:border-gray-700 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition shadow-lg shadow-blue-200 dark:shadow-blue-900/30 disabled:opacity-70"
                        >
                            {loading ? 'Saving...' : 'Save Event'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EventModal;
