import React, { useState, useEffect } from 'react';
import { auth } from '../config/firebase';
import { logger } from '../utils/logger';

interface NotificationSettings {
    allowEmail: boolean;
    allowInApp: boolean;
    defaultReminderMinutes: number;
    timezone: string;
}

const NotificationSettingsComponent: React.FC = () => {
    const [settings, setSettings] = useState<NotificationSettings>({
        allowEmail: false,
        allowInApp: true,
        defaultReminderMinutes: 15,
        timezone: 'Asia/Kolkata',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const user = auth.currentUser;
            if (!user) return;

            const token = await user.getIdToken();
            const res = await fetch('http://localhost:5000/api/settings/notifications', {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                const data = await res.json();
                setSettings(data);
            }
        } catch (error) {
            logger.error('Error fetching notification settings', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setMessage('');

            const user = auth.currentUser;
            if (!user) {
                setMessage('You must be logged in');
                return;
            }

            const token = await user.getIdToken();
            const res = await fetch('http://localhost:5000/api/settings/notifications', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(settings),
            });

            if (res.ok) {
                setMessage('Settings saved successfully!');
                setTimeout(() => setMessage(''), 3000);
            } else {
                setMessage('Failed to save settings');
            }
        } catch (error) {
            logger.error('Error saving notification settings', error);
            setMessage('Error saving settings');
        } finally {
            setSaving(false);
        }
    };

    const reminderOptions = [
        { value: 5, label: '5 minutes before' },
        { value: 15, label: '15 minutes before' },
        { value: 30, label: '30 minutes before' },
        { value: 60, label: '1 hour before' },
        { value: 120, label: '2 hours before' },
        { value: 1440, label: '1 day before' },
    ];

    const timezones = [
        'Asia/Kolkata',
        'America/New_York',
        'America/Los_Angeles',
        'Europe/London',
        'Europe/Paris',
        'Asia/Tokyo',
        'Australia/Sydney',
        'Pacific/Auckland',
    ];

    if (loading) {
        return (
            <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 dark:border-gray-600 border-t-blue-600"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">Loading settings...</p>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
                    Notification Settings
                </h2>

                {message && (
                    <div
                        className={`p-4 rounded-lg mb-6 ${message.includes('success')
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
                            }`}
                    >
                        {message}
                    </div>
                )}

                <div className="space-y-6">
                    {/* Notification Channels */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Notification Channels
                        </h3>

                        <div className="space-y-4">
                            {/* In-App Notifications */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                <div className="flex-1">
                                    <div className="flex items-center space-x-2">
                                        <span className="text-2xl">📱</span>
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white">
                                                In-App Notifications
                                            </p>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                Receive notifications in the app
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.allowInApp}
                                        onChange={(e) =>
                                            setSettings({ ...settings, allowInApp: e.target.checked })
                                        }
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            {/* Email Notifications */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                <div className="flex-1">
                                    <div className="flex items-center space-x-2">
                                        <span className="text-2xl">📧</span>
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white">
                                                Email Notifications
                                            </p>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                Receive event reminders via email
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.allowEmail}
                                        onChange={(e) =>
                                            setSettings({ ...settings, allowEmail: e.target.checked })
                                        }
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Default Reminder Time */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Default Reminder Time
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            Choose when you want to be reminded before events by default
                        </p>
                        <select
                            value={settings.defaultReminderMinutes}
                            onChange={(e) =>
                                setSettings({ ...settings, defaultReminderMinutes: parseInt(e.target.value) })
                            }
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        >
                            {reminderOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Timezone */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Timezone
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            Select your timezone for accurate reminder scheduling
                        </p>
                        <select
                            value={settings.timezone}
                            onChange={(e) =>
                                setSettings({ ...settings, timezone: e.target.value })
                            }
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        >
                            {timezones.map((tz) => (
                                <option key={tz} value={tz}>
                                    {tz.replace(/_/g, ' ')}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Save Button */}
                    <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                        >
                            {saving ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotificationSettingsComponent;
