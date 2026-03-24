import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, Alert } from 'react-native';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../api/api';

interface TransitCenter {
    id: number;
    name: string;
    capacity_max: number;
    current_load: number;
    status: string;
    lat: number;
    lon: number;
}

const SupervisorDashboard = () => {
    const { token, logout, user } = useAuth();
    const [center, setCenter] = useState<TransitCenter | null>(null);
    const [loading, setLoading] = useState(true);
    const [incomingDeposits, setIncomingDeposits] = useState<any[]>([]);

    const fetchMyCenter = async () => {
        try {
            console.log("Fetching center from:", `${API_URL}/supervisor/my_center`);
            const response = await axios.get(`${API_URL}/supervisor/my_center`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCenter(response.data);
            fetchIncomingDeposits();
        } catch (error) {
            console.error("Error fetching center:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchIncomingDeposits = async () => {
        try {
            const response = await axios.get(`${API_URL}/supervisor/incoming_deposits`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIncomingDeposits(response.data);
        } catch (error) {
            console.error("Error fetching incoming deposits:", error);
        }
    };

    const validateDeposit = async (agentId: number) => {
        try {
            await axios.post(`${API_URL}/supervisor/validate_deposit`, { agent_id: agentId }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            Alert.alert("Succès", "Dépôt validé !");
            fetchIncomingDeposits();
        } catch (error) {
            console.error("Error validating deposit:", error);
            Alert.alert("Erreur", "Impossible de valider le dépôt.");
        }
    };

    useEffect(() => {
        fetchMyCenter();
    }, []);

    const handleIncident = () => {
        Alert.alert("Incident", "Signalement d'incident non implémenté pour le moment.");
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Espace Superviseur</Text>
                <Text style={styles.subtitle}>Bonjour, {user?.username || 'Superviseur'}</Text>
                <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
                    <Text style={styles.logoutText}>Déconnexion</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.list}>
                {loading ? (
                    <ActivityIndicator size="large" color="#1A5F7A" style={{ marginTop: 50 }} />
                ) : center ? (
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Text style={styles.cardTitle}>{center.name}</Text>
                            <Text style={[styles.status,
                            center.status === 'OPERATIONAL' ? styles.statusGreen :
                                center.status === 'FULL' ? styles.statusRed : styles.statusYellow
                            ]}>
                                {center.status}
                            </Text>
                        </View>

                        <Text style={styles.msg}>ID: {center.id}</Text>

                        <View style={styles.statRow}>
                            <Text style={styles.statLabel}>Capacité Max:</Text>
                            <Text style={styles.statValue}>{center.capacity_max} t</Text>
                        </View>

                        <View style={styles.statRow}>
                            <Text style={styles.statLabel}>Charge Actuelle:</Text>
                            <Text style={styles.statValue}>{center.current_load} t</Text>
                        </View>

                        <View style={styles.statRow}>
                            <Text style={styles.statLabel}>Remplissage:</Text>
                            <Text style={styles.statValue}>
                                {((center.current_load / center.capacity_max) * 100).toFixed(1)}%
                            </Text>
                        </View>

                        <TouchableOpacity style={styles.button} onPress={handleIncident}>
                            <Text style={styles.btnText}>Déclarer Incident</Text>
                        </TouchableOpacity>

                        <Text style={styles.sectionTitle}>Dépôts en attente :</Text>
                        {incomingDeposits.length > 0 ? (
                            incomingDeposits.map((deposit) => (
                                <View key={deposit.agent_id} style={styles.depositCard}>
                                    <Text style={styles.depositAgentName}>Agent : {deposit.agent_name}</Text>
                                    <Text style={styles.depositNbBags}>{deposit.task_count} poubelle(s) déposée(s)</Text>
                                    <TouchableOpacity
                                        style={styles.validateDepositBtn}
                                        onPress={() => validateDeposit(deposit.agent_id)}
                                    >
                                        <Text style={styles.btnText}>Valider le dépôt</Text>
                                    </TouchableOpacity>
                                </View>
                            ))
                        ) : (
                            <Text style={styles.noDepositText}>Aucun dépôt en attente pour le moment.</Text>
                        )}
                    </View>
                ) : (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>Aucun centre de transit assigné.</Text>
                        <TouchableOpacity style={styles.refreshButton} onPress={fetchMyCenter}>
                            <Text style={styles.refreshButtonText}>Rafraîchir</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FA' },
    header: { padding: 20, backgroundColor: '#1A5F7A', borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
    title: { fontSize: 24, fontWeight: 'bold', color: 'white' },
    subtitle: { color: '#E0F7FA', marginBottom: 10 },
    logoutBtn: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 5, alignSelf: 'flex-start' },
    logoutText: { color: 'white' },
    list: { padding: 20 },
    card: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 15, elevation: 3 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    cardTitle: { fontWeight: 'bold', fontSize: 16, color: '#333' },
    status: { fontWeight: 'bold' },
    statusGreen: { color: 'green' },
    statusRed: { color: 'red' },
    statusYellow: { color: '#EF6C00' },
    msg: { color: '#555', marginBottom: 15 },
    statRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    statLabel: { fontSize: 14, color: '#7F8C8D' },
    statValue: { fontSize: 14, fontWeight: 'bold', color: '#2C3E50' },
    button: { backgroundColor: '#D32F2F', padding: 10, borderRadius: 5, alignItems: 'center', marginTop: 15 },
    btnText: { color: 'white', fontWeight: 'bold' },
    emptyContainer: { alignItems: 'center', marginTop: 50 },
    emptyText: { textAlign: 'center', color: '#999', marginBottom: 10 },
    refreshButton: { padding: 10, backgroundColor: '#E0E0E0', borderRadius: 8 },
    refreshButtonText: { color: '#333' },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 20, marginBottom: 10, color: '#1A5F7A' },
    depositCard: { backgroundColor: '#F0F8FF', padding: 15, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#BBE4F9' },
    depositAgentName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    depositNbBags: { fontSize: 14, color: '#666', marginBottom: 10 },
    validateDepositBtn: { backgroundColor: '#28A745', padding: 10, borderRadius: 5, alignItems: 'center' },
    noDepositText: { fontStyle: 'italic', color: '#999', marginTop: 10 },
});

export default SupervisorDashboard;
