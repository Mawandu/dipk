import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../api/api';

// Constants
// API_URL is now imported from ../api/api.ts for consistency
interface AuthContextType {
    user: any | null;
    token: string | null;
    isLoading: boolean;
    login: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    role: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider Component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<any | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Constants
    // For Physical Device via USB (requires 'adb reverse tcp:8000 tcp:8000')
    // Constants
    // API_URL imported from api.ts

    // Check if user is logged in on app start
    useEffect(() => {
        const loadStorageData = async () => {
            try {
                const storedToken = await AsyncStorage.getItem('token');
                const storedUser = await AsyncStorage.getItem('user');
                const storedRole = await AsyncStorage.getItem('role');

                if (storedToken && storedUser) {
                    setToken(storedToken);
                    setUser(JSON.parse(storedUser));
                    setRole(storedRole);
                    // Set axios default header
                    axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
                }
            } catch (e) {
                console.error("Failed to load auth data", e);
            } finally {
                setIsLoading(false);
            }
        };

        loadStorageData();
    }, []);

    const login = async (username: string, password: string) => {
        setIsLoading(true);
        try {
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);

            console.log("Logging in with", username);
            console.log("Using API_URL:", API_URL);

            const response = await axios.post(`${API_URL}/token`, formData.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            const { access_token, role, user_id, full_name } = response.data;
            // Note: Backend /token response might need adjustment to return role/user_id directly
            // Or we decode the token here using jwt-decode. 
            // For now, let's assume the backend returns this info or we fetch /users/me immediately.

            // Let's actually fetch the user details to be sure (if backend doesn't send it in /token)
            // Standard OAuth2 /token usually just returns access_token.
            // So we set the token, then fetch user.

            const userToken = access_token;
            axios.defaults.headers.common['Authorization'] = `Bearer ${userToken}`;

            // Fetch User Details
            // We need an endpoint for this => GET /users/me (Not implemented yet? We developed /admin/users)
            // Let's assume for this MVP we decoded it or the backend sends it. 
            // Let's IMPLEMENT a quick adjustment to Backend Token response to include role/id for simplicity.
            // Assuming Backend sends: { access_token, token_type, role, username }

            // Let's decode the token payload roughly (it's base64)
            const parts = userToken.split('.');
            const payload = JSON.parse(atob(parts[1]));

            const userInfo = { username: payload.sub, role: payload.role };

            setToken(userToken);
            setUser(userInfo);
            setRole(payload.role);

            await AsyncStorage.setItem('token', userToken);
            await AsyncStorage.setItem('user', JSON.stringify(userInfo));
            await AsyncStorage.setItem('role', payload.role);

        } catch (error) {
            console.error("Login failed", error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = async () => {
        setIsLoading(true);
        try {
            await AsyncStorage.removeItem('token');
            await AsyncStorage.removeItem('user');
            await AsyncStorage.removeItem('role');
            setToken(null);
            setUser(null);
            setRole(null);
            delete axios.defaults.headers.common['Authorization'];
        } catch (e) {
            console.error("Logout failed", e);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthContext.Provider value={{ user, token, role, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

// Custom Hook
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

// Polyfill for atob in React Native if needed
import { decode } from 'base-64';
if (!global.atob) {
    global.atob = decode;
}
