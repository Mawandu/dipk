import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';

const LoginScreen = ({ navigation }: any) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const { login, isLoading } = useAuth(); // Using context

    const handleLogin = async () => { // Fixed: added async keyword
        if (!username || !password) {
            Alert.alert('Erreur', 'Veuillez remplir tous les champs');
            return;
        }

        try {
            await login(username, password);
        } catch (e: any) {
            Alert.alert('Echec de connexion', 'Vérifiez vos identifiants');
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.logoContainer}>
                {/* Asset requirement needs adjusting for Android valid path, using online placeholder for dev if needed or local */}
                <Image
                    source={require('../assets/logo.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />
                <Text style={styles.title}>DIPK Login</Text>
                <Text style={styles.subtitle}>Accès Réservé : Agents & Inspecteurs</Text>
            </View>

            <View style={styles.formContainer}>
                <Text style={styles.label}>Nom d'utilisateur</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Ex: agent1"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    placeholderTextColor="#999"
                />

                <Text style={styles.label}>Mot de passe</Text>
                <TextInput
                    style={styles.input}
                    placeholder="********"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    placeholderTextColor="#999"
                />

                <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={isLoading}>
                    {isLoading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Se Connecter</Text>}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => navigation.navigate('Home')} style={{ marginTop: 20 }}>
                    <Text style={styles.link}>Continuer en tant que Citoyen (Invité)</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FA', justifyContent: 'center', padding: 20 },
    logoContainer: { alignItems: 'center', marginBottom: 40 },
    logo: { width: 100, height: 100, marginBottom: 10 },
    title: { fontSize: 28, fontWeight: 'bold', color: '#1A5F7A' },
    subtitle: { fontSize: 14, color: '#666' },
    formContainer: { backgroundColor: 'white', padding: 20, borderRadius: 15, elevation: 5 },
    label: { marginBottom: 5, fontWeight: 'bold', color: '#333' },
    input: { borderWidth: 1, borderColor: '#DDD', padding: 12, borderRadius: 8, marginBottom: 15, color: '#333' },
    button: { backgroundColor: '#1A5F7A', padding: 15, borderRadius: 8, alignItems: 'center' },
    buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    link: { color: '#1A5F7A', textAlign: 'center', fontWeight: '600' }
});

export default LoginScreen;
