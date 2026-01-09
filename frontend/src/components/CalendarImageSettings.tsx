/**
 * @fileoverview Calendar Image Integration Settings Component
 * @module components/CalendarImageSettings
 * 
 * Comprehensive calendar image management in Settings:
 * - Upload images with drag-and-drop
 * - View image gallery
 * - Delete images
 * - Configure print settings
 * - Preview images
 * 
 * Usage:
 *   import CalendarImageSettings from './CalendarImageSettings';
 *   <CalendarImageSettings />
 */

import React, { useState, useEffect, useRef } from 'react';
import { auth } from '../config/firebase';
import { uploadCalendarImage, listCalendarImages, deleteCalendarImage } from '../utils/calendarImageApi';
import type { CalendarImage } from '../types/image';

interface ImageSettings {
    enabled: boolean;
    defaultPaperSize: 'A4' | 'A5' | 'Letter';
    defaultOrientation: 'portrait' | 'landscape';
    defaultDPI: 150 | 300;
    aiGenerationEnabled: boolean;
    maxImagesPerCalendar: number;
}

const CalendarImageSettings: React.FC = () => {
    const [settings, setSettings] = useState<ImageSettings>({
        enabled: true,
        defaultPaperSize: 'A4',
        defaultOrientation: 'portrait',
        defaultDPI: 150,
        aiGenerationEnabled: false,
        maxImagesPerCalendar: 10,
    });

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [images, setImages] = useState<CalendarImage[]>([]);
    const [uploading, setUploading] = useState(false);
    const [selectedImage, setSelectedImage] = useState<CalendarImage | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const [monthAssignments, setMonthAssignments] = useState<{ [month: number]: string }>({});
    const [imageDisplaySettings, setImageDisplaySettings] = useState({
        position: 'full', // 'top', 'bottom', 'center', 'full'
        opacity: 30, // 0-100
        scaling: 'cover', // 'cover', 'contain', 'auto'
        align: 'center', // 'center', 'left', 'right'
    });
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Load settings from localStorage
        const savedSettings = localStorage.getItem('calendarImageSettings');
        if (savedSettings) {
            setSettings(JSON.parse(savedSettings));
        }

        // Load month assignments
        const savedAssignments = localStorage.getItem('calendarMonthAssignments');
        if (savedAssignments) {
            setMonthAssignments(JSON.parse(savedAssignments));
        }

        // Load image display settings
        const savedDisplaySettings = localStorage.getItem('calendarImageDisplaySettings');
        if (savedDisplaySettings) {
            setImageDisplaySettings(JSON.parse(savedDisplaySettings));
        }

        // Load user images
        loadImages();
    }, []);

    const loadImages = async () => {
        if (!auth.currentUser) return;

        try {
            console.log('🔍 Loading images...');
            const userImages = await listCalendarImages();
            console.log('✅ Images loaded:', userImages.length, 'images found');
            console.log('📋 Image details:', userImages);
            setImages(userImages);
        } catch (error: any) {
            // Only log error if user is still authenticated (prevents errors during auth state changes)
            if (auth.currentUser) {
                console.error('❌ Error loading images:', error);
            }
        }
    };

    const debugImages = async () => {
        if (!auth.currentUser) {
            alert('❌ Not logged in!');
            return;
        }

        try {
            const token = await auth.currentUser.getIdToken();
            const response = await fetch('http://localhost:5000/api/calendar/test/debug-images', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            console.log('🔍 DEBUG RESPONSE:', data);
            alert(`Found ${data.totalImages} images in Firestore!\nCheck browser console (F12) for details.`);
        } catch (error: any) {
            console.error('❌ Debug error:', error);
            alert(`Debug failed: ${error.message}`);
        }
    };

    const exportToPDF = async () => {
        if (!auth.currentUser) {
            alert('Please log in to export calendar');
            return;
        }

        try {
            const token = await auth.currentUser.getIdToken();
            setLoading(true);

            // Get current month's image
            const currentMonth = new Date().getMonth();
            const assignedImageId = monthAssignments[currentMonth];
            const assignedImage = images.find(img => img.id === assignedImageId);

            const response = await fetch('http://localhost:5000/api/calendar/print/pdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    calendarView: 'month',
                    year: new Date().getFullYear(),
                    month: new Date().getMonth() + 1,
                    backgroundImageUrl: assignedImage?.url || null,
                    imageOpacity: imageDisplaySettings.opacity,
                    imagePosition: imageDisplaySettings.position,
                    imageScaling: imageDisplaySettings.scaling,
                    imageAlign: imageDisplaySettings.align,
                    settings: {
                        paperSize: settings.defaultPaperSize,
                        orientation: settings.defaultOrientation,
                        dpi: settings.defaultDPI,
                        includeEvents: true,
                        includeHolidays: true,
                        includeCaptions: false,
                        marginPreset: 'medium'
                    }
                })
            });

            if (!response.ok) {
                throw new Error('Failed to generate PDF');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `calendar-${new Date().toLocaleString('default', { month: 'long' })}-${new Date().getFullYear()}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            setMessage('✅ PDF exported successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (error: any) {
            console.error('❌ Export error:', error);
            setMessage(`❌ Failed to export PDF: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        setMessage('');

        try {
            localStorage.setItem('calendarImageSettings', JSON.stringify(settings));
            localStorage.setItem('calendarMonthAssignments', JSON.stringify(monthAssignments));
            localStorage.setItem('calendarImageDisplaySettings', JSON.stringify(imageDisplaySettings));
            setMessage('✅ All settings saved successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error('Error saving settings:', error);
            setMessage('❌ Failed to save settings.');
        } finally {
            setLoading(false);
        }
    };

    const handleMonthAssignment = (imageId: string, month: number | null) => {
        if (month === null) {
            // Remove assignment
            const newAssignments = { ...monthAssignments };
            delete newAssignments[month!];
            setMonthAssignments(newAssignments);
        } else {
            // Add/update assignment
            setMonthAssignments({ ...monthAssignments, [month]: imageId });
        }
    };

    const handleFileSelect = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        // Check authentication
        if (!auth.currentUser) {
            setMessage('❌ Please log in to upload images');
            setTimeout(() => setMessage(''), 3000);
            return;
        }

        const file = files[0];

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setMessage('❌ Please select an image file');
            return;
        }

        // Validate file size (10MB)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            setMessage('❌ File size must be less than 10MB');
            return;
        }

        setUploading(true);
        setMessage('⏳ Uploading image...');

        try {
            const result = await uploadCalendarImage(file);
            setMessage(`✅ Image uploaded successfully!`);
            await loadImages(); // Reload images
            setTimeout(() => setMessage(''), 3000);
        } catch (error: any) {
            console.error('Upload error:', error);
            setMessage(`❌ Upload failed: ${error.message}`);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (imageId: string) => {
        if (!confirm('Are you sure you want to delete this image?')) return;

        try {
            await deleteCalendarImage(imageId);
            setMessage('✅ Image deleted successfully');
            await loadImages();
            if (selectedImage?.id === imageId) {
                setSelectedImage(null);
            }
            setTimeout(() => setMessage(''), 3000);
        } catch (error: any) {
            console.error('Delete error:', error);
            setMessage(`❌ Delete failed: ${error.message}`);
        }
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelect(e.dataTransfer.files);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg transition-colors duration-300">
            <h2 className="text-2xl font-bold mb-6 dark:text-white flex items-center">
                <span className="text-3xl mr-3">📷</span>
                Calendar Image Management
            </h2>

            <p className="text-gray-600 dark:text-gray-300 mb-6">
                Upload and manage images for your calendar. Add custom backgrounds, photos, and AI-generated artwork.
            </p>

            {!auth.currentUser && (
                <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-yellow-800 dark:text-yellow-200 font-medium flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Please log in to upload and manage images
                    </p>
                </div>
            )}

            {message && (
                <div
                    className={`p-3 rounded mb-4 ${message.includes('✅')
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-100'
                        : message.includes('⏳')
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100'
                            : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-100'
                        }`}
                >
                    {message}
                </div>
            )}

            {/* Upload Section */}
            <div className="mb-8">
                <h3 className="text-lg font-semibold mb-3 dark:text-white">📤 Upload Images</h3>

                <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${dragActive
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
                        } ${uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => !uploading && fileInputRef.current?.click()}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileSelect(e.target.files)}
                        disabled={uploading}
                    />

                    <div className="text-5xl mb-3">🖼️</div>
                    <p className="text-gray-700 dark:text-gray-300 font-medium mb-2">
                        {uploading ? 'Uploading...' : 'Drop images here or click to browse'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Supports: JPG, PNG, WebP, GIF (Max 10MB)
                    </p>
                </div>

                <div className="mt-3 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>📊 Uploaded: {images.length} image{images.length !== 1 ? 's' : ''}</span>
                    <span>💾 Storage: {(images.reduce((acc, img) => acc + (img.meta?.sizeBytes || 0), 0) / 1024 / 1024).toFixed(2)} MB</span>
                </div>
            </div>

            {/* Image Gallery */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold dark:text-white">🖼️ Image Gallery ({images.length})</h3>
                    <div className="flex gap-2">
                        <button
                            onClick={debugImages}
                            className="px-3 py-1.5 bg-yellow-600 text-white text-sm rounded-md hover:bg-yellow-700 transition-colors flex items-center gap-2"
                            title="Check Firestore database"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Debug
                        </button>
                        <button
                            onClick={loadImages}
                            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Refresh
                        </button>
                    </div>
                </div>

                {images.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-600">
                        <div className="text-6xl mb-3">📁</div>
                        <p className="text-gray-500 dark:text-gray-400">No images uploaded yet</p>
                        <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Upload your first image above!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {images.map((image) => (
                            <div
                                key={image.id}
                                className={`relative group rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${selectedImage?.id === image.id
                                    ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
                                    : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500'
                                    }`}
                                onClick={() => setSelectedImage(image)}
                            >
                                <div className="aspect-square bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                                    <img
                                        src={image.url}
                                        alt={image.filename}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                    />
                                </div>

                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(image.id);
                                        }}
                                        className="bg-red-500 text-white p-2 rounded-full shadow-lg hover:bg-red-600 transition"
                                        title="Delete image"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>

                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-3">
                                    <p className="text-white text-xs truncate mb-2" title={image.filename}>
                                        {image.filename}
                                    </p>
                                    <div className="flex items-center justify-between text-[10px] text-white/80 mb-2">
                                        <span>{image.width && image.height && `${image.width}×${image.height}`}</span>
                                        <span>{image.meta?.sizeBytes && `${(image.meta.sizeBytes / 1024).toFixed(0)}KB`}</span>
                                    </div>

                                    {/* Month Selector */}
                                    <select
                                        value={Object.entries(monthAssignments).find(([_, id]) => id === image.id)?.[0] || ''}
                                        onChange={(e) => {
                                            e.stopPropagation();
                                            const month = e.target.value ? parseInt(e.target.value) : null;
                                            handleMonthAssignment(image.id, month);
                                        }}
                                        className="w-full text-xs bg-white/20 backdrop-blur-sm text-white border border-white/30 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <option value="" className="bg-gray-800">No month assigned</option>
                                        <option value="0" className="bg-gray-800">January</option>
                                        <option value="1" className="bg-gray-800">February</option>
                                        <option value="2" className="bg-gray-800">March</option>
                                        <option value="3" className="bg-gray-800">April</option>
                                        <option value="4" className="bg-gray-800">May</option>
                                        <option value="5" className="bg-gray-800">June</option>
                                        <option value="6" className="bg-gray-800">July</option>
                                        <option value="7" className="bg-gray-800">August</option>
                                        <option value="8" className="bg-gray-800">September</option>
                                        <option value="9" className="bg-gray-800">October</option>
                                        <option value="10" className="bg-gray-800">November</option>
                                        <option value="11" className="bg-gray-800">December</option>
                                    </select>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Image Preview */}
            {selectedImage && (
                <div className="mb-8 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-6 rounded-xl border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start justify-between mb-4">
                        <h3 className="text-lg font-semibold dark:text-white flex items-center">
                            <span className="text-2xl mr-2">🔍</span>
                            Selected Image Preview
                        </h3>
                        <button
                            onClick={() => setSelectedImage(null)}
                            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-inner">
                            <img
                                src={selectedImage.url}
                                alt={selectedImage.filename}
                                className="w-full h-auto rounded-lg shadow-lg"
                            />
                        </div>

                        <div className="space-y-3">
                            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg">
                                <p className="text-sm text-gray-500 dark:text-gray-400">Filename</p>
                                <p className="font-medium dark:text-white">{selectedImage.filename}</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg">
                                <p className="text-sm text-gray-500 dark:text-gray-400">Dimensions</p>
                                <p className="font-medium dark:text-white">
                                    {selectedImage.width && selectedImage.height
                                        ? `${selectedImage.width} × ${selectedImage.height} px`
                                        : 'N/A'}
                                </p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg">
                                <p className="text-sm text-gray-500 dark:text-gray-400">File Size</p>
                                <p className="font-medium dark:text-white">
                                    {selectedImage.meta?.sizeBytes
                                        ? `${(selectedImage.meta.sizeBytes / 1024).toFixed(1)} KB`
                                        : 'N/A'}
                                </p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg">
                                <p className="text-sm text-gray-500 dark:text-gray-400">Format</p>
                                <p className="font-medium dark:text-white uppercase">
                                    {selectedImage.meta?.format || 'Unknown'}
                                </p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg">
                                <p className="text-sm text-gray-500 dark:text-gray-400">Uploaded</p>
                                <p className="font-medium dark:text-white">
                                    {selectedImage.createdAt
                                        ? new Date((selectedImage.createdAt as any).seconds * 1000).toLocaleDateString()
                                        : 'N/A'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Month Assignment Summary */}
            {Object.keys(monthAssignments).length > 0 && (
                <div className="mb-8 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-6 rounded-xl border border-green-200 dark:border-green-800">
                    <h3 className="text-lg font-semibold mb-4 dark:text-white flex items-center">
                        <span className="text-2xl mr-2">📅</span>
                        Month Assignments ({Object.keys(monthAssignments).length}/12)
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((monthName, idx) => {
                            const assignedImageId = monthAssignments[idx];
                            const assignedImage = images.find(img => img.id === assignedImageId);

                            return (
                                <div
                                    key={idx}
                                    className={`p-3 rounded-lg border ${assignedImage
                                        ? 'bg-white dark:bg-gray-800 border-green-300 dark:border-green-700'
                                        : 'bg-gray-100 dark:bg-gray-700/30 border-gray-300 dark:border-gray-600'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium text-sm dark:text-white">{monthName}</span>
                                        {assignedImage && (
                                            <span className="text-xs text-green-600 dark:text-green-400">✓</span>
                                        )}
                                    </div>
                                    {assignedImage ? (
                                        <div className="flex items-center gap-2">
                                            <img
                                                src={assignedImage.url}
                                                alt={assignedImage.filename}
                                                className="w-10 h-10 rounded object-cover"
                                            />
                                            <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                                {assignedImage.filename}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-gray-500 dark:text-gray-400">No image</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Image Display Settings */}
            <div className="mb-8 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-6 rounded-xl border border-purple-200 dark:border-purple-800">
                <h3 className="text-lg font-semibold mb-4 dark:text-white flex items-center">
                    <span className="text-2xl mr-2">🎨</span>
                    Image Display Settings
                </h3>

                {/* Position Control */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            📍 Vertical Position
                        </label>
                        <select
                            value={imageDisplaySettings.position}
                            onChange={(e) => setImageDisplaySettings({ ...imageDisplaySettings, position: e.target.value as any })}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                            <option value="full">Full Background</option>
                            <option value="top">Top Banner</option>
                            <option value="bottom">Bottom Banner</option>
                            <option value="center">Center Strip</option>
                            <option value="grid">Inside Calendar Grid</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            ↔️ Horizontal Alignment
                        </label>
                        <select
                            value={imageDisplaySettings.align || 'center'}
                            onChange={(e) => setImageDisplaySettings({ ...imageDisplaySettings, align: e.target.value as any })}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                            <option value="center">Center</option>
                            <option value="left">Left</option>
                            <option value="right">Right</option>
                        </select>
                    </div>
                </div>

                {/* Scaling and Opacity */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            🔍 Sizing Mode
                        </label>
                        <select
                            value={imageDisplaySettings.scaling || 'cover'}
                            onChange={(e) => setImageDisplaySettings({ ...imageDisplaySettings, scaling: e.target.value as any })}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                            <option value="cover">Fill Area (Cover)</option>
                            <option value="contain">Show Entire Image (Fit)</option>
                            <option value="auto">Original Size</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            💧 Transparency: {imageDisplaySettings.opacity}%
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={imageDisplaySettings.opacity}
                            onChange={(e) => setImageDisplaySettings({ ...imageDisplaySettings, opacity: parseInt(e.target.value) })}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                        />
                    </div>
                </div>

                {/* Preview */}
                {monthAssignments[new Date().getMonth()] && images.find(img => img.id === monthAssignments[new Date().getMonth()]) && (
                    <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            👁️ Print Preview - {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })} (A4 Portrait)
                        </label>
                        <div className="flex justify-center">
                            <div className="relative bg-white dark:bg-gray-800 rounded-lg overflow-hidden border-2 border-purple-300 dark:border-purple-600 shadow-xl"
                                style={{ width: '380px', height: '537px' }}> {/* A4 Aspect Ratio */}

                                {/* Background Image Layer - Same logic as backend */}
                                {imageDisplaySettings.position !== 'grid' && (
                                    <div
                                        className="absolute"
                                        style={{
                                            backgroundImage: `url(${images.find(img => img.id === monthAssignments[new Date().getMonth()])?.url})`,
                                            backgroundSize: imageDisplaySettings.scaling || 'cover',
                                            backgroundPosition: imageDisplaySettings.align || 'center',
                                            opacity: imageDisplaySettings.opacity / 100,
                                            left: 0,
                                            right: 0,
                                            ...(imageDisplaySettings.position === 'full' ? {
                                                top: 0,
                                                bottom: 0,
                                            } : imageDisplaySettings.position === 'top' ? {
                                                top: 0,
                                                height: '35%',
                                            } : imageDisplaySettings.position === 'bottom' ? {
                                                bottom: 0,
                                                height: '35%',
                                            } : { // center
                                                top: '30%',
                                                height: '40%',
                                            }),
                                            zIndex: 5,
                                            border: '1px dashed rgba(167, 139, 250, 0.4)',
                                        }}
                                    />
                                )}

                                {/* Margin Visualization */}
                                <div className="absolute inset-0 z-[6] pointer-events-none border-[15px] border-red-500/10" title="Safety Margins (approx. 20mm)" />

                                {/* Calendar Content Overlay - Matches PDF layout */}
                                <div className="relative z-10 p-10 flex flex-col h-full bg-white/40 dark:bg-gray-900/40 backdrop-blur-[1px]">
                                    {/* Month Header */}
                                    <div className="text-center mb-6">
                                        <h4 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">
                                            {new Date().getFullYear()} - {new Date().toLocaleString('default', { month: 'long' })}
                                        </h4>
                                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Month View</div>
                                    </div>

                                    {/* Accurate Calendar Grid */}
                                    <div className="relative grid grid-cols-7 gap-[1px] bg-gray-300/50 border border-gray-300 overflow-hidden">
                                        {imageDisplaySettings.position === 'grid' && (
                                            <div
                                                className="absolute inset-0 z-0"
                                                style={{
                                                    backgroundImage: `url(${images.find(img => img.id === monthAssignments[new Date().getMonth()])?.url})`,
                                                    backgroundSize: imageDisplaySettings.scaling || 'cover',
                                                    backgroundPosition: imageDisplaySettings.align || 'center',
                                                    opacity: imageDisplaySettings.opacity / 100,
                                                }}
                                            />
                                        )}
                                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                                            <div key={i} className="relative z-10 text-[8px] font-bold text-white bg-gray-700 py-2">
                                                {day}
                                            </div>
                                        ))}
                                        {Array.from({ length: 35 }, (_, i) => {
                                            const dayNum = i - 2;
                                            const isInner = dayNum > 0 && dayNum <= 31;
                                            return (
                                                <div
                                                    key={i}
                                                    className={`relative z-10 h-12 flex flex-col items-start p-1 text-[10px] ${isInner
                                                        ? imageDisplaySettings.position === 'grid'
                                                            ? 'bg-transparent text-gray-900 dark:text-white border-r border-b border-gray-300/20'
                                                            : 'bg-white/80 dark:bg-gray-800/80 text-gray-900 dark:text-white'
                                                        : 'bg-gray-100/50 dark:bg-gray-700/50 text-gray-300 dark:text-gray-600'
                                                        }`}
                                                >
                                                    <span className="font-bold">{isInner ? dayNum : ''}</span>
                                                    {isInner && dayNum === 17 && (
                                                        <div className="mt-auto w-full h-[2px] bg-blue-500 rounded-full" />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="mt-auto text-[8px] text-gray-400 text-center pb-2">
                                        Preview Settings: {imageDisplaySettings.position} | {imageDisplaySettings.opacity}% Opacity
                                    </div>
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center italic">
                            💡 This preview uses the same scaling and layering rules as the PDF export.
                            Adjust settings above to clear text or align images.
                        </p>
                    </div>
                )}
            </div>

            {/* Print Settings */}
            <div className="space-y-6 border-t border-gray-200 dark:border-gray-700 pt-6">
                <h3 className="text-lg font-semibold dark:text-white">⚙️ Print Settings</h3>

                {/* Default Paper Size */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Default Paper Size
                    </label>
                    <select
                        value={settings.defaultPaperSize}
                        onChange={(e) =>
                            setSettings({ ...settings, defaultPaperSize: e.target.value as any })
                        }
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    >
                        <option value="A4">A4 (210 × 297 mm)</option>
                        <option value="A5">A5 (148 × 210 mm)</option>
                        <option value="Letter">Letter (8.5 × 11 in)</option>
                    </select>
                </div>

                {/* Default Orientation */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Default Orientation
                    </label>
                    <div className="flex space-x-4">
                        <button
                            type="button"
                            onClick={() => setSettings({ ...settings, defaultOrientation: 'portrait' })}
                            className={`flex-1 py-2 px-4 rounded-md border ${settings.defaultOrientation === 'portrait'
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                                }`}
                        >
                            📄 Portrait
                        </button>
                        <button
                            type="button"
                            onClick={() => setSettings({ ...settings, defaultOrientation: 'landscape' })}
                            className={`flex-1 py-2 px-4 rounded-md border ${settings.defaultOrientation === 'landscape'
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                                }`}
                        >
                            📃 Landscape
                        </button>
                    </div>
                </div>

                {/* Default DPI */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Print Quality (DPI)
                    </label>
                    <div className="flex space-x-4">
                        <button
                            type="button"
                            onClick={() => setSettings({ ...settings, defaultDPI: 150 })}
                            className={`flex-1 py-2 px-4 rounded-md border ${settings.defaultDPI === 150
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                                }`}
                        >
                            150 DPI (Draft)
                        </button>
                        <button
                            type="button"
                            onClick={() => setSettings({ ...settings, defaultDPI: 300 })}
                            className={`flex-1 py-2 px-4 rounded-md border ${settings.defaultDPI === 300
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                                }`}
                        >
                            300 DPI (High Quality)
                        </button>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-4 flex gap-3">
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors font-medium"
                    >
                        {loading ? 'Saving...' : '💾 Save All Settings'}
                    </button>
                    <button
                        onClick={exportToPDF}
                        disabled={loading}
                        className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 transition-colors font-medium"
                    >
                        {loading ? 'Generating...' : '🖨️ Export PDF'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CalendarImageSettings;
