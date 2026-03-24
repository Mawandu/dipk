import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { ActivityIndicator, View } from 'react-native';

// Screens
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import AgentDashboard from '../screens/AgentDashboard';
import SupervisorDashboard from '../screens/SupervisorDashboard';
import InspectorDashboard from '../screens/InspectorDashboard';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
    const { token, role, isLoading } = useAuth();

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#1A5F7A" />
            </View>
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {token ? (
                    // Authenticated Stack
                    // Backend uses: AGENT, INSPECTEUR, SUPERVISEUR, ADMIN
                    role === 'SUPERVISEUR' ? (
                        <Stack.Screen name="SupervisorDashboard" component={SupervisorDashboard} />
                    ) : role === 'INSPECTEUR' ? (
                        <Stack.Screen name="InspectorDashboard" component={InspectorDashboard} />
                    ) : role === 'AGENT' || role === 'ADMIN' ? (
                        <>
                            <Stack.Screen name="AgentDashboard" component={AgentDashboard} />
                            {/* Agent can also report issues if needed */}
                            <Stack.Screen name="Report" component={HomeScreen} />
                        </>
                    ) : (
                        // Fallback for other roles or standard user
                        <Stack.Screen name="Home" component={HomeScreen} />
                    )
                ) : (
                    // Unauthenticated Stack
                    <>
                        {/* Default to HomeScreen for Citizens (Guest Mode) */}
                        <Stack.Screen name="Home" component={HomeScreen} />
                        <Stack.Screen name="Login" component={LoginScreen} />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default AppNavigator;
