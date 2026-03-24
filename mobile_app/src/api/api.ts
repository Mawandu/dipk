import axios from 'axios';
import { Platform } from 'react-native';

// Using localhost with adb reverse tcp:8000 tcp:8000
// This allows the physical device to access the backend via USB
export const API_URL = 'http://localhost:8000';
const BASE_URL = API_URL;

export const predictTrash = async (imageFile: { uri: string; type: string; name: string }) => {
    const formData = new FormData();
    formData.append('file', {
        uri: imageFile.uri,
        type: imageFile.type,
        name: imageFile.name,
    });

    try {
        const response = await axios.post(`${BASE_URL}/predict_trash`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const submitReport = async (lat: number, lon: number, imageFile: { uri: string; type: string; name: string }) => {
    const formData = new FormData();
    formData.append('latitude', String(lat));
    formData.append('longitude', String(lon));
    formData.append('file', {
        uri: imageFile.uri,
        type: imageFile.type,
        name: imageFile.name,
    });

    try {
        const response = await axios.post(`${BASE_URL}/submit_report`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};
