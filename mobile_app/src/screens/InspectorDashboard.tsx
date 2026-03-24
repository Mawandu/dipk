import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, Alert, Dimensions, Linking } from 'react-native';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../api/api';
import Geolocation from 'react-native-geolocation-service';
import { WebView } from 'react-native-webview';

const { height } = Dimensions.get('window');

interface Task {
    id: number;
    status: string;
    message: string;
    latitude: number;
    longitude: number;
    created_at: string;
}

const InspectorDashboard = () => {
    const { token, logout, user } = useAuth();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [userLoc, setUserLoc] = useState<{ latitude: number, longitude: number } | null>(null);
    const [mapLoaded, setMapLoaded] = useState(false);

    const webViewRef = useRef<WebView>(null);

    const fetchData = async () => {
        try {
            const response = await axios.get(`${API_URL}/inspector/my_tasks`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTasks(response.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        // Setup Geolocation matching AgentDashboard
        const watchId = Geolocation.watchPosition(
            (position) => {
                setUserLoc({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                });
            },
            (error) => {
                console.error(error);
                Alert.alert("Erreur GPS", "Impossible d'obtenir la position.");
            },
            { enableHighAccuracy: true, distanceFilter: 5, interval: 5000, fastestInterval: 2000 }
        );

        return () => Geolocation.clearWatch(watchId);
    }, []);

    useEffect(() => {
        if (!mapLoaded || !webViewRef.current) return;

        if (userLoc) {
            webViewRef.current.injectJavaScript(`
                if (window.userMarker) {
                    window.userMarker.setLatLng([${userLoc.latitude}, ${userLoc.longitude}]);
                } else {
                    window.userMarker = L.marker([${userLoc.latitude}, ${userLoc.longitude}], {
                        icon: L.icon({
                            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                            iconSize: [25, 41],
                            iconAnchor: [12, 41]
                        })
                    }).addTo(map).bindPopup("Moi");
                }
                
                // Keep center if no tasks, otherwise map fits bounds (simplified)
            `);
        }

        const taskMarkers = tasks.map((t: Task) => ({
            lat: t.latitude,
            lng: t.longitude,
            id: t.id,
            message: t.message
        }));

        webViewRef.current.injectJavaScript(`
            if (window.taskMarkers) {
                window.taskMarkers.forEach(m => map.removeLayer(m));
            }
            
            window.taskMarkers = ${JSON.stringify(taskMarkers)}.map(task => {
                return L.marker([task.lat, task.lng], {
                    icon: L.icon({
                        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
                        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                        iconSize: [25, 41],
                        iconAnchor: [12, 41]
                    })
                }).addTo(map).bindPopup('Inspection #' + task.id + ': ' + task.message);
            });
        `);
    }, [mapLoaded, userLoc, tasks]);


    const openItinerary = (task: Task) => {
        const url = `https://www.google.com/maps/dir/?api=1&destination=${task.latitude},${task.longitude}`;
        Linking.openURL(url);
    };

    const handleValidateTask = async (task: Task) => {
        if (!userLoc) {
            Alert.alert("Erreur", "Position non disponible");
            return;
        }

        try {
            await axios.post(`${API_URL}/inspector/validate_task`,
                {
                    task_id: task.id,
                    lat: userLoc.latitude,
                    lon: userLoc.longitude
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            Alert.alert("Succès", "Inspection validée ! La poubelle est confirmée propre.");
            fetchData();
        } catch (e: any) {
            Alert.alert(
                "Erreur de validation",
                e.response?.data?.detail || "Impossible de valider. Veuillez réessayer plus tard."
            );
        }
    };


    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
        <style>
            body { margin: 0; padding: 0; }
            #map { height: 100vh; width: 100vw; }
        </style>
    </head>
    <body>
        <div id="map"></div>
        <script>
            var map = L.map('map').setView([-4.325, 15.322], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(map);
        </script>
    </body>
    </html>
    `;

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text>Chargement...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <WebView
                ref={webViewRef}
                originWhitelist={['*']}
                source={{ html: htmlContent }}
                style={styles.map}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                onLoadEnd={() => setMapLoaded(true)}
            />

            <View style={styles.bottomSheet}>
                <Text style={styles.title}>Espace Inspecteur ({user?.username})</Text>

                {tasks.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>Aucune inspection en attente.</Text>
                    </View>
                ) : (
                    <ScrollView style={styles.taskList}>
                        {tasks.map(task => (
                            <View key={task.id} style={styles.taskCard}>
                                <Text style={styles.taskTitle}>Inspection #{task.id}</Text>
                                <Text style={styles.taskMessage}>{task.message}</Text>
                                <View style={styles.buttonRow}>
                                    <TouchableOpacity
                                        style={styles.navButton}
                                        onPress={() => openItinerary(task)}
                                    >
                                        <Text style={styles.buttonText}>Itinéraire</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.cleanButton}
                                        onPress={() => handleValidateTask(task)}
                                    >
                                        <Text style={styles.buttonText}>Confirmer (GPS)</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                )}

                <TouchableOpacity style={styles.logoutButton} onPress={logout}>
                    <Text style={styles.logoutText}>Déconnexion</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    map: { flex: 1 },
    bottomSheet: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: 20, maxHeight: height * 0.5,
        shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5,
    },
    title: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
    emptyContainer: { alignItems: 'center', marginVertical: 10 },
    emptyText: { fontSize: 16, color: '#666', textAlign: 'center', marginVertical: 20 },
    taskList: { maxHeight: height * 0.3 },
    taskCard: { backgroundColor: '#f5f5f5', padding: 15, borderRadius: 10, marginBottom: 10 },
    taskTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
    taskMessage: { fontSize: 14, color: '#666', marginBottom: 10 },
    buttonRow: { flexDirection: 'row', gap: 10 },
    navButton: { flex: 1, backgroundColor: '#007AFF', padding: 10, borderRadius: 5, alignItems: 'center' },
    cleanButton: { flex: 1, backgroundColor: '#34C759', padding: 10, borderRadius: 5, alignItems: 'center' },
    buttonText: { color: 'white', fontWeight: 'bold', textAlign: 'center' },
    logoutButton: { backgroundColor: '#FF3B30', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 15 },
    logoutText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});

export default InspectorDashboard;
