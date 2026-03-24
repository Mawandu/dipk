import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, Dimensions, Linking, ScrollView } from 'react-native';
import { WebView } from 'react-native-webview';
import Geolocation from 'react-native-geolocation-service';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { API_URL } from '../api/api';

const { width, height } = Dimensions.get('window');

interface Task {
    id: number;
    status: string;
    message: string;
    created_at: string;
    latitude: number;
    longitude: number;
}

interface TransitCenter {
    id: number;
    name: string;
    lat: number;
    lng: number;
}

const AgentDashboard = ({ navigation }: any) => {
    const { user, logout, token } = useAuth();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [transitCenters, setTransitCenters] = useState<TransitCenter[]>([]);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [nearestCenter, setNearestCenter] = useState<any>(null);
    const [findingCenter, setFindingCenter] = useState(false);

    const webViewRef = useRef<WebView>(null);

    // Get User Location
    const getCurrentLocation = () => {
        Geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setUserLoc({ latitude, longitude });
            },
            (error) => console.log(error),
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
    };

    // Fetch Tasks and Transit Centers
    const fetchData = async () => {
        try {
            const [tasksRes, tcRes] = await Promise.all([
                axios.get(`${API_URL}/agent/my_tasks`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get(`${API_URL}/admin/map_data`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);

            setTasks(tasksRes.data);
            const tcs = tcRes.data.transit_centers || [];
            setTransitCenters(tcs);
            setLoading(false);
        } catch (err) {
            console.error(err);
            Alert.alert("Erreur", "Impossible de charger les données");
            setLoading(false);
        }
    };

    useEffect(() => {
        getCurrentLocation();
        fetchData();
    }, []);

    useEffect(() => {
        if (!mapLoaded || !webViewRef.current) return;

        if (userLoc) {
            webViewRef.current.injectJavaScript(`
                map.setView([${userLoc.latitude}, ${userLoc.longitude}], 13);
                if (userMarker) {
                    userMarker.setLatLng([${userLoc.latitude}, ${userLoc.longitude}]);
                } else {
                    userMarker = L.marker([${userLoc.latitude}, ${userLoc.longitude}], {
                        icon: L.icon({
                            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                            iconSize: [25, 41],
                            iconAnchor: [12, 41],
                            popupAnchor: [1, -34],
                            shadowSize: [41, 41]
                        })
                    }).addTo(map).bindPopup('Vous êtes ici');
                }
            `);
        }

        const taskMarkers = tasks.map((t: Task) => ({
            lat: t.latitude,
            lng: t.longitude,
            id: t.id,
            message: t.message
        }));

        const tcMarkers = transitCenters.map((tc: TransitCenter) => ({
            lat: tc.lat,
            lng: tc.lng,
            name: tc.name,
            isTC: true
        }));

        webViewRef.current.injectJavaScript(`
            // Clear existing markers
            if (window.taskMarkers) {
                window.taskMarkers.forEach(m => map.removeLayer(m));
            }
            if (window.tcMarkers) {
                window.tcMarkers.forEach(m => map.removeLayer(m));
            }
            
            // Add task markers (red)
            window.taskMarkers = ${JSON.stringify(taskMarkers)}.map(task => {
                return L.marker([task.lat, task.lng], {
                    icon: L.icon({
                        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34],
                        shadowSize: [41, 41]
                    })
                }).addTo(map).bindPopup('Tâche #' + task.id + ': ' + task.message);
            });
            
            // Add transit center markers (green)
            window.tcMarkers = ${JSON.stringify(tcMarkers)}.map(tc => {
                return L.marker([tc.lat, tc.lng], {
                    icon: L.icon({
                        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34],
                        shadowSize: [41, 41]
                    })
                }).addTo(map).bindPopup('Centre: ' + tc.name);
            });
        `);

    }, [mapLoaded, userLoc, tasks, transitCenters]);

    const openItinerary = (task: Task) => {
        const url = `https://www.google.com/maps/dir/?api=1&destination=${task.latitude},${task.longitude}`;
        Linking.openURL(url);
    };

    const openCenterItinerary = (lat: number, lon: number) => {
        const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
        Linking.openURL(url);
    };

    const findNearestCenter = async () => {
        if (!userLoc) {
            Alert.alert("Erreur", "Position non disponible. Veuillez patienter ou activer le GPS.");
            return;
        }

        setFindingCenter(true);
        try {
            const res = await axios.get(`${API_URL}/nearest_transit_center`, {
                params: { lat: userLoc.latitude, lon: userLoc.longitude },
                headers: { Authorization: `Bearer ${token}` }
            });
            setNearestCenter(res.data);

            // Zoom to the transit center on the map
            webViewRef.current?.injectJavaScript(`
                map.setView([${res.data.location.latitude}, ${res.data.location.longitude}], 14);
            `);
        } catch (err) {
            console.error(err);
            Alert.alert("Erreur", "Impossible de trouver un centre de transit.");
        } finally {
            setFindingCenter(false);
        }
    };

    const handleValidateTask = (task: Task) => {
        if (!userLoc) {
            Alert.alert("Erreur", "Position non disponible");
            return;
        }

        const distance = Math.sqrt(
            Math.pow((task.latitude - userLoc.latitude) * 111000, 2) +
            Math.pow((task.longitude - userLoc.longitude) * 111000, 2)
        );

        if (distance > 100) {
            Alert.alert(
                "Trop loin",
                `Vous êtes à ${Math.round(distance)}m de la poubelle. Validez quand même ?`,
                [
                    { text: "Annuler", style: "cancel" },
                    { text: "Forcer", onPress: () => confirmClean(task.id) }
                ]
            );
        } else {
            confirmClean(task.id);
        }
    };

    const confirmClean = async (taskId: number) => {
        try {
            await axios.put(`${API_URL}/agent/tasks/${taskId}/resolve`,
                { status: "CLEANED" }, // The backend transforms this to IN_TRANSIT now
                { headers: { Authorization: `Bearer ${token}` } }
            );
            Alert.alert("Succès", "Poubelle récupérée (En transit) !");
            setSelectedTask(null);
            fetchData();
        } catch (e) {
            Alert.alert("Erreur", "Échec lors de la validation.");
        }
    };

    const handleConfirmDeposit = async () => {
        try {
            setFindingCenter(true);
            const res = await axios.post(`${API_URL}/agent/confirm_deposit`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            Alert.alert("Succès", `Dépôt confirmé pour ${res.data.deposited_count} poubelle(s). En attente de validation du superviseur.`);
            setNearestCenter(null);
            fetchData();
        } catch (e) {
            Alert.alert("Erreur", "Impossible de confirmer le dépôt.");
        } finally {
            setFindingCenter(false);
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
            var userMarker = null;
            
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
                <Text style={styles.title}>Bienvenue, {user?.username}</Text>

                {tasks.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>Aucune tâche assignée. Beau travail !</Text>

                        {nearestCenter ? (
                            <View style={styles.centerCard}>
                                <Text style={styles.centerTitle}>Centre le plus proche :</Text>
                                <Text style={styles.centerName}>{nearestCenter.name}</Text>
                                <Text style={styles.centerDistance}>À {nearestCenter.distance_meters} mètres</Text>

                                <TouchableOpacity
                                    style={styles.navCenterButton}
                                    onPress={() => openCenterItinerary(nearestCenter.location.latitude, nearestCenter.location.longitude)}
                                >
                                    <Text style={styles.buttonText}>Itinéraire vers le Centre</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.navCenterButton, { backgroundColor: '#FF9500' }]}
                                    onPress={handleConfirmDeposit}
                                    disabled={findingCenter}
                                >
                                    <Text style={styles.buttonText}>Confirmer l'arrivée et le dépôt</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.refreshBtn}
                                    onPress={() => setNearestCenter(null)}
                                >
                                    <Text style={styles.refreshBtnText}>Fermer</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={styles.findCenterButton}
                                onPress={findNearestCenter}
                                disabled={findingCenter}
                            >
                                {findingCenter ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <Text style={styles.buttonText}>Trouver un Centre de Transit</Text>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <ScrollView style={styles.taskList}>
                        {tasks.map(task => (
                            <View key={task.id} style={styles.taskCard}>
                                <Text style={styles.taskTitle}>Tâche #{task.id}</Text>
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
                                        <Text style={styles.buttonText}>Prendre (En transit)</Text>
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
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    map: {
        flex: 1,
    },
    bottomSheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: height * 0.5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    emptyText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginVertical: 20,
    },
    taskList: {
        maxHeight: height * 0.3,
    },
    taskCard: {
        backgroundColor: '#f5f5f5',
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
    },
    taskTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    taskMessage: {
        fontSize: 14,
        color: '#666',
        marginBottom: 10,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 10,
    },
    navButton: {
        flex: 1,
        backgroundColor: '#007AFF',
        padding: 10,
        borderRadius: 5,
        alignItems: 'center',
    },
    cleanButton: {
        flex: 1,
        backgroundColor: '#34C759',
        padding: 10,
        borderRadius: 5,
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        fontWeight: 'bold',
    },
    logoutButton: {
        backgroundColor: '#FF3B30',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 15,
    },
    logoutText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    emptyContainer: {
        alignItems: 'center',
        marginVertical: 10,
    },
    findCenterButton: {
        backgroundColor: '#007AFF',
        padding: 15,
        borderRadius: 10,
        width: '100%',
        alignItems: 'center',
        marginTop: 10,
    },
    centerCard: {
        backgroundColor: '#E8F4FA',
        padding: 15,
        borderRadius: 10,
        width: '100%',
        borderWidth: 1,
        borderColor: '#BBE4F9',
        marginTop: 10,
    },
    centerTitle: {
        fontSize: 14,
        color: '#666',
        marginBottom: 5,
    },
    centerName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1A5F7A',
        marginBottom: 5,
    },
    centerDistance: {
        fontSize: 16,
        color: '#333',
        marginBottom: 15,
    },
    navCenterButton: {
        backgroundColor: '#28A745',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 10,
    },
    refreshBtn: {
        padding: 10,
        alignItems: 'center',
    },
    refreshBtnText: {
        color: '#666',
        textDecorationLine: 'underline',
    }
});

export default AgentDashboard;
