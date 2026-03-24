import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    Alert,
    Platform,
    PermissionsAndroid,
    TextInput,
    ScrollView,
    StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import Geolocation from 'react-native-geolocation-service';
import { predictTrash, submitReport } from '../api/api'; // Adjust path if needed

type Step = 'IDLE' | 'ANALYZING' | 'TRASH_DETECTED' | 'GETTING_GPS' | 'MANUAL_ENTRY' | 'SUBMITTING' | 'RESULT';

const HomeScreen = ({ navigation }: any) => { // Added navigation prop if needed later for Login button
    const [step, setStep] = useState<Step>('IDLE');
    const [image, setImage] = useState<any | null>(null);
    const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
    const [manualCoords, setManualCoords] = useState({ lat: '', lon: '' });
    const [result, setResult] = useState<{ status: string; message: string } | null>(null);

    const requestPermissions = async () => {
        if (Platform.OS === 'android') {
            try {
                await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.CAMERA,
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                ]);
            } catch (err) {
                console.warn(err);
            }
        }
    };

    const handleSelectImage = async (useCamera: boolean) => {
        await requestPermissions();
        const options = { mediaType: 'photo' as const, quality: 0.8 };

        try {
            const result = useCamera
                ? await launchCamera(options)
                : await launchImageLibrary(options);

            if (result.assets && result.assets.length > 0) {
                const selectedImage = result.assets[0];
                setImage(selectedImage);
                analyzeImage(selectedImage);
            }
        } catch (e) {
            console.error("Picker Error", e);
        }
    };

    const analyzeImage = async (img: any) => {
        setStep('ANALYZING');
        try {
            if (!img.uri || !img.type || !img.fileName) return;

            const response = await predictTrash({
                uri: img.uri,
                type: img.type,
                name: img.fileName,
            });

            if (response && response.is_trash) {
                setStep('TRASH_DETECTED');
                Alert.alert('Succès', 'Déchets détectés ! Veuillez localiser le signalement.');
            } else {
                setStep('IDLE');
                Alert.alert('Info', "Aucun déchet détecté. Merci de garder la ville propre.");
            }
        } catch (error) {
            console.error(error);
            setStep('IDLE');
            Alert.alert('Erreur IA', "Impossible d'analyser l'image. Vérifiez votre connexion.");
        }
    };

    const handleGetLocation = () => {
        setStep('GETTING_GPS');
        Geolocation.getCurrentPosition(
            (position) => {
                setCoords({
                    lat: position.coords.latitude,
                    lon: position.coords.longitude,
                });
                handleSubmit(position.coords.latitude, position.coords.longitude);
            },
            (error) => {
                console.log(error.code, error.message);
                setStep('TRASH_DETECTED');
                Alert.alert('Erreur GPS', error.message);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
    };

    const handleManualEntry = () => {
        setStep('MANUAL_ENTRY');
    };

    const submitManual = () => {
        const lat = parseFloat(manualCoords.lat);
        const lon = parseFloat(manualCoords.lon);
        if (isNaN(lat) || isNaN(lon)) {
            Alert.alert('Erreur', 'Veuillez entrer des coordonnées valides.');
            return;
        }
        setCoords({ lat, lon });
        handleSubmit(lat, lon);
    };

    const handleSubmit = async (lat: number, lon: number) => {
        if (!image || !image.uri || !image.type || !image.fileName) return;
        setStep('SUBMITTING');

        try {
            const response = await submitReport(lat, lon, {
                uri: image.uri,
                type: image.type,
                name: image.fileName,
            });

            setResult(response);
            setStep('RESULT');
        } catch (error) {
            console.error(error);
            setStep('TRASH_DETECTED');
            Alert.alert('Erreur Envoi', "Echec de l'envoi du rapport. Vérifiez le backend.");
        }
    };

    const reset = () => {
        setStep('IDLE');
        setImage(null);
        setCoords(null);
        setResult(null);
        setManualCoords({ lat: '', lon: '' });
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#1A5F7A" />
            <View style={styles.header}>
                {/* Placeholder for Logo - React Native handles local images via require */}
                <Image source={require('../assets/logo.png')} style={styles.logoHeader} resizeMode="contain" />
                <Text style={styles.title}>DIPK Mobile</Text>
                <Text style={styles.subtitle}>Kinshasa Propre et Intelligente</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {step === 'IDLE' && (
                    <View style={styles.center}>
                        <View style={styles.welcomeCard}>
                            <Image source={require('../assets/logo.png')} style={styles.logoWelcome} resizeMode="contain" />
                            <Text style={styles.welcomeTitle}>Bienvenue !</Text>
                            <Text style={styles.welcomeText}>
                                "L'intelligence artificielle au service de la propreté urbaine."
                            </Text>
                            <Text style={styles.welcomeSubText}>
                                Détectez les déchets, signalez-les, et contribuez à une ville plus saine.
                            </Text>
                        </View>

                        <TouchableOpacity style={styles.btnPrimary} onPress={() => handleSelectImage(true)}>
                            <Text style={styles.btnText}>Prendre la photo</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.btnSecondary} onPress={() => handleSelectImage(false)}>
                            <Text style={styles.btnTextSec}>Importer depuis la Galerie</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={{ marginTop: 20 }} onPress={() => navigation.navigate('Login')}>
                            <Text style={{ color: '#1A5F7A' }}>Connexion Agent</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ... (Previous logic for ANALYZING, TRASH_DETECTED, etc. remains the same) */}
                {step === 'ANALYZING' && (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color="#1A5F7A" />
                        <Text style={styles.label}>Analyse IA en cours...</Text>
                        <Text style={styles.subLabel}>Veuillez patienter.</Text>
                    </View>
                )}

                {image && (step === 'TRASH_DETECTED' || step === 'GETTING_GPS' || step === 'MANUAL_ENTRY' || step === 'SUBMITTING') && (
                    <View style={styles.center}>
                        <View style={styles.imageCard}>
                            <Image source={{ uri: image.uri }} style={styles.preview} />
                            <View style={styles.badgeContainer}>
                                <Text style={styles.badgeText}>Déchets détectés</Text>
                            </View>
                        </View>

                        {(step === 'TRASH_DETECTED' || step === 'MANUAL_ENTRY') && (
                            <View style={{ width: '100%', alignItems: 'center' }}>
                                <Text style={styles.instructionText}>Où se trouve ce déchet ?</Text>

                                <TouchableOpacity style={styles.btnSuccess} onPress={handleGetLocation}>
                                    <Text style={styles.btnText}>Utiliser ma Position GPS</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.btnOutline} onPress={handleManualEntry}>
                                    <Text style={styles.btnTextOutline}>Entrer Coordonnées Manuelles</Text>
                                </TouchableOpacity>

                                {step === 'MANUAL_ENTRY' && (
                                    <View style={styles.manualContainer}>
                                        <Text style={styles.inputLabel}>Latitude</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="-4.325..."
                                            keyboardType="numeric"
                                            value={manualCoords.lat}
                                            onChangeText={(t) => setManualCoords(p => ({ ...p, lat: t }))}
                                            placeholderTextColor="#999"
                                        />
                                        <Text style={styles.inputLabel}>Longitude</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="15.322..."
                                            keyboardType="numeric"
                                            value={manualCoords.lon}
                                            onChangeText={(t) => setManualCoords(p => ({ ...p, lon: t }))}
                                            placeholderTextColor="#999"
                                        />
                                        <TouchableOpacity style={styles.btnPrimary} onPress={submitManual}>
                                            <Text style={styles.btnText}>Valider et Envoyer</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        )}

                        {(step === 'GETTING_GPS' || step === 'SUBMITTING') && (
                            <View style={{ marginTop: 20 }}>
                                <ActivityIndicator size="small" color="#1A5F7A" />
                                <Text style={styles.subLabel}>{step === 'GETTING_GPS' ? 'Acquisition GPS...' : 'Envoi du rapport au serveur...'}</Text>
                            </View>
                        )}
                    </View>
                )}

                {step === 'RESULT' && result && (
                    <View style={styles.center}>
                        <View style={[styles.resultCard, result.status === 'ILLEGAL_DUMP' ? styles.cardRed : styles.cardBlue]}>
                            <Text style={styles.resultEmoji}>
                                {result.status === 'ILLEGAL_DUMP' ? '🚨' : '✅'}
                            </Text>
                            <Text style={styles.resultTitle}>
                                {result.status === 'ILLEGAL_DUMP' ? 'Dépôt Illégal Signalé' : 'Poubelle Officielle Identifiée'}
                            </Text>
                            <Text style={styles.message}>{result.message}</Text>
                        </View>

                        <TouchableOpacity style={styles.btnPrimary} onPress={reset}>
                            <Text style={styles.btnText}>Nouveau Signalement</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

// Use same styles from App.tsx
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FA' },
    header: {
        paddingVertical: 20,
        backgroundColor: '#1A5F7A',
        justifyContent: 'center',
        alignItems: 'center',
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    logoHeader: {
        width: 60,
        height: 60,
        marginBottom: 5,
    },
    title: { color: 'white', fontSize: 24, fontWeight: 'bold', letterSpacing: 1 },
    subtitle: { color: '#E0F7FA', fontSize: 13, fontStyle: 'italic', marginTop: 0 },
    content: { flexGrow: 1, padding: 20 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    welcomeCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 25,
        marginBottom: 30,
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#000',
        width: '100%',
    },
    logoWelcome: {
        width: 100,
        height: 100,
        marginBottom: 15,
    },
    welcomeTitle: { fontSize: 22, fontWeight: 'bold', color: '#1A5F7A', marginBottom: 10 },
    welcomeText: { fontSize: 16, fontStyle: 'italic', textAlign: 'center', color: '#555', marginBottom: 15 },
    welcomeSubText: { fontSize: 14, textAlign: 'center', color: '#777', lineHeight: 20 },

    btnPrimary: {
        backgroundColor: '#1572A1',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 15,
        width: '90%',
        alignItems: 'center',
        marginBottom: 15,
        elevation: 4,
    },
    btnSecondary: {
        backgroundColor: '#6C757D',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 15,
        width: '90%',
        alignItems: 'center',
        marginBottom: 15,
        elevation: 2,
    },
    btnSuccess: {
        backgroundColor: '#28A745',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 15,
        width: '90%',
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 10,
        elevation: 4,
    },
    btnOutline: {
        borderWidth: 2,
        borderColor: '#1572A1',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 15,
        width: '90%',
        alignItems: 'center',
        marginBottom: 10,
    },
    btnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    btnTextSec: { color: 'white', fontSize: 16, fontWeight: '600' },
    btnTextOutline: { color: '#1572A1', fontSize: 16, fontWeight: 'bold' },

    label: { marginTop: 20, fontSize: 18, fontWeight: 'bold', color: '#333' },
    subLabel: { marginTop: 5, fontSize: 14, color: '#666' },

    imageCard: {
        backgroundColor: 'white',
        padding: 10,
        borderRadius: 15,
        elevation: 5,
        marginBottom: 20,
        alignItems: 'center',
    },
    preview: { width: 300, height: 300, borderRadius: 10 },
    badgeContainer: {
        position: 'absolute',
        bottom: -15,
        backgroundColor: '#28A745',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
        elevation: 3,
    },
    badgeText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

    instructionText: { fontSize: 16, color: '#333', marginBottom: 10, marginTop: 10 },

    resultCard: {
        padding: 30,
        borderRadius: 20,
        alignItems: 'center',
        marginBottom: 30,
        width: '100%',
        elevation: 5,
    },
    cardRed: { backgroundColor: '#FFEBEE', borderColor: '#FFCDD2', borderWidth: 1 },
    cardBlue: { backgroundColor: '#E3F2FD', borderColor: '#BBDEFB', borderWidth: 1 },
    resultEmoji: { fontSize: 50, marginBottom: 10 },
    resultTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, color: '#333', textAlign: 'center' },
    message: { fontSize: 16, textAlign: 'center', color: '#555', lineHeight: 24 },

    manualContainer: { width: '100%', marginTop: 20, alignItems: 'center', backgroundColor: '#F0F4C3', padding: 15, borderRadius: 15 },
    input: { width: '90%', borderWidth: 1, borderColor: '#BBB', borderRadius: 10, padding: 12, marginBottom: 10, backgroundColor: 'white', color: 'black', fontSize: 16 },
    inputLabel: { width: '90%', textAlign: 'left', color: '#555', marginBottom: 5, fontWeight: 'bold' }
});

export default HomeScreen;
