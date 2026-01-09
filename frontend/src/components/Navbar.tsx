import React, { useEffect, useState } from 'react';
import { auth } from '../config/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import NotificationBell from './NotificationBell';
import NotificationDropdown from './NotificationDropdown';

const Navbar: React.FC = () => {
    const [user, setUser] = useState<any>(null);
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [isNotificationDropdownOpen, setIsNotificationDropdownOpen] = useState(false);

    useEffect(() => {
        // Auth listener
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                currentUser.getIdToken().then((token) => {
                    localStorage.setItem('token', token);
                });
                // Fetch user settings to sync theme
                fetch('http://localhost:5000/api/settings', {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                })
                    .then(res => res.json())
                    .then(data => {
                        if (data.theme) {
                            setTheme(data.theme);
                            if (data.theme === 'dark') document.documentElement.classList.add('dark');
                            else document.documentElement.classList.remove('dark');
                            localStorage.setItem('theme', data.theme);
                        }
                    })
                    .catch(err => console.error("Error loading settings", err));
            } else {
                localStorage.removeItem('token');
            }
        });

        // Initial theme check from local storage
        const storedTheme = localStorage.getItem('theme');
        if (storedTheme) {
            setTheme(storedTheme as 'light' | 'dark');
            if (storedTheme === 'dark') document.documentElement.classList.add('dark');
        } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            setTheme('dark');
            document.documentElement.classList.add('dark');
        }

        return () => unsubscribe();
    }, []);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            window.location.href = '/login';
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    const toggleTheme = async () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);

        if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        // Sync with backend if logged in
        if (user) {
            try {
                const token = await user.getIdToken();
                await fetch('http://localhost:5000/api/settings', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ theme: newTheme }),
                });
            } catch (error) {
                console.error('Failed to sync theme', error);
            }
        }
    };

    return (
        <nav className="navbar-glass">
            <div className="navbar-container">
                {/* Logo */}
                <a href="/" className="navbar-logo">
                    <div className="logo-icon">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M16 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M8 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M3 10H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <span className="logo-text">Calendar App</span>
                </a>

                {/* Navigation Links */}
                <div className="nav-links">
                    {/* Theme Toggle */}
                    <button
                        onClick={toggleTheme}
                        className="theme-toggle"
                        title="Toggle Theme"
                        aria-label="Toggle Theme"
                    >
                        {theme === 'light' ? (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                        )}
                    </button>

                    {/* Notification Bell (only for authenticated users) */}
                    {user && (
                        <div className="relative">
                            <NotificationBell
                                onOpenDropdown={() => setIsNotificationDropdownOpen(!isNotificationDropdownOpen)}
                            />
                            <NotificationDropdown
                                isOpen={isNotificationDropdownOpen}
                                onClose={() => setIsNotificationDropdownOpen(false)}
                            />
                        </div>
                    )}

                    <a href="/" className="nav-link">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M9 22V12H15V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>Home</span>
                    </a>

                    {user ? (
                        <>
                            <a href="/settings" className="nav-link">
                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0406 19.206C15.7162 19.1472 15.3816 19.1869 15.08 19.32C14.7842 19.4468 14.532 19.6572 14.3543 19.9255C14.1766 20.1938 14.0813 20.5082 14.08 20.83V21C14.08 21.5304 13.8693 22.0391 13.4942 22.4142C13.1191 22.7893 12.6104 23 12.08 23C11.5496 23 11.0409 22.7893 10.6658 22.4142C10.2907 22.0391 10.08 21.5304 10.08 21V20.91C10.0723 20.579 9.96512 20.258 9.77251 19.9887C9.5799 19.7194 9.31074 19.5143 9 19.4C8.69838 19.2669 8.36381 19.2272 8.03941 19.286C7.71502 19.3448 7.41568 19.4995 7.18 19.73L7.12 19.79C6.93425 19.976 6.71368 20.1235 6.47088 20.2241C6.22808 20.3248 5.96783 20.3766 5.705 20.3766C5.44217 20.3766 5.18192 20.3248 4.93912 20.2241C4.69632 20.1235 4.47575 19.976 4.29 19.79C4.10405 19.6043 3.95653 19.3837 3.85588 19.1409C3.75523 18.8981 3.70343 18.6378 3.70343 18.375C3.70343 18.1122 3.75523 17.8519 3.85588 17.6091C3.95653 17.3663 4.10405 17.1457 4.29 16.96L4.35 16.9C4.58054 16.6643 4.73519 16.365 4.794 16.0406C4.85282 15.7162 4.81312 15.3816 4.68 15.08C4.55324 14.7842 4.34276 14.532 4.07447 14.3543C3.80618 14.1766 3.49179 14.0813 3.17 14.08H3C2.46957 14.08 1.96086 13.8693 1.58579 13.4942C1.21071 13.1191 1 12.6104 1 12.08C1 11.5496 1.21071 11.0409 1.58579 10.6658C1.96086 10.2907 2.46957 10.08 3 10.08H3.09C3.42099 10.0723 3.742 9.96512 4.0113 9.77251C4.28059 9.5799 4.48572 9.31074 4.6 9C4.73312 8.69838 4.77282 8.36381 4.714 8.03941C4.65519 7.71502 4.50054 7.41568 4.27 7.18L4.21 7.12C4.02405 6.93425 3.87653 6.71368 3.77588 6.47088C3.67523 6.22808 3.62343 5.96783 3.62343 5.705C3.62343 5.44217 3.67523 5.18192 3.77588 4.93912C3.87653 4.69632 4.02405 4.47575 4.21 4.29C4.39575 4.10405 4.61632 3.95653 4.85912 3.85588C5.10192 3.75523 5.36217 3.70343 5.625 3.70343C5.88783 3.70343 6.14808 3.75523 6.39088 3.85588C6.63368 3.95653 6.85425 4.10405 7.04 4.29L7.1 4.35C7.33568 4.58054 7.63502 4.73519 7.95941 4.794C8.28381 4.85282 8.61838 4.81312 8.92 4.68H9C9.29577 4.55324 9.54802 4.34276 9.72569 4.07447C9.90337 3.80618 9.99872 3.49179 10 3.17V3C10 2.46957 10.2107 1.96086 10.5858 1.58579C10.9609 1.21071 11.4696 1 12 1C12.5304 1 13.0391 1.21071 13.4142 1.58579C13.7893 1.96086 14 2.46957 14 3V3.09C14.0013 3.41179 14.0966 3.72618 14.2743 3.99447C14.452 4.26276 14.7042 4.47324 15 4.6C15.3016 4.73312 15.6362 4.77282 15.9606 4.714C16.285 4.65519 16.5843 4.50054 16.82 4.27L16.88 4.21C17.0657 4.02405 17.2863 3.87653 17.5291 3.77588C17.7719 3.67523 18.0322 3.62343 18.295 3.62343C18.5578 3.62343 18.8181 3.67523 19.0609 3.77588C19.3037 3.87653 19.5243 4.02405 19.71 4.21C19.896 4.39575 20.0435 4.61632 20.1441 4.85912C20.2448 5.10192 20.2966 5.36217 20.2966 5.625C20.2966 5.88783 20.2448 6.14808 20.1441 6.39088C20.0435 6.63368 19.896 6.85425 19.71 7.04L19.65 7.1C19.4195 7.33568 19.2648 7.63502 19.206 7.95941C19.1472 8.28381 19.1869 8.61838 19.32 8.92V9C19.4468 9.29577 19.6572 9.54802 19.9255 9.72569C20.1938 9.90337 20.5082 9.99872 20.83 10H21C21.5304 10 22.0391 10.2107 22.4142 10.5858C22.7893 10.9609 23 11.4696 23 12C23 12.5304 22.7893 13.0391 22.4142 13.4142C22.0391 13.7893 21.5304 14 21 14H20.91C20.5882 14.0013 20.2738 14.0966 20.0055 14.2743C19.7372 14.452 19.5268 14.7042 19.4 15V15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <span>Settings</span>
                            </a>
                            <button onClick={handleLogout} className="nav-button logout-button">
                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <span>Logout</span>
                            </button>
                        </>
                    ) : (
                        <>
                            <a href="/login" className="nav-button login-button">
                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M15 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M10 17L15 12L10 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M15 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <span>Login</span>
                            </a>
                            <a href="/signup" className="nav-button signup-button">
                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M16 21V19C16 17.9391 15.5786 16.9217 14.8284 16.1716C14.0783 15.4214 13.0609 15 12 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M8.5 11C10.7091 11 12.5 9.20914 12.5 7C12.5 4.79086 10.7091 3 8.5 3C6.29086 3 4.5 4.79086 4.5 7C4.5 9.20914 6.29086 11 8.5 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M20 8V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M23 11H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <span>Sign Up</span>
                            </a>
                        </>
                    )}
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700&display=swap');

                .navbar-glass {
                    position: relative;
                    z-index: 50;
                    background: rgba(255, 255, 255, 0.8);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
                    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.05);
                    transition: all 0.3s ease;
                }

                .dark .navbar-glass {
                    background: rgba(17, 24, 39, 0.8);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.3);
                }

                .navbar-container {
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 1rem 2rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .navbar-logo {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    text-decoration: none;
                    transition: transform 0.3s ease;
                }

                .navbar-logo:hover {
                    transform: scale(1.05);
                }

                .logo-icon {
                    width: 40px;
                    height: 40px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
                    transition: all 0.3s ease;
                }

                .navbar-logo:hover .logo-icon {
                    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
                    transform: rotate(-5deg);
                }

                .logo-icon svg {
                    width: 24px;
                    height: 24px;
                }

                .logo-text {
                    font-family: 'Inter', sans-serif;
                    font-size: 1.5rem;
                    font-weight: 700;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }

                .nav-links {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .theme-toggle {
                    width: 40px;
                    height: 40px;
                    border-radius: 10px;
                    background: rgba(102, 126, 234, 0.1);
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #667eea;
                    transition: all 0.3s ease;
                }

                .dark .theme-toggle {
                    background: rgba(129, 140, 248, 0.1);
                    color: #818cf8;
                }

                .theme-toggle:hover {
                    background: rgba(102, 126, 234, 0.2);
                    transform: rotate(20deg) scale(1.1);
                }

                .dark .theme-toggle:hover {
                    background: rgba(129, 140, 248, 0.2);
                }

                .theme-toggle svg {
                    width: 20px;
                    height: 20px;
                }

                .nav-link {
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    padding: 0.5rem 0.875rem;
                    border-radius: 10px;
                    text-decoration: none;
                    font-family: 'Inter', sans-serif;
                    font-size: 0.875rem;
                    font-weight: 600;
                    background: rgba(102, 126, 234, 0.1);
                    color: #667eea;
                    transition: all 0.3s ease;
                    position: relative;
                }

                .dark .nav-link {
                    background: rgba(129, 140, 248, 0.1);
                    color: #a5b4fc;
                }

                .nav-link:hover {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.25);
                }

                .dark .nav-link:hover {
                    background: linear-gradient(135deg, #818cf8 0%, #8b5cf6 100%);
                    box-shadow: 0 4px 15px rgba(129, 140, 248, 0.3);
                }

                .nav-link svg {
                    width: 16px;
                    height: 16px;
                    flex-shrink: 0;
                    transition: transform 0.3s ease;
                }

                .nav-link:hover svg {
                    transform: scale(1.1);
                }

                .nav-link span {
                    font-size: 0.875rem;
                }

                .nav-button {
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    padding: 0.5rem 0.875rem;
                    border-radius: 10px;
                    text-decoration: none;
                    font-family: 'Inter', sans-serif;
                    font-size: 0.875rem;
                    font-weight: 600;
                    border: none;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    position: relative;
                }

                .nav-button svg {
                    width: 16px;
                    height: 16px;
                    flex-shrink: 0;
                    transition: transform 0.3s ease;
                }

                .nav-button span {
                    font-size: 0.875rem;
                }

                .nav-button:hover svg {
                    transform: scale(1.1);
                }

                .login-button {
                    background: rgba(102, 126, 234, 0.1);
                    color: #667eea;
                }

                .dark .login-button {
                    background: rgba(129, 140, 248, 0.1);
                    color: #a5b4fc;
                }

                .login-button:hover {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.25);
                }

                .dark .login-button:hover {
                    background: linear-gradient(135deg, #818cf8 0%, #8b5cf6 100%);
                    box-shadow: 0 4px 15px rgba(129, 140, 248, 0.3);
                }

                .signup-button {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
                }

                .signup-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
                }

                .dark .signup-button {
                    background: linear-gradient(135deg, #818cf8 0%, #8b5cf6 100%);
                }

                .logout-button {
                    background: rgba(239, 68, 68, 0.1);
                    color: #ef4444;
                }

                .dark .logout-button {
                    background: rgba(248, 113, 113, 0.1);
                    color: #f87171;
                }

                .logout-button:hover {
                    background: rgba(239, 68, 68, 0.2);
                    transform: translateY(-2px);
                    box-shadow: 0 4px 15px rgba(239, 68, 68, 0.2);
                }

                @media (max-width: 768px) {
                    .navbar-container {
                        padding: 1rem;
                    }

                    .logo-text {
                        display: none;
                    }

                    .nav-links {
                        gap: 0.25rem;
                    }

                    .nav-link span,
                    .nav-button span {
                        display: none;
                    }

                    .nav-link,
                    .nav-button {
                        padding: 0.625rem;
                    }
                }
            `}} />
        </nav>
    );
};

export default Navbar;
