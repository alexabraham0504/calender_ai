import React, { useState, useEffect } from 'react';
import { auth } from '../config/firebase';
import CalendarImageSettings from './CalendarImageSettings';

interface SettingsData {
    defaultView: 'month' | 'week' | 'day';
    timeFormat: '12h' | '24h';
    defaultColor: string;
}

type SettingsTab = 'general' | 'calendar-images' | 'notifications';

const Settings: React.FC = () => {
    const [activeTab, setActiveTab] = useState<SettingsTab>('general');
    const [settings, setSettings] = useState<SettingsData>({
        defaultView: 'month',
        timeFormat: '12h',
        defaultColor: 'blue',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    const fetchSettings = async () => {
        const user = auth.currentUser;
        if (!user) {
            return;
        }
        const token = await user.getIdToken();

        try {
            const res = await fetch('http://localhost:5000/api/settings', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                // Only keep relevant fields, ignore theme
                const { theme, ...rest } = data;
                setSettings(prev => ({ ...prev, ...rest }));
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        } finally {
            setLoading(false);
        }
    };

    // Add auth listener to fetch settings once user is logged in
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                fetchSettings();
            } else {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        setSettings({ ...settings, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage('');

        const user = auth.currentUser;
        if (!user) {
            setMessage('You must be logged in.');
            setSaving(false);
            return;
        }
        const token = await user.getIdToken();

        try {
            const res = await fetch('http://localhost:5000/api/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(settings),
            });

            if (res.ok) {
                setMessage('Settings saved successfully!');
            } else {
                setMessage('Failed to save settings.');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            setMessage('Error saving settings.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading settings...</div>;

    return (
        <div className="max-w-4xl mx-auto mt-10">
            <h1 className="text-3xl font-bold mb-8 dark:text-white">Settings</h1>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'general'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                            }`}
                    >
                        General
                    </button>
                    <button
                        onClick={() => setActiveTab('calendar-images')}
                        className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'calendar-images'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                            }`}
                    >
                        📷 Calendar Images
                    </button>
                    <button
                        onClick={() => setActiveTab('notifications')}
                        className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'notifications'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                            }`}
                    >
                        Notifications
                    </button>
                </nav>
            </div>

            {/* Tab Content */}
            {activeTab === 'general' && (
                <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg transition-colors duration-300">
                    <h2 className="text-2xl font-bold mb-6 dark:text-white">General Settings</h2>

                    {message && (
                        <div className={`p-3 rounded mb-4 ${message.includes('success') ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-100' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-100'}`}>
                            {message}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Default Calendar View</label>
                            <select
                                name="defaultView"
                                value={settings.defaultView}
                                onChange={handleChange}
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                            >
                                <option value="month">Month</option>
                                <option value="week">Week</option>
                                <option value="day">Day</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Time Format</label>
                            <select
                                name="timeFormat"
                                value={settings.timeFormat}
                                onChange={handleChange}
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                            >
                                <option value="12h">12 Hour (AM/PM)</option>
                                <option value="24h">24 Hour</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Default Event Color</label>
                            <div className="flex space-x-2">
                                {['blue', 'red', 'green', 'purple', 'orange', 'gray'].map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        onClick={() => setSettings({ ...settings, defaultColor: color })}
                                        className={`w-8 h-8 rounded-full border-2 ${settings.defaultColor === color ? 'border-black dark:border-white' : 'border-transparent'}`}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
                            >
                                {saving ? 'Saving...' : 'Save Settings'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {activeTab === 'calendar-images' && <CalendarImageSettings />}

            {activeTab === 'notifications' && (
                <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg transition-colors duration-300">
                    <h2 className="text-2xl font-bold mb-6 dark:text-white">Notification Settings</h2>
                    <p className="text-gray-600 dark:text-gray-300">
                        Notification preferences can be managed in the Notifications Center.
                    </p>
                </div>
            )}
        </div>
    );
};

export default Settings;
